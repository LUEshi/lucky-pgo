import fs from "node:fs/promises";
import path from "node:path";
import { scrapeEventPageHtml } from "./scrapers/event-page.mjs";

const KEEP_DAYS = 7;
const SNAPSHOT_DIR = path.resolve("public/history");
const INDEX_PATH = path.join(SNAPSHOT_DIR, "index.json");
const BASE_URL = "https://raw.githubusercontent.com/bigfoott/ScrapedDuck/data";

const ENDPOINTS = {
  events: "events.min.json",
  raids: "raids.min.json",
  research: "research.min.json",
  eggs: "eggs.min.json",
  rockets: "rocketLineups.min.json",
};

// Delay between page fetches to be polite to LeekDuck
const FETCH_DELAY_MS = 1000;

function dateKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function cutoffDate(date = new Date()) {
  const cutoff = new Date(date);
  cutoff.setUTCDate(cutoff.getUTCDate() - (KEEP_DAYS - 1));
  return cutoff;
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }
  return response.json();
}

async function fetchText(url, timeoutMs = 12000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`Failed to fetch ${url}: ${response.status}`);
    }
    return await response.text();
  } finally {
    clearTimeout(timeout);
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Enrichment helpers (kept for fallback when page scraping yields no bosses)
// ---------------------------------------------------------------------------

function normalizeNameKey(name) {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function dedupeNames(names) {
  const deduped = new Map();
  for (const name of names) {
    const trimmed = name.trim();
    if (!trimmed) continue;
    const key = normalizeNameKey(trimmed);
    if (!key) continue;
    if (!deduped.has(key)) deduped.set(key, trimmed);
  }
  return Array.from(deduped.values());
}

const GENERIC_FEATURED_KEYS = new Set([
  "raid",
  "day",
  "shadow",
  "max",
  "battle",
  "elite",
  "event",
  "pokemon",
  "go",
]);

function isGenericFeaturedName(name) {
  const key = normalizeNameKey(name);
  return key.length < 4 || GENERIC_FEATURED_KEYS.has(key);
}

function splitCompositeNames(value) {
  return value
    .split(/\s*(?:,|&| and )\s*/i)
    .map((part) => part.trim())
    .filter(Boolean);
}

function toTitleCase(value) {
  return value
    .split(" ")
    .filter(Boolean)
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(" ");
}

function inferFeaturedFromName(name) {
  const direct = name.match(/^(.+?)\s+(?:Raid Day|Max Battle Day|Elite Raid Day)$/i);
  if (direct) return splitCompositeNames(direct[1]);

  const inRaids = name.match(/^(.+?)\s+in\s+.+\s+Raid Battles$/i);
  if (inRaids) return splitCompositeNames(inRaids[1]);

  return [];
}

function inferFeaturedFromEventId(eventID) {
  const slug = eventID.match(/^(.+?)-(?:raid-day|max-battle-day|elite-raid-day)(?:-\d{4})?$/i);
  if (!slug) return [];
  return [toTitleCase(slug[1].replace(/-/g, " "))];
}

function buildBosses(names) {
  return names.map((name) => ({
    name,
    image: "",
    canBeShiny: false,
  }));
}

// ---------------------------------------------------------------------------
// Unified event enrichment — single page fetch for everything
// ---------------------------------------------------------------------------

const LEEKDUCK_HOST = "https://leekduck.com/";

function isLeekDuckLink(link) {
  return typeof link === "string" && link.startsWith(LEEKDUCK_HOST);
}

function hasEnrichedData(event) {
  const g = event.extraData?.generic;
  return (
    (g?.spawns?.length ?? 0) > 0 ||
    (g?.eventEggs?.length ?? 0) > 0 ||
    (g?.eventResearch?.length ?? 0) > 0
  );
}

function hasBosses(event) {
  return (event.extraData?.raidbattles?.bosses?.length ?? 0) > 0;
}

const RAID_EVENT_TYPES = new Set([
  "raid-day",
  "raid-battles",
  "max-battles",
  "elite-raids",
  "shadow-raid-day",
  "shadow-raids",
]);

/**
 * Enrich events by scraping their LeekDuck pages.
 * Combines raid boss extraction and generic content (spawns, eggs, research)
 * into a single fetch per page. Caches HTML by URL to avoid re-fetching if
 * multiple events share a page.
 */
async function enrichEventsFromPages(events, raids) {
  const knownRaidNames = dedupeNames(raids.map((r) => r.name)).filter(
    (name) => !isGenericFeaturedName(name),
  );

  // Cache fetched HTML by URL
  const htmlCache = new Map();

  let enrichedCount = 0;
  let raidEnrichedCount = 0;

  const enriched = [];
  for (const event of events) {
    // Skip events that are already fully enriched and have bosses
    if (hasEnrichedData(event) && hasBosses(event)) {
      enriched.push(event);
      continue;
    }

    // Only scrape LeekDuck links
    if (!isLeekDuckLink(event.link)) {
      enriched.push(event);
      continue;
    }

    let html = htmlCache.get(event.link);
    if (!html) {
      try {
        html = await fetchText(event.link);
        htmlCache.set(event.link, html);
        // Polite delay between fetches
        await sleep(FETCH_DELAY_MS);
      } catch (error) {
        console.warn(
          `[history] page fetch failed for ${event.eventID}: ${error instanceof Error ? error.message : String(error)}`,
        );
        enriched.push(event);
        continue;
      }
    }

    try {
      const pageData = scrapeEventPageHtml(html);
      const existingExtraData = event.extraData ?? {};
      const existingGeneric = existingExtraData.generic ?? {};
      const existingRaidbattles = existingExtraData.raidbattles ?? {};

      // Merge generic enrichment (spawns, eggs, research)
      const newGeneric = { ...existingGeneric };
      if (pageData.spawns.length > 0) {
        newGeneric.spawns = pageData.spawns;
      }
      if (pageData.eventEggs.length > 0) {
        newGeneric.eventEggs = pageData.eventEggs;
      }
      if (pageData.eventResearch.length > 0) {
        newGeneric.eventResearch = pageData.eventResearch;
      }

      // Merge raid bosses — page-scraped bosses take priority, then existing,
      // then fallback to name inference for raid-type events
      let bosses = existingRaidbattles.bosses ?? [];
      if (pageData.raidBosses.length > 0 && bosses.length === 0) {
        bosses = pageData.raidBosses.map((b) => ({
          name: b.name,
          image: "",
          canBeShiny: b.canBeShiny,
        }));
      }

      // For raid events still without bosses, try name inference
      if (bosses.length === 0 && RAID_EVENT_TYPES.has(event.eventType)) {
        const inferred = dedupeNames([
          ...inferFeaturedFromName(event.name),
          ...inferFeaturedFromEventId(event.eventID),
        ]).filter((name) => !isGenericFeaturedName(name));
        if (inferred.length > 0) {
          bosses = buildBosses(inferred);
        }
      }

      const newRaidbattles =
        bosses.length > 0
          ? {
              ...existingRaidbattles,
              bosses,
              shinies: existingRaidbattles.shinies ?? [],
            }
          : existingRaidbattles;

      const didEnrichGeneric =
        pageData.spawns.length > 0 ||
        pageData.eventEggs.length > 0 ||
        pageData.eventResearch.length > 0;
      const didEnrichRaids =
        !hasBosses(event) && (newRaidbattles.bosses?.length ?? 0) > 0;

      if (didEnrichGeneric) enrichedCount++;
      if (didEnrichRaids) raidEnrichedCount++;

      enriched.push({
        ...event,
        extraData: {
          ...existingExtraData,
          generic: newGeneric,
          ...(Object.keys(newRaidbattles).length > 0
            ? { raidbattles: newRaidbattles }
            : {}),
        },
      });
    } catch (error) {
      console.warn(
        `[history] page enrichment failed for ${event.eventID}: ${error instanceof Error ? error.message : String(error)}`,
      );
      enriched.push(event);
    }
  }

  console.log(
    `[history] page enrichment: ${enrichedCount} event(s) with spawns/eggs/research, ${raidEnrichedCount} event(s) with raid bosses`,
  );
  return enriched;
}

// ---------------------------------------------------------------------------
// Snapshot building
// ---------------------------------------------------------------------------

async function buildSnapshot() {
  const [initialEvents, raids, research, eggs, rockets] = await Promise.all([
    fetchJson(`${BASE_URL}/${ENDPOINTS.events}`),
    fetchJson(`${BASE_URL}/${ENDPOINTS.raids}`),
    fetchJson(`${BASE_URL}/${ENDPOINTS.research}`),
    fetchJson(`${BASE_URL}/${ENDPOINTS.eggs}`),
    fetchJson(`${BASE_URL}/${ENDPOINTS.rockets}`),
  ]);
  const events = await enrichEventsFromPages(initialEvents, raids);

  const generatedAt = new Date().toISOString();

  return {
    date: dateKey(new Date(generatedAt)),
    generatedAt,
    source: BASE_URL,
    data: { events, raids, research, eggs, rockets },
  };
}

async function pruneOldSnapshots() {
  const files = await fs.readdir(SNAPSHOT_DIR);
  const cutoff = cutoffDate();

  for (const file of files) {
    if (!/^\d{4}-\d{2}-\d{2}\.json$/.test(file)) continue;
    const fileDate = new Date(`${file.slice(0, 10)}T00:00:00Z`);
    if (fileDate < cutoff) {
      await fs.unlink(path.join(SNAPSHOT_DIR, file));
    }
  }
}

async function writeIndex() {
  const files = await fs.readdir(SNAPSHOT_DIR);
  const snapshots = files
    .filter((file) => /^\d{4}-\d{2}-\d{2}\.json$/.test(file))
    .sort()
    .reverse()
    .map((file) => ({
      date: file.slice(0, 10),
      path: `history/${file}`,
    }));

  await fs.writeFile(
    INDEX_PATH,
    `${JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        keepDays: KEEP_DAYS,
        snapshots,
      },
      null,
      2,
    )}\n`,
  );
}

async function main() {
  await fs.mkdir(SNAPSHOT_DIR, { recursive: true });

  const snapshot = await buildSnapshot();
  const outPath = path.join(SNAPSHOT_DIR, `${snapshot.date}.json`);
  await fs.writeFile(outPath, `${JSON.stringify(snapshot, null, 2)}\n`);

  await pruneOldSnapshots();
  await writeIndex();

  console.log(`Updated history snapshot: ${snapshot.date}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
