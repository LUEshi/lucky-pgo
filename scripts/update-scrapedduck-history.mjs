import fs from "node:fs/promises";
import path from "node:path";

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

const RAID_EVENT_TYPES = new Set([
  "raid-day",
  "raid-battles",
  "max-battles",
  "elite-raids",
  "shadow-raid-day",
  "shadow-raids",
]);

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

async function fetchText(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
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

function splitCompositeNames(value) {
  return value
    .split(/\s*(?:,|&| and )\s*/i)
    .map((part) => part.trim())
    .filter(Boolean);
}

function isGenericFeaturedName(name) {
  const key = normalizeNameKey(name);
  return key.length < 4 || GENERIC_FEATURED_KEYS.has(key);
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

function extractBossNamesFromJsonLike(html) {
  const names = [];
  const variants = [html, html.replace(/\\"/g, '"')];

  for (const source of variants) {
    const blockRegex = /"bosses"\s*:\s*\[([\s\S]*?)\]/gi;
    for (const blockMatch of source.matchAll(blockRegex)) {
      const block = blockMatch[1];
      for (const nameMatch of block.matchAll(/"name"\s*:\s*"([^"]+)"/gi)) {
        names.push(nameMatch[1]);
      }
    }
  }

  return dedupeNames(names);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extractNamesFromPageText(html, knownNames) {
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .toLowerCase();

  const found = [];
  for (const name of knownNames) {
    const pattern = new RegExp(`\\b${escapeRegExp(name.toLowerCase())}\\b`, "i");
    if (pattern.test(text)) {
      found.push(name);
    }
  }
  return dedupeNames(found);
}

function hasBosses(event) {
  return (event.extraData?.raidbattles?.bosses?.length ?? 0) > 0;
}

function needsRaidEnrichment(event) {
  return RAID_EVENT_TYPES.has(event.eventType) && !hasBosses(event);
}

function buildBosses(names) {
  return names.map((name) => ({
    name,
    image: "",
    canBeShiny: false,
  }));
}

async function inferFeaturedBossesForEvent(event, knownRaidNames) {
  const inferred = dedupeNames([
    ...inferFeaturedFromName(event.name),
    ...inferFeaturedFromEventId(event.eventID),
  ]).filter((name) => !isGenericFeaturedName(name));

  let scraped = [];
  try {
    const html = await fetchText(event.link);
    const fromJson = extractBossNamesFromJsonLike(html);
    if (fromJson.length > 0) {
      scraped = fromJson;
    } else {
      scraped = extractNamesFromPageText(html, knownRaidNames);
    }
  } catch (error) {
    console.warn(
      `[history] raid enrichment failed for ${event.eventID}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  return dedupeNames([...scraped, ...inferred]).filter(
    (name) => !isGenericFeaturedName(name),
  );
}

async function enrichEventsWithRaidBosses(events, raids) {
  const knownRaidNames = dedupeNames(raids.map((raid) => raid.name)).filter(
    (name) => !isGenericFeaturedName(name),
  );

  const enriched = await Promise.all(
    events.map(async (event) => {
      if (!needsRaidEnrichment(event)) return event;

      const featuredBosses = await inferFeaturedBossesForEvent(
        event,
        knownRaidNames,
      );
      if (featuredBosses.length === 0) return event;

      const existingExtraData = event.extraData ?? {};
      const existingRaidbattles = existingExtraData.raidbattles ?? {};

      return {
        ...event,
        extraData: {
          ...existingExtraData,
          raidbattles: {
            ...existingRaidbattles,
            bosses: buildBosses(featuredBosses),
            shinies: existingRaidbattles.shinies ?? [],
          },
        },
      };
    }),
  );

  const enrichedCount = enriched.filter(
    (event, idx) => !hasBosses(events[idx]) && hasBosses(event),
  ).length;
  console.log(`[history] raid boss enrichment added bosses to ${enrichedCount} event(s)`);

  return enriched;
}

async function buildSnapshot() {
  const [initialEvents, raids, research, eggs, rockets] = await Promise.all([
    fetchJson(`${BASE_URL}/${ENDPOINTS.events}`),
    fetchJson(`${BASE_URL}/${ENDPOINTS.raids}`),
    fetchJson(`${BASE_URL}/${ENDPOINTS.research}`),
    fetchJson(`${BASE_URL}/${ENDPOINTS.eggs}`),
    fetchJson(`${BASE_URL}/${ENDPOINTS.rockets}`),
  ]);
  const events = await enrichEventsWithRaidBosses(initialEvents, raids);

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
