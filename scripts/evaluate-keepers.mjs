#!/usr/bin/env node
// Weekly "keep or junk" evaluator.
//
// Usage:
//   node scripts/evaluate-keepers.mjs                      # this week's wild spawns from the latest snapshot
//   node scripts/evaluate-keepers.mjs --upcoming           # include upcoming events too
//   node scripts/evaluate-keepers.mjs --names "Passimian,Alolan Vulpix"
//   node scripts/evaluate-keepers.mjs --refresh            # ignore the 24h data cache
import fs from "node:fs/promises";
import path from "node:path";
import {
  LEAGUES,
  buildPvpRanks,
  buildSpeciesIndex,
  computePveProxies,
  evaluateSpecies,
  renderReport,
  speciesKey,
  wildNamesFromSnapshot,
} from "./lib/keeper-eval.mjs";

const PVPOKE = "https://pvpoke.com/data/rankings/all/overall";
const GAMEMASTER = "https://raw.githubusercontent.com/pvpoke/pvpoke/master/src/data/gamemaster/pokemon.json";
const CACHE_DIR = path.resolve(".cache/keepers");
const HISTORY_DIR = path.resolve("public/history");
const REPORT_DIR = path.resolve("reports");
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

function parseArgs(argv) {
  const args = { names: null, upcoming: false, refresh: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--names") args.names = argv[++i].split(",").map((s) => s.trim()).filter(Boolean);
    else if (argv[i] === "--upcoming") args.upcoming = true;
    else if (argv[i] === "--refresh") args.refresh = true;
    else throw new Error(`Unknown argument: ${argv[i]}`);
  }
  return args;
}

async function cachedJson(url, file, refresh) {
  const target = path.join(CACHE_DIR, file);
  if (!refresh) {
    try {
      const stat = await fs.stat(target);
      if (Date.now() - stat.mtimeMs < CACHE_TTL_MS) return JSON.parse(await fs.readFile(target, "utf8"));
    } catch {
      /* cache miss */
    }
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
  const data = await res.json();
  await fs.mkdir(CACHE_DIR, { recursive: true });
  await fs.writeFile(target, JSON.stringify(data));
  return data;
}

async function latestSnapshot() {
  const index = JSON.parse(await fs.readFile(path.join(HISTORY_DIR, "index.json"), "utf8"));
  const newest = [...index.snapshots].sort((a, b) => b.date.localeCompare(a.date))[0];
  if (!newest) throw new Error("No snapshots in public/history/index.json");
  const snapshot = JSON.parse(await fs.readFile(path.join("public", newest.path), "utf8"));
  return { snapshot, date: newest.date };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const [gamemaster, ...rankings] = await Promise.all([
    cachedJson(GAMEMASTER, "pokemon.json", args.refresh),
    ...LEAGUES.map((l) => cachedJson(`${PVPOKE}/rankings-${l.cap}.json`, `rankings-${l.cap}.json`, args.refresh)),
  ]);
  const pvp = buildPvpRanks(Object.fromEntries(LEAGUES.map((l, i) => [l.key, rankings[i]])));
  const pve = computePveProxies(gamemaster);
  const index = buildSpeciesIndex(gamemaster);
  const ctx = { gamemaster, pvp, pve };

  let candidates; // name -> events[]
  let source;
  if (args.names) {
    candidates = new Map(args.names.map((n) => [n, []]));
    source = "names passed on the command line";
  } else {
    const { snapshot, date } = await latestSnapshot();
    const wild = wildNamesFromSnapshot(snapshot, { includeUpcoming: args.upcoming });
    candidates = new Map([...wild].map(([n, evs]) => [n, [...evs]]));
    source = `wild spawns from snapshot ${date}${args.upcoming ? " (incl. upcoming events)" : " (active events)"}`;
    const age = (Date.now() - new Date(date).getTime()) / 86_400_000;
    if (age > 3) console.warn(`Warning: latest snapshot is ${Math.floor(age)} days old; the spawn list may be stale.`);
  }

  const results = [];
  const unmatched = [];
  for (const [name, events] of candidates) {
    const species = index.get(speciesKey(name));
    if (!species) {
      unmatched.push(name);
      continue;
    }
    results.push({ ...evaluateSpecies(species, ctx), events });
  }

  const date = new Date().toISOString().slice(0, 10);
  let report = renderReport(results, { date, source });
  if (unmatched.length) report += `\n## Unmatched names (${unmatched.length})\n\n${unmatched.map((n) => `- ${n}`).join("\n")}\n`;
  console.log(report);

  if (!args.names) {
    await fs.mkdir(REPORT_DIR, { recursive: true });
    await fs.writeFile(path.join(REPORT_DIR, `${date}.md`), report);
    await fs.writeFile(path.join(REPORT_DIR, "latest.md"), report);
    console.error(`Wrote reports/${date}.md and reports/latest.md`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
