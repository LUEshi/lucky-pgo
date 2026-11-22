#!/usr/bin/env node
// Keep-or-trash evaluator.
//
//   node scripts/evaluate-keepers.mjs                       weekly report from the latest snapshot
//                                                           -> public/reports/keepers-latest.{json,md}
//   node scripts/evaluate-keepers.mjs --names "Passimian,Shadow Machamp"   ad-hoc check, prints only
//   node scripts/evaluate-keepers.mjs --check               only run the known-answer checks
//   add --refresh to ignore the 24h data cache
import fs from "node:fs/promises";
import path from "node:path";
import { LEAGUES, RULES, RULES_VERSION, TYPES } from "./lib/keeper-rules.mjs";
import { GOHUB_URL, parseGoHubTypePage } from "./lib/gohub-tiers.mjs";
import { collectWeeklyPokemon, LOOKAHEAD_DAYS } from "./lib/weekly-sources.mjs";
import {
  checkKnownAnswers,
  createEvaluator,
  describeBest,
  describeReason,
  evaluateWeekly,
  renderMarkdown,
} from "./lib/keeper-eval.mjs";

const PVPOKE = "https://pvpoke.com/data/rankings/all/overall";
const GAMEMASTER = "https://raw.githubusercontent.com/pvpoke/pvpoke/master/src/data/gamemaster/pokemon.json";
const CACHE_DIR = path.resolve(".cache/keepers");
const HISTORY_DIR = path.resolve("public/history");
const REPORT_DIR = path.resolve("public/reports");
const KNOWN_ANSWERS = path.resolve("scripts/keeper-known-answers.json");
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const KEEP_REPORTS = 8;
const USER_AGENT = "lucky-pgo keeper report (+https://github.com/LUEshi/lucky-pgo)";

function parseArgs(argv) {
  const args = { names: null, check: false, refresh: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--names") args.names = (argv[++i] ?? "").split(",").map((s) => s.trim()).filter(Boolean);
    else if (argv[i] === "--check") args.check = true;
    else if (argv[i] === "--refresh") args.refresh = true;
    else throw new Error(`Unknown argument: ${argv[i]}`);
  }
  return args;
}

