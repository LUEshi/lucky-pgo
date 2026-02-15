import test from "node:test";
import assert from "node:assert/strict";
import { scorePokemon } from "../src/utils/priorityScorer.js";
import type { Pokemon, ScrapedDuckData, RaidBoss } from "../src/types/index.js";

function buildRaid(name: string): RaidBoss {
  return {
    name,
    tier: "3-Star Raids",
    canBeShiny: false,
    types: [],
    combatPower: {
      normal: { min: 1, max: 1 },
      boosted: { min: 1, max: 1 },
    },
    boostedWeather: [],
    image: "",
  };
}

function buildData(): ScrapedDuckData {
  return {
    events: [],
    raids: [buildRaid("Bulbasaur"), buildRaid("Ivysaur"), buildRaid("Venusaur")],
    research: [],
    eggs: [],
    rockets: [],
  };
}

function buildLuckyList(): Pokemon[] {
  return [
    { dexNumber: 1, name: "Bulbasaur", isLucky: false },
    { dexNumber: 2, name: "Ivysaur", isLucky: false },
    { dexNumber: 3, name: "Venusaur", isLucky: true },
  ];
}

test("no partner keeps neededBy undefined and baseline ordering", () => {
  const result = scorePokemon(buildLuckyList(), buildData(), {
    includeUpcoming: false,
  });

  assert.deepEqual(
    result.map((p) => p.name),
    ["Bulbasaur", "Ivysaur"],
  );
  assert.equal(result.every((p) => p.neededBy === undefined), true);
});

test("classifies entries as both, you, and partner with partnerDex", () => {
  const result = scorePokemon(buildLuckyList(), buildData(), {
    includeUpcoming: false,
    partnerDex: new Set<number>([1]), // partner has only Bulbasaur
  });
  const byName = new Map(result.map((entry) => [entry.name, entry]));

  assert.equal(byName.get("Bulbasaur")?.neededBy, "you");
  assert.equal(byName.get("Ivysaur")?.neededBy, "both");
  assert.equal(byName.get("Venusaur")?.neededBy, "partner");
});

test("partner mode does not change base score values", () => {
  const baseline = scorePokemon(buildLuckyList(), buildData(), {
    includeUpcoming: false,
  });
  const withPartner = scorePokemon(buildLuckyList(), buildData(), {
    includeUpcoming: false,
    partnerDex: new Set<number>([1]),
  });

  const baselineByName = new Map(baseline.map((entry) => [entry.name, entry.score]));
  for (const entry of withPartner) {
    if (baselineByName.has(entry.name)) {
      assert.equal(entry.score, baselineByName.get(entry.name));
    }
  }
});

test("sorts within the same score tier as both > you > partner", () => {
  const result = scorePokemon(buildLuckyList(), buildData(), {
    includeUpcoming: false,
    partnerDex: new Set<number>([1]),
  });

  assert.deepEqual(
    result.map((entry) => entry.name),
    ["Ivysaur", "Bulbasaur", "Venusaur"],
  );
});
