import test from "node:test";
import assert from "node:assert/strict";
import { scorePokemon } from "../src/utils/priorityScorer.js";
import type { Pokemon, ScrapedDuckData, ScrapedDuckEvent, RaidBoss } from "../src/types/index.js";

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

// ---------------------------------------------------------------------------
// Enriched event scoring
// ---------------------------------------------------------------------------

function makeActiveEvent(overrides: Partial<ScrapedDuckEvent> = {}): ScrapedDuckEvent {
  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  return {
    eventID: "test-event",
    name: "Test Event",
    eventType: "event",
    heading: "Event",
    link: "https://leekduck.com/events/test-event/",
    image: "",
    start: yesterday.toISOString(),
    end: tomorrow.toISOString(),
    ...overrides,
  };
}

function makeEmptyData(): ScrapedDuckData {
  return { events: [], raids: [], research: [], eggs: [], rockets: [] };
}

function makeMissingList(count: number): Pokemon[] {
  return Array.from({ length: count }, (_, i) => ({
    dexNumber: i + 1,
    name: `Pokemon${i + 1}`,
    isLucky: false,
  }));
}

test("enriched event spawns score 4 pts each", () => {
  const list = makeMissingList(5);
  const data = makeEmptyData();
  data.events = [
    makeActiveEvent({
      extraData: {
        generic: {
          hasSpawns: true,
          spawns: [
            { name: "Pokemon1", canBeShiny: true },
            { name: "Pokemon3", canBeShiny: false },
          ],
        },
      },
    }),
  ];
  const result = scorePokemon(list, data, { includeUpcoming: false });
  const p1 = result.find((p) => p.name === "Pokemon1");
  const p3 = result.find((p) => p.name === "Pokemon3");
  assert.ok(p1);
  assert.equal(p1.score, 4);
  assert.equal(p1.sources[0].type, "event");
  assert.ok(p3);
  assert.equal(p3.score, 4);
});

test("enriched event eggs score 1 pt each", () => {
  const list = makeMissingList(5);
  const data = makeEmptyData();
  data.events = [
    makeActiveEvent({
      extraData: {
        generic: {
          eventEggs: [{ name: "Pokemon2", eggDistance: "7 km", canBeShiny: true }],
        },
      },
    }),
  ];
  const result = scorePokemon(list, data, { includeUpcoming: false });
  const p2 = result.find((p) => p.name === "Pokemon2");
  assert.ok(p2);
  assert.equal(p2.score, 1);
  assert.equal(p2.sources[0].type, "egg");
  assert.equal(p2.sources[0].label, "7 km");
});

test("enriched event research rewards score 2 pts each", () => {
  const list = makeMissingList(5);
  const data = makeEmptyData();
  data.events = [
    makeActiveEvent({
      extraData: {
        generic: {
          eventResearch: [
            { task: "Catch 5", rewards: [{ name: "Pokemon4", canBeShiny: false }] },
          ],
        },
      },
    }),
  ];
  const result = scorePokemon(list, data, { includeUpcoming: false });
  const p4 = result.find((p) => p.name === "Pokemon4");
  assert.ok(p4);
  assert.equal(p4.score, 2);
  assert.equal(p4.sources[0].type, "research");
  assert.equal(p4.sources[0].label, "Event Research");
});

test("falls back to raidbattles.bosses when no enriched spawns", () => {
  const list = makeMissingList(5);
  const data = makeEmptyData();
  data.events = [
    makeActiveEvent({
      extraData: {
        generic: { hasSpawns: true },
        raidbattles: {
          bosses: [{ name: "Pokemon1", image: "", canBeShiny: false }],
          shinies: [],
        },
      },
    }),
  ];
  const result = scorePokemon(list, data, { includeUpcoming: false });
  const p1 = result.find((p) => p.name === "Pokemon1");
  assert.ok(p1);
  assert.equal(p1.score, 4);
});

test("no duplicate scoring when enriched spawns exist alongside bosses", () => {
  const list = makeMissingList(5);
  const data = makeEmptyData();
  data.events = [
    makeActiveEvent({
      extraData: {
        generic: {
          hasSpawns: true,
          spawns: [{ name: "Pokemon1", canBeShiny: true }],
        },
        raidbattles: {
          bosses: [{ name: "Pokemon1", image: "", canBeShiny: false }],
          shinies: [],
        },
      },
    }),
  ];
  const result = scorePokemon(list, data, { includeUpcoming: false });
  const p1 = result.find((p) => p.name === "Pokemon1");
  assert.ok(p1);
  // Only scored once from enriched spawns, not also from fallback bosses
  assert.equal(p1.score, 4);
  assert.equal(p1.sources.filter((s) => s.type === "event").length, 1);
});

test("combined enrichment scores stack correctly", () => {
  const list = makeMissingList(5);
  const data = makeEmptyData();
  data.events = [
    makeActiveEvent({
      extraData: {
        generic: {
          hasSpawns: true,
          spawns: [{ name: "Pokemon1", canBeShiny: true }],
          eventEggs: [{ name: "Pokemon1", eggDistance: "7 km", canBeShiny: true }],
          eventResearch: [
            { task: "Catch 5", rewards: [{ name: "Pokemon1", canBeShiny: true }] },
          ],
        },
      },
    }),
  ];
  const result = scorePokemon(list, data, { includeUpcoming: false });
  const p1 = result.find((p) => p.name === "Pokemon1");
  assert.ok(p1);
  // 4 (spawn) + 1 (egg) + 2 (research) = 7
  assert.equal(p1.score, 7);
});

test("upcoming uses enriched spawns and does not also score raid boss fallback", () => {
  const list = makeMissingList(5);
  const now = new Date();
  const soon = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const later = new Date(now.getTime() + 48 * 60 * 60 * 1000);

  const data = makeEmptyData();
  data.events = [
    {
      eventID: "upcoming-test",
      name: "Upcoming Event",
      eventType: "event",
      heading: "Event",
      link: "https://leekduck.com/events/upcoming-event/",
      image: "",
      start: soon.toISOString(),
      end: later.toISOString(),
      extraData: {
        generic: {
          spawns: [{ name: "Pokemon1", canBeShiny: false }],
        },
        raidbattles: {
          bosses: [{ name: "Pokemon2", image: "", canBeShiny: false }],
          shinies: [],
        },
      },
    },
  ];

  const result = scorePokemon(list, data, { includeUpcoming: true });
  const p1 = result.find((p) => p.name === "Pokemon1");
  const p2 = result.find((p) => p.name === "Pokemon2");

  assert.ok(p1);
  assert.equal(p1.score, 1);
  assert.equal(p1.sources.some((s) => s.type === "upcoming"), true);
  assert.equal(p2, undefined);
});