async function cached(url, file, { refresh, as = "json" }) {
  const target = path.join(CACHE_DIR, file);
  if (!refresh) {
    try {
      const stat = await fs.stat(target);
      if (Date.now() - stat.mtimeMs < CACHE_TTL_MS) {
        const text = await fs.readFile(target, "utf8");
        return { body: as === "json" ? JSON.parse(text) : text, fetchedAt: stat.mtime.toISOString(), fromCache: true };
      }
    } catch {
      /* cache miss */
    }
  }
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
  const text = await res.text();
  await fs.mkdir(CACHE_DIR, { recursive: true });
  await fs.writeFile(target, text);
  return { body: as === "json" ? JSON.parse(text) : text, fetchedAt: new Date().toISOString(), fromCache: false };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function loadData(refresh) {
  const gm = await cached(GAMEMASTER, "pokemon.json", { refresh });
  const rankingsByLeague = {};
  let pvpokeFetchedAt = gm.fetchedAt;
  for (const l of LEAGUES) {
    const r = await cached(`${PVPOKE}/rankings-${l.cap}.json`, `rankings-${l.cap}.json`, { refresh });
    rankingsByLeague[l.key] = r.body;
    pvpokeFetchedAt = r.fetchedAt;
  }
  const goHubEntries = [];
  let goHubBuiltAt = null;
  for (const type of TYPES) {
    const page = await cached(GOHUB_URL(type), `gohub-${type}.html`, { refresh, as: "text" });
    const { builtAt, entries } = parseGoHubTypePage(page.body, type);
    goHubEntries.push(...entries);
    goHubBuiltAt = builtAt ?? goHubBuiltAt;
    if (!page.fromCache) await sleep(1000); // be polite to GO Hub
  }
  return { gamemaster: gm.body, rankingsByLeague, goHubEntries, pvpokeFetchedAt, goHubBuiltAt };
}

async function latestSnapshot() {
  const index = JSON.parse(await fs.readFile(path.join(HISTORY_DIR, "index.json"), "utf8"));
  const newest = [...index.snapshots].sort((a, b) => b.date.localeCompare(a.date))[0];
  if (!newest) throw new Error("No snapshots in public/history/index.json");
  return { snapshot: JSON.parse(await fs.readFile(path.join("public", newest.path), "utf8")), date: newest.date };
}

async function readJson(file, fallback) {
  try {
    return JSON.parse(await fs.readFile(file, "utf8"));
  } catch {
    return fallback;
  }
}

function printAdHoc(results) {
  for (const { name, res } of results) {
    if (!res) {
      console.log(`? ${name}: couldn't identify this Pokemon`);
      continue;
    }
    const label = `${res.shadow ? "Shadow " : ""}${res.name}`;
    console.log(`${res.verdict === "KEEP" ? "KEEP " : "TRASH"} ${label}`);
    for (const r of res.reasons) console.log(`       - ${describeReason(r)} (IVs: ${r.ivs})`);
    if (!res.reasons.length) console.log(`       - ${describeBest(res.best)}`);
  }
}

async function pruneReports() {
  const files = (await fs.readdir(REPORT_DIR)).filter((f) => /^keepers-\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort();
  for (const f of files.slice(0, Math.max(0, files.length - KEEP_REPORTS))) await fs.rm(path.join(REPORT_DIR, f));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const data = await loadData(args.refresh);
  const evaluator = createEvaluator(data);
  const knownAnswers = await readJson(KNOWN_ANSWERS, []);
  const mismatches = checkKnownAnswers(knownAnswers, evaluator);

  if (args.names) {
    printAdHoc(args.names.map((name) => ({ name, res: evaluator.evaluateName(name) })));
    return;
  }
  if (args.check) {
    if (!mismatches.length) console.log(`All ${knownAnswers.length} known answers match.`);
    for (const m of mismatches) console.log(`MISMATCH ${m.shadow ? "Shadow " : ""}${m.name}: expected ${m.expect}, got ${m.got}`);
    if (evaluator.unmatchedGoHub.length) console.log(`GO Hub names not identified: ${evaluator.unmatchedGoHub.join(", ")}`);
    process.exitCode = mismatches.length ? 1 : 0;
    return;
  }

  const { snapshot, date: snapshotDate } = await latestSnapshot();
  const ageDays = (Date.now() - new Date(snapshotDate).getTime()) / 86_400_000;
  if (ageDays > 3) console.warn(`Warning: latest snapshot is ${Math.floor(ageDays)} days old.`);

  const { pokemon, unmatched } = evaluateWeekly(collectWeeklyPokemon(snapshot, { lookaheadDays: LOOKAHEAD_DAYS }), evaluator);
  const previous = await readJson(path.join(REPORT_DIR, "keepers-latest.json"), null);
  const keepKey = (p) => `${p.shadow ? "Shadow " : ""}${p.name}`;
  const nowKeeps = new Set(pokemon.filter((p) => p.verdict === "KEEP").map(keepKey));
  const prevKeeps = new Set((previous?.pokemon ?? []).filter((p) => p.verdict === "KEEP").map(keepKey));
  const today = new Date().toISOString().slice(0, 10);

  const report = {
    generatedAt: new Date().toISOString(),
    weekOf: today,
    rules: { version: RULES_VERSION, ...RULES, lookaheadDays: LOOKAHEAD_DAYS },
    data: {
      snapshotDate,
      pvpokeFetchedAt: data.pvpokeFetchedAt,
      goHubBuiltAt: data.goHubBuiltAt,
      sources: ["PvPoke (pvpoke.com)", "Pokemon GO Hub (db.pokemongohub.net)", "LeekDuck via ScrapedDuck"],
    },
    // Comparing across a rules change would just list the rule change, so skip it then.
    changes: previous && previous.weekOf !== today && previous.rules?.version === RULES_VERSION
      ? { since: previous.weekOf, newKeeps: [...nowKeeps].filter((n) => !prevKeeps.has(n)), droppedKeeps: [...prevKeeps].filter((n) => !nowKeeps.has(n)) }
      : previous?.rules?.version === RULES_VERSION ? previous?.changes ?? null : null,
    pokemon,
    unmatched,
    unmatchedGoHub: evaluator.unmatchedGoHub,
    knownAnswerMismatches: mismatches.map(({ name, shadow, expect, got, why }) => ({ name, shadow: !!shadow, expect, got, why })),
  };

  const markdown = renderMarkdown(report);
  await fs.mkdir(REPORT_DIR, { recursive: true });
  await fs.writeFile(path.join(REPORT_DIR, "keepers-latest.json"), JSON.stringify(report, null, 2) + "\n");
  await fs.writeFile(path.join(REPORT_DIR, `keepers-${today}.json`), JSON.stringify(report, null, 2) + "\n");
  await fs.writeFile(path.join(REPORT_DIR, "keepers-latest.md"), markdown);
  await pruneReports();
  console.log(markdown);
  console.error(`Wrote public/reports/keepers-latest.{json,md} and keepers-${today}.json`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
