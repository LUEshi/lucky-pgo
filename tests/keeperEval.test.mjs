import test from "node:test";
import assert from "node:assert/strict";
import { checkKnownAnswers, createEvaluator, describeTiers, evaluateWeekly, renderMarkdown } from "../scripts/lib/keeper-eval.mjs";
import { createResolver, parseName } from "../scripts/lib/species-resolver.mjs";
import { parseGoHubTypePage } from "../scripts/lib/gohub-tiers.mjs";
import { collectWeeklyPokemon } from "../scripts/lib/weekly-sources.mjs";

const mon = (speciesId, speciesName, family, extra = {}) => ({
  speciesId,
  speciesName,
  dex: extra.dex ?? 1,
  baseStats: { atk: 100, def: 100, hp: 100 },
  types: ["normal"],
  released: true,
  family,
  ...extra,
});

const gamemaster = [
  mon("vulpix", "Vulpix", { id: "F_V", evolutions: ["ninetales"] }, { dex: 37 }),
  mon("ninetales", "Ninetales", { id: "F_V" }, { dex: 38 }),
  mon("vulpix_alolan", "Vulpix (Alolan)", { id: "F_V", evolutions: ["ninetales_alolan"] }, { dex: 37 }),
  mon("ninetales_alolan", "Ninetales (Alolan)", { id: "F_V" }, { dex: 38, eliteMoves: ["CHILLING_WATER"] }),
  mon("ralts", "Ralts", { id: "F_R", evolutions: ["gardevoir"] }, { dex: 280 }),
  mon("gardevoir", "Gardevoir", { id: "F_R" }, { dex: 282 }),
  mon("pidgey", "Pidgey", { id: "F_P", evolutions: ["pidgeot"] }, { dex: 16 }),
  mon("pidgeot", "Pidgeot", { id: "F_P" }, { dex: 18 }),
  mon("passimian", "Passimian", { id: "F_PA" }, { dex: 766 }),
  mon("landorus_therian", "Landorus (Therian)", { id: "F_L" }, { dex: 645 }),
  mon("darmanitan_standard", "Darmanitan (Standard)", { id: "F_D" }, { dex: 555 }),
  mon("darmanitan_galarian_standard", "Darmanitan (Galarian)", { id: "F_D" }, { dex: 555 }),
];

const fill = (n) => Array.from({ length: n }, (_, i) => ({ speciesId: `filler_${i}`, score: 50 }));
const rankingsByLeague = {
  // ninetales_alolan at rank 100 (kept), passimian at rank 101 (trash)
  great: [...fill(99), { speciesId: "ninetales_alolan", score: 80, moveset: ["POWDER_SNOW", "CHILLING_WATER"] }, { speciesId: "passimian", score: 70 }],
  ultra: [],
  master: [],
};

const goHubEntries = [
  { type: "fairy", tier: "S", rank: 4, name: "Shadow Gardevoir", fast: "Charm", charged: "Dazzling Gleam", legacy: [] },
  { type: "fairy", tier: "B", rank: 30, name: "Gardevoir", fast: "Charm", charged: "Dazzling Gleam", legacy: [] },
  { type: "flying", tier: "A", rank: 14, name: "Mega Pidgeot", fast: "Gust", charged: "Brave Bird", legacy: [] },
];

const dmaxEntries = [
  { type: "fairy", tier: "SS", rank: 1, name: "Dynamax Gardevoir", fast: "Charm", charged: "Max Starfall", legacy: [] },
  { type: "flying", tier: "S", rank: 2, name: "Gigantamax Pidgeot", fast: "Gust", charged: "G-Max Test", legacy: [] },
];

const evaluator = createEvaluator({ gamemaster, rankingsByLeague, goHubEntries, dmaxEntries });

