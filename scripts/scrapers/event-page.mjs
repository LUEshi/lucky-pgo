/**
 * LeekDuck event page scraper.
 *
 * Extracts spawns, eggs, research tasks, and raid bosses from a LeekDuck
 * event page. Uses JSDOM for DOM parsing — matches ScrapedDuck's toolchain
 * so this module can be adapted into a PR for their pages/detailed/generic.js.
 *
 * Exports:
 *   scrapeEventPageHtml(html)          — pure DOM extraction (testable)
 *   fetchAndScrapeEventPage(url, opts) — fetch + extract wrapper
 */

import { JSDOM } from "jsdom";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Starting from `startEl`, walk nextElementSibling up to `limit` steps
 * looking for an element matching `selector` (or containing one).
 */
function findNextMatch(startEl, selector, limit = 10) {
  let el = startEl.nextElementSibling;
  for (let i = 0; i < limit && el; i++) {
    if (el.matches(selector)) return el;
    const nested = el.querySelector(selector);
    if (nested) return nested;
    el = el.nextElementSibling;
  }
  return null;
}

/**
 * Collect ALL .pkmn-list-flex lists between `startHeader` and the next
 * event-section-header (h2.event-section-header) or end of document.
 * This handles events where spawns are split into common + rare groups.
 */
function collectListsBetweenSections(startHeader) {
  const lists = [];
  let el = startHeader.nextElementSibling;
  while (el) {
    if (el.matches("h2.event-section-header")) break;
    if (el.matches("ul.pkmn-list-flex")) {
      lists.push(el);
    } else {
      const nested = el.querySelector("ul.pkmn-list-flex");
      if (nested) lists.push(nested);
    }
    el = el.nextElementSibling;
  }
  return lists;
}

/**
 * Extract Pokemon items from a ul.pkmn-list-flex element.
 */
function extractPokemonFromList(listEl) {
  return Array.from(listEl.querySelectorAll("li.pkmn-list-item"))
    .map((li) => {
      const name = li.querySelector(".pkmn-name")?.textContent?.trim() ?? "";
      const canBeShiny = !!li.querySelector("img.shiny-icon");
      return { name, canBeShiny };
    })
    .filter((p) => p.name.length > 0);
}

/**
 * Parse egg distance from the CSS class on .pkmn-list-img (e.g. "egg7km" → "7 km").
 */
function parseEggDistance(li) {
  const imgDiv = li.querySelector(".pkmn-list-img");
  if (!imgDiv) return "unknown";
  for (const cls of imgDiv.classList) {
    const match = cls.match(/^egg(\d+)km$/);
    if (match) return `${match[1]} km`;
  }
  return "unknown";
}

// ---------------------------------------------------------------------------
// Section extractors
// ---------------------------------------------------------------------------

function extractSpawns(document) {
  const header = document.querySelector("h2#spawns");
  if (!header) return [];
  const lists = collectListsBetweenSections(header);
  const spawns = [];
  for (const list of lists) {
    spawns.push(...extractPokemonFromList(list));
  }
  return spawns;
}

function extractEventEggs(document) {
  const header = document.querySelector("h2#eggs");
  if (!header) return [];
  const lists = collectListsBetweenSections(header);
  const eggs = [];
  for (const list of lists) {
    for (const li of list.querySelectorAll("li.pkmn-list-item")) {
      const name = li.querySelector(".pkmn-name")?.textContent?.trim() ?? "";
      if (!name) continue;
      const canBeShiny = !!li.querySelector("img.shiny-icon");
      const eggDistance = parseEggDistance(li);
      eggs.push({ name, eggDistance, canBeShiny });
    }
  }
  return eggs;
}

function extractEventResearch(document) {
  const header = document.querySelector("h2#research");
  if (!header) return [];
  const listEl = findNextMatch(header, "ul.event-field-research-list");
  if (!listEl) return [];

  const tasks = [];
  for (const li of listEl.querySelectorAll("li")) {
    const task = li.querySelector(".task")?.textContent?.trim() ?? "";
    if (!task) continue;
    const rewards = Array.from(li.querySelectorAll(".reward"))
      .map((rewardEl) => {
        const name =
          rewardEl.querySelector(".reward-label span")?.textContent?.trim() ??
          "";
        const canBeShiny = !!rewardEl.querySelector("img.shiny-icon");
        return { name, canBeShiny };
      })
      .filter((r) => r.name.length > 0);
    if (rewards.length > 0) {
      tasks.push({ task, rewards });
    }
  }
  return tasks;
}

function extractRaidBosses(document) {
  const header = document.querySelector("h2#raids");
  if (!header) return [];
  const lists = collectListsBetweenSections(header);
  const bosses = [];
  for (const list of lists) {
    bosses.push(...extractPokemonFromList(list));
  }
  return bosses;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Parse an HTML string and extract all enrichment data.
 * Pure function — no network, deterministic, testable.
 *
 * @param {string} html — raw HTML of a LeekDuck event page
 * @returns {{ spawns, eventEggs, eventResearch, raidBosses }}
 */
export function scrapeEventPageHtml(html) {
  const dom = new JSDOM(html);
  const { document } = dom.window;

  return {
    spawns: extractSpawns(document),
    eventEggs: extractEventEggs(document),
    eventResearch: extractEventResearch(document),
    raidBosses: extractRaidBosses(document),
  };
}

/**
 * Fetch a LeekDuck event page and extract enrichment data.
 *
 * @param {string} url — full URL to a LeekDuck event page
 * @param {{ timeout?: number }} [options]
 * @returns {Promise<ReturnType<typeof scrapeEventPageHtml>>}
 */
export async function fetchAndScrapeEventPage(url, options = {}) {
  const timeout = options.timeout ?? 12000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    const html = await res.text();
    return scrapeEventPageHtml(html);
  } finally {
    clearTimeout(timer);
  }
}
