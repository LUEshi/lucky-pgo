import test from "node:test";
import assert from "node:assert/strict";
import type { ScrapedDuckEvent } from "../src/types/index.js";
import {
  mergeEventEnrichment,
  shouldIncludeOverlayEvent,
} from "../src/utils/eventOverlay.js";

function makeEvent(overrides: Partial<ScrapedDuckEvent> = {}): ScrapedDuckEvent {
  return {
    eventID: "event-1",
    name: "Event 1",
    eventType: "event",
    heading: "Event",
    link: "https://leekduck.com/events/event-1/",
    image: "",
    start: "2026-02-01T10:00:00.000Z",
    end: "2026-02-05T10:00:00.000Z",
    ...overrides,
  };
}

test("overlay inclusion accepts raid-only enrichment", () => {
  const raidOnly = makeEvent({
    extraData: {
      raidbattles: {
        bosses: [{ name: "Mewtwo", image: "", canBeShiny: false }],
        shinies: [],
      },
    },
  });

  assert.equal(shouldIncludeOverlayEvent(raidOnly), true);
});

test("merge overlays generic enrichment by eventID", () => {
  const liveEvents = [
    makeEvent({
      eventID: "event-1",
      extraData: { generic: { hasSpawns: true } },
    }),
  ];

  const overlay = new Map<string, ScrapedDuckEvent["extraData"]>([
    [
      "event-1",
      {
        generic: {
          spawns: [{ name: "Pikachu", canBeShiny: true }],
        },
      },
    ],
  ]);

  const merged = mergeEventEnrichment(liveEvents, overlay);
  assert.equal(merged[0].extraData?.generic?.spawns?.[0].name, "Pikachu");
  assert.equal(merged[0].extraData?.generic?.hasSpawns, true);
});

test("merge overlays raidbattles when live event has no bosses", () => {
  const liveEvents = [makeEvent({ eventID: "event-2" })];
  const overlay = new Map<string, ScrapedDuckEvent["extraData"]>([
    [
      "event-2",
      {
        raidbattles: {
          bosses: [{ name: "Lugia", image: "", canBeShiny: true }],
          shinies: [],
        },
      },
    ],
  ]);

  const merged = mergeEventEnrichment(liveEvents, overlay);
  assert.equal(merged[0].extraData?.raidbattles?.bosses?.[0].name, "Lugia");
});