test("resolver matches forms written differently across sites", () => {
  const r = createResolver(gamemaster);
  assert.equal(r.resolve("Alolan Vulpix").species.speciesId, "vulpix_alolan");
  assert.equal(r.resolve("Vulpix").species.speciesId, "vulpix");
  assert.equal(r.resolve("Therian Forme Landorus").species.speciesId, "landorus_therian");
  assert.equal(r.resolve("Darmanitan").species.speciesId, "darmanitan_standard");
  assert.equal(r.resolve("Galarian Standard Mode Darmanitan").species.speciesId, "darmanitan_galarian_standard");
  assert.equal(r.resolve("×500"), null);
  assert.deepEqual(parseName("Shadow Gardevoir"), { name: "Gardevoir", shadow: true, mega: false, gmax: false });
  assert.deepEqual(parseName("Mega Charizard Y"), { name: "Charizard", shadow: false, mega: true, gmax: false });
  assert.deepEqual(parseName("Gigantamax Machamp"), { name: "Machamp", shadow: false, mega: false, gmax: true });
});

test("PvP: rank 100 is a keep, rank 101 is trash; evolutions and special moves count", () => {
  const v = evaluator.evaluateName("Alolan Vulpix");
  assert.equal(v.verdict, "KEEP");
  assert.equal(v.reasons[0].rank, 100);
  assert.equal(v.reasons[0].via, "Ninetales (Alolan)");
  assert.deepEqual(v.reasons[0].specialMoves, ["Chilling Water"]);
  assert.equal(evaluator.evaluateName("Passimian").verdict, "TRASH");
  assert.equal(evaluator.evaluateName("Vulpix").verdict, "TRASH", "Kanto Vulpix must not inherit Alolan Ninetales");
});

test("PvE: shadow and regular forms are judged separately", () => {
  assert.equal(evaluator.evaluateName("Ralts", { shadow: true }).verdict, "KEEP");
  assert.equal(evaluator.evaluateName("Ralts").verdict, "TRASH", "regular Gardevoir is only B tier here");
});

test("PvE: Mega-only reasons give KEEP_ONE, and never apply to shadows", () => {
  assert.equal(evaluator.evaluateName("Pidgey").verdict, "KEEP_ONE");
  assert.equal(evaluator.evaluateName("Pidgey", { shadow: true }).verdict, "TRASH");
});

test("GO Hub parser carries tiers across rows and flags legacy moves", () => {
  const html = `<table>
    <tr><th>Sort: Tier</th><th>Sort: #</th><th>Sort: Pokémon</th><th>Sort: Fast Attack</th><th>Sort: Charged Attack</th><th>Sort: eDPS</th><th>Sort: DPS</th><th>Sort: TDO</th><th>Sort: TTW</th><th>Sort: Faints</th><th>Sort: % of best</th></tr>
    <tr><td>S</td><td>1.</td><td>Mega Delphox</td><td>Fire Spin</td><td>Mystical Fire+</td><td>33.7</td><td>36</td><td>980</td><td>410s</td><td>13</td><td>100%</td></tr>
    <tr><td>2.</td><td>Shadow Reshiram</td><td>Fire Fang</td><td>Fusion Flare</td><td>28.5</td><td>31</td><td>667</td><td>485s</td><td>20</td><td>84.7%</td></tr>
  </table><time datetime="2026-11-12T16:42:00.850Z"></time>`;
  const { builtAt, entries } = parseGoHubTypePage(html, "fire");
  assert.equal(builtAt, "2026-11-12T16:42:00.850Z");
  assert.equal(entries.length, 2);
  assert.equal(entries[1].tier, "S");
  assert.equal(entries[1].name, "Shadow Reshiram");
  assert.deepEqual(entries[0].legacy, ["Mystical Fire"]);
  assert.equal(entries[0].charged, "Mystical Fire");
});

