import test from "node:test";
import assert from "node:assert/strict";
import {
  buildPvpRanks,
  buildSpeciesIndex,
  computePveProxies,
  evaluateSpecies,
  familyMembers,
  speciesKey,
  wildNamesFromSnapshot,
} from "../scripts/lib/keeper-eval.mjs";

const mon = (speciesId, speciesName, atk, def, hp, types, family) => ({
  speciesId,
  speciesName,
  baseStats: { atk, def, hp },
  types,
  released: true,
  family,
});

const gamemaster = [
  mon("vulpix", "Vulpix", 100, 100, 100, ["fire"], { id: "F_V", evolutions: ["ninetales"] }),
  mon("ninetales", "Ninetales", 150, 150, 150, ["fire"], { id: "F_V" }),
  mon("vulpix_alolan", "Vulpix (Alolan)", 100, 100, 100, ["ice"], { id: "F_V", evolutions: ["ninetales_alolan"] }),
  mon("ninetales_alolan", "Ninetales (Alolan)", 160, 160, 160, ["ice"], { id: "F_V" }),
  mon("junkmon", "Junkmon", 50, 50, 50, ["normal"], { id: "F_J" }),
  mon("ninetales_shadow", "Ninetales (Shadow)", 150, 150, 150, ["fire"], { id: "F_V" }),
];

const rankings = {
  great: [{ speciesId: "ninetales_shadow", score: 99 }, { speciesId: "ninetales_alolan", score: 90 }, { speciesId: "ninetales", score: 80 }],
  ultra: [],
  master: [],
};

test("speciesKey handles regional prefixes and suffixes", () => {
  assert.equal(speciesKey("Alolan Vulpix"), speciesKey("Vulpix (Alolan)"));
  assert.notEqual(speciesKey("Vulpix"), speciesKey("Alolan Vulpix"));
  assert.equal(speciesKey("Mr. Mime"), "mrmime");
});

test("evolution line follows explicit links, not other regional forms", () => {
  const ids = familyMembers(gamemaster[2], gamemaster).map((p) => p.speciesId).sort();
  assert.deepEqual(ids, ["ninetales_alolan", "vulpix_alolan"]);
});

test("shadow entries are ignored when ranking", () => {
  const pvp = buildPvpRanks(rankings);
  assert.equal(pvp.great.ranks.get("ninetales_alolan").rank, 1);
  assert.equal(pvp.great.ranks.has("ninetales_shadow"), false);
});

test("verdicts: keep via evolution rank, junk when nothing qualifies", () => {
  const ctx = { gamemaster, pvp: buildPvpRanks(rankings), pve: computePveProxies(gamemaster) };
  const index = buildSpeciesIndex(gamemaster);
  const vulpix = evaluateSpecies(index.get(speciesKey("Alolan Vulpix")), ctx);
  assert.equal(vulpix.verdict, "KEEP");
  assert.match(vulpix.keepReasons[0], /Great League #1 \(as Ninetales \(Alolan\)\)/);

  const junk = evaluateSpecies(index.get(speciesKey("Junkmon")), {
    ...ctx,
    thresholds: { pvpKeep: { great: 0, ultra: 0, master: 0 }, pvpMaybe: { great: 0, ultra: 0, master: 0 }, attackerOverallTop: 0, attackerTypeTop: 0, defenderTop: 0 },
  });
  assert.equal(junk.verdict, "JUNK");
});

test("wild names only come from active events unless upcoming requested", () => {
  const snapshot = {
    data: {
      events: [
        { name: "Now", start: "2026-11-20T00:00:00", end: "2026-11-25T00:00:00", extraData: { generic: { spawns: [{ name: "Passimian" }] } } },
        { name: "Later", start: "2026-12-01T00:00:00", end: "2026-12-02T00:00:00", extraData: { generic: { spawns: [{ name: "Ralts" }] } } },
      ],
    },
  };
  const now = new Date("2026-11-21T12:00:00");
  assert.deepEqual([...wildNamesFromSnapshot(snapshot, { now }).keys()], ["Passimian"]);
  assert.deepEqual([...wildNamesFromSnapshot(snapshot, { now, includeUpcoming: true }).keys()].sort(), ["Passimian", "Ralts"]);
});