test("weekly sources: every section by default, tagged by category; sources setting limits them", () => {
  const now = new Date("2026-11-21T12:00:00");
  const snapshot = {
    data: {
      raids: [{ name: "Shadow Ralts", tier: "1-Star Raids" }, { name: "Mega Pidgeot", tier: "Mega Raids" }],
      eggs: [{ name: "Vulpix", eggType: "5 km" }],
      research: [{ rewards: [{ name: "Passimian" }, { name: "×500" }] }],
      rockets: [{ name: "Fire Grunt", firstPokemon: [{ name: "Vulpix", isEncounter: true }], secondPokemon: [{ name: "Ninetales", isEncounter: false }] }],
      events: [
        { name: "Now", start: "2026-11-20T00:00:00", end: "2026-11-25T00:00:00", extraData: { generic: { spawns: [{ name: "Alolan Vulpix" }] } } },
        { name: "Soon", start: "2026-11-26T00:00:00", end: "2026-11-27T00:00:00", extraData: { spotlight: { list: [{ name: "Pidgey" }] } } },
        { name: "Too far", start: "2026-12-20T00:00:00", end: "2026-12-21T00:00:00", extraData: { generic: { spawns: [{ name: "Landorus" }] } } },
        { name: "Over", start: "2026-11-01T00:00:00", end: "2026-11-02T00:00:00", extraData: { generic: { spawns: [{ name: "Darmanitan" }] } } },
      ],
    },
  };
  const wildOnly = collectWeeklyPokemon(snapshot, { now, sources: ["wild"] }).map((f) => f.name).sort();
  assert.deepEqual(wildOnly, ["Alolan Vulpix", "Pidgey"], "sources setting limits categories");

  const found = collectWeeklyPokemon(snapshot, { now });
  const names = found.map((f) => `${f.shadow ? "S:" : ""}${f.name}`).sort();
  assert.deepEqual(names, ["Alolan Vulpix", "Mega Pidgeot", "Passimian", "Pidgey", "S:Shadow Ralts", "S:Vulpix", "Vulpix"]);

  const { pokemon } = evaluateWeekly(found, evaluator);
  const vulpix = pokemon.filter((p) => p.speciesId === "vulpix");
  assert.equal(vulpix.length, 2, "regular and shadow Vulpix are separate rows");
  const pidgey = pokemon.find((p) => p.speciesId === "pidgey");
  assert.deepEqual(pidgey.obtainedFrom, ["Spotlight Hour: Soon (starts 2026-11-26)"]);
  const pidgeot = pokemon.find((p) => p.speciesId === "pidgeot");
  assert.deepEqual(pidgeot.obtainedFrom, ["Raid: Mega Raids"], "Mega Pidgeot raid gives a regular Pidgeot");
});

test("Dynamax section uses the page's Max Battles list, else the boss in the event name", () => {
  const now = new Date("2026-11-21T12:00:00");
  const ev = (name, eventType, extraData = {}) => ({ name, eventType, start: "2026-11-21T00:00:00", end: "2026-11-24T00:00:00", extraData });
  const snapshot = {
    data: {
      events: [
        ev("Dynamax Trails", "event", { generic: { maxBattles: [{ name: "Beldum" }, { name: "Ralts" }] } }),
        ev("Dynamax Espurr during Max Monday", "max-mondays"),
        ev("Max Battle Day", "max-battles"),
      ],
    },
  };
  const dyn = collectWeeklyPokemon(snapshot, { now, sources: ["dynamax"] });
  assert.deepEqual(dyn.map((f) => f.name).sort(), ["Beldum", "Espurr", "Ralts"]);
  assert.ok(dyn.every((f) => f.category === "dynamax" && f.source.startsWith("Max Battle: ")));
});

test("known answers report mismatches", () => {
  const mismatches = checkKnownAnswers(
    [{ name: "Passimian", expect: "TRASH" }, { name: "Ralts", shadow: true, expect: "TRASH" }],
    evaluator,
  );
  assert.equal(mismatches.length, 1);
  assert.equal(mismatches[0].got, "KEEP");
});

test("markdown report renders every section", () => {
  const { pokemon, unmatched } = evaluateWeekly([
    { category: "wild", name: "Pidgey", source: "Wild: Event", shadow: false },
    { category: "wild", name: "Passimian", source: "Wild: Event", shadow: false },
    { category: "raids", name: "Pidgey", source: "Raid: 1-Star Raids", shadow: false },
  ], evaluator);
  const md = renderMarkdown({
    weekOf: "2026-11-21",
    rules: { version: 2, pvpTopRank: 100, pveKeepTiers: ["SS", "S", "A"] },
    data: { snapshotDate: "2026-11-21", pvpokeFetchedAt: "2026-11-21T00:00:00Z", goHubBuiltAt: "2026-11-12T00:00:00Z" },
    changes: null,
    pokemon,
    unmatched,
    knownAnswerMismatches: [],
  });
  assert.match(md, /## Wild — 0 keep · 1 keep one · 1 trash/);
  assert.match(md, /\*\*Trash:\*\* Passimian/);
  assert.match(md, /## Raids — 0 keep · 1 keep one · 0 trash/);
  assert.match(md, /- \*\*Pidgey\*\* — see Wild/, "repeat appearances point back to the first section");
});

test("tiers: raid and Max attacker tiers for the evolution line; none for shadow Max", () => {
  const ralts = evaluator.evaluateName("Ralts");
  assert.deepEqual(ralts.tiers.raid.map((t) => `${t.type} ${t.tier}`), ["fairy B"]);
  assert.deepEqual(ralts.tiers.max, [{ type: "fairy", tier: "SS", rank: 1, via: "Dynamax Gardevoir" }]);
  assert.deepEqual(evaluator.evaluateName("Ralts", { shadow: true }).tiers.max, [], "shadows can't Dynamax");
  const pidgey = evaluator.evaluateName("Pidgey");
  assert.equal(describeTiers(pidgey.tiers.max), "Flying S #2 (Gigantamax Pidgeot, Gigantamax only)");
  assert.equal(describeTiers([]), "not ranked");
});

test("Dynamax section lists raid and Max tiers on every line, trash included", () => {
  const { pokemon, unmatched } = evaluateWeekly([
    { category: "dynamax", name: "Ralts", source: "Max Battle: Trails", shadow: false },
    { category: "dynamax", name: "Passimian", source: "Max Battle: Trails", shadow: false },
  ], evaluator);
  const md = renderMarkdown({
    weekOf: "2026-11-22",
    rules: { version: 5, pvpTopRank: 100, pveKeepTiers: ["SS", "S", "A"] },
    data: { snapshotDate: "2026-11-22", pvpokeFetchedAt: "2026-11-22T00:00:00Z", goHubBuiltAt: null },
    changes: null,
    pokemon,
    unmatched,
    knownAnswerMismatches: [],
  });
  assert.match(md, /- \*\*Ralts\*\* ⚡ — Raid: Fairy B #30 \(Gardevoir\) · Max: Fairy SS #1 \(Dynamax Gardevoir\)/);
  assert.match(md, /- \*\*Passimian\*\* — Raid: not ranked · Max: not ranked/);
});

test("Max rule: SS/S Max tier makes a Dynamax catch a keep; Gigantamax-only and shadows don't count", () => {
  const ralts = evaluator.evaluateName("Ralts");
  assert.equal(ralts.verdict, "TRASH", "wild/raid verdict ignores Max tiers");
  assert.equal(ralts.dynamaxVerdict, "KEEP", "Dynamax Gardevoir is Fairy SS");
  assert.equal(ralts.maxReasons[0].via, "Dynamax Gardevoir");

  const pidgey = evaluator.evaluateName("Pidgey");
  assert.equal(pidgey.verdict, "KEEP_ONE");
  assert.equal(pidgey.dynamaxVerdict, "KEEP_ONE", "Gigantamax Pidgeot S tier needs a G-Max catch, so it doesn't count");

  assert.equal(evaluator.evaluateName("Ralts", { shadow: true }).dynamaxVerdict, "KEEP", "shadow keeps its raid-based verdict");
  assert.deepEqual(evaluator.evaluateName("Ralts", { shadow: true }).maxReasons, []);
});

test("Dynamax section groups by the Dynamax verdict and marks Max-only keeps", () => {
  const { pokemon, unmatched } = evaluateWeekly([
    { category: "dynamax", name: "Ralts", source: "Max Battle: Trails", shadow: false },
    { category: "wild", name: "Ralts", source: "Wild: Trails", shadow: false },
  ], evaluator);
  const md = renderMarkdown({
    weekOf: "2026-11-22",
    rules: { version: 5, pvpTopRank: 100, pveKeepTiers: ["SS", "S", "A"], maxKeepTiers: ["SS", "S"] },
    data: { snapshotDate: "2026-11-22", pvpokeFetchedAt: "2026-11-22T00:00:00Z", goHubBuiltAt: null },
    changes: null,
    pokemon,
    unmatched,
    knownAnswerMismatches: [],
  });
  assert.match(md, /## Wild — 0 keep · 0 keep one · 1 trash/);
  assert.match(md, /## Dynamax \(Max Battles\) — 1 keep · 0 keep one · 0 trash/);
  assert.match(md, /- \*\*Ralts\*\* ⚡ — Raid:/);
});
