import type {
  Pokemon,
  ScrapedDuckData,
  PriorityPokemon,
} from "../types";
import { pokemonMatches, baseName, normalizeName } from "./pokemonMatcher";
import { partitionEventsByTime } from "./eventFilters";

interface ScoreOptions {
  includeUpcoming?: boolean;
}

function tierScore(tier: string): number {
  if (tier.includes("Mega") || tier.includes("5")) return 5;
  if (tier.includes("3")) return 4;
  if (tier.includes("1")) return 3;
  return 3;
}

function formatDateRange(startIso: string, endIso: string): string {
  const start = new Date(startIso);
  const end = new Date(endIso);

  const sameYear = start.getFullYear() === end.getFullYear();
  const startLabel = start.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  });
  const endLabel = end.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  return `${startLabel} - ${endLabel}`;
}

/**
 * Index of missing Pokemon by normalized name for O(1) lookup.
 * Falls back to linear scan for fuzzy matches (e.g. "Alolan Vulpix" → "Vulpix").
 */
function buildMissingIndex(missing: Pokemon[]) {
  const byName = new Map<string, Pokemon>();
  for (const p of missing) {
    byName.set(normalizeName(p.name), p);
  }

  return function findMatch(sourceName: string): Pokemon | undefined {
    const normalized = normalizeName(sourceName);
    // Fast path: exact normalized match
    const exact = byName.get(normalized);
    if (exact) return exact;
    // Slow path: fuzzy match (handles form prefixes, etc.)
    return missing.find((p) => pokemonMatches(p.name, sourceName));
  };
}

export function scorePokemon(
  luckyList: Pokemon[],
  data: ScrapedDuckData,
  options: ScoreOptions = {},
): PriorityPokemon[] {
  const includeUpcoming = options.includeUpcoming ?? true;
  const now = new Date();
  const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const currentAsOf = now.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  const missing = luckyList.filter((p) => !p.isLucky);
  const findMatch = buildMissingIndex(missing);

  const priorityMap = new Map<number, PriorityPokemon>();

  function getOrCreate(pokemon: Pokemon): PriorityPokemon {
    let entry = priorityMap.get(pokemon.dexNumber);
    if (!entry) {
      entry = {
        name: pokemon.name,
        normalizedName: pokemon.name.toLowerCase(),
        score: 0,
        sources: [],
      };
      priorityMap.set(pokemon.dexNumber, entry);
    }
    return entry;
  }

  // Score raid bosses
  for (const raid of data.raids) {
    const match = findMatch(baseName(raid.name));
    if (!match) continue;
    const entry = getOrCreate(match);
    const isShadow =
      raid.tier.toLowerCase().includes("shadow") ||
      raid.name.toLowerCase().startsWith("shadow ");
    const points = isShadow ? 2 : tierScore(raid.tier);
    entry.score += points;
    entry.sources.push({
      type: isShadow ? "shadow-raid" : "raid",
      label: isShadow ? `Shadow ${raid.tier}` : raid.tier,
      detail: raid.name,
    });
  }

  // Score active event spawns
  const { active: activeEvents, upcoming: upcomingEvents } = partitionEventsByTime(
    data.events,
    now,
    sevenDaysFromNow,
  );

  for (const event of activeEvents) {
    if (!event.extraData?.generic?.hasSpawns) continue;
    const bosses = event.extraData?.raidbattles?.bosses ?? [];
    for (const boss of bosses) {
      const match = findMatch(baseName(boss.name));
      if (!match) continue;
      const entry = getOrCreate(match);
      entry.score += 4;
      entry.sources.push({
        type: "event",
        label: "Event",
        detail: event.name,
      });
    }
  }

  // Score upcoming events — distinguish raid events from spawn events
  if (includeUpcoming) {
    for (const event of upcomingEvents) {
      const isRaidEvent =
        event.eventType === "raid-day" ||
        event.eventType === "raid-battles" ||
        event.eventType === "raid-hour" ||
        event.name.toLowerCase().includes("raid");
      const bosses = event.extraData?.raidbattles?.bosses ?? [];
      for (const boss of bosses) {
        const match = findMatch(baseName(boss.name));
        if (!match) continue;
        const entry = getOrCreate(match);
        entry.score += 1;
        entry.sources.push({
          type: isRaidEvent ? "upcoming-raid" : "upcoming",
          label: "Upcoming",
          detail: event.name,
          availability: formatDateRange(event.start, event.end),
        });
      }
    }
  }

  // Score research rewards
  for (const task of data.research) {
    for (const reward of task.rewards) {
      const match = findMatch(baseName(reward.name));
      if (!match) continue;
      const entry = getOrCreate(match);
      entry.score += 2;
      entry.sources.push({
        type: "research",
        label: "Research",
        detail: task.text,
        availability: `Current as of ${currentAsOf} (range not published)`,
      });
    }
  }

  // Score egg Pokemon
  for (const egg of data.eggs) {
    const match = findMatch(baseName(egg.name));
    if (!match) continue;
    const entry = getOrCreate(match);
    const hasSameEggSource = entry.sources.some(
      (source) => source.type === "egg" && source.label === egg.eggType,
    );
    if (hasSameEggSource) continue;
    entry.score += 1;
    entry.sources.push({
      type: "egg",
      label: egg.eggType,
      detail: egg.name,
      availability: `Current as of ${currentAsOf} (range not published)`,
    });
  }

  // Score Team Rocket Pokemon (only encounter-eligible ones matter for trading)
  for (const lineup of data.rockets) {
    const allSlots = Array.from(
      new Map(
        [
          ...lineup.firstPokemon,
          ...lineup.secondPokemon,
          ...lineup.thirdPokemon,
        ].map((p) => [p.name, p]),
      ).values(),
    );

    const encounters = allSlots.filter((p) => p.isEncounter);
    for (const rocketMon of encounters) {
      const match = findMatch(baseName(rocketMon.name));
      if (!match) continue;
      const entry = getOrCreate(match);
      const isLeader =
        lineup.title.includes("Leader") || lineup.title.includes("Boss");
      entry.score += isLeader ? 2 : 1;
      entry.sources.push({
        type: "rocket",
        label: isLeader ? lineup.name : `Rocket ${lineup.type || "Grunt"}`,
        detail: `${lineup.title}: ${lineup.name}`,
        availability: `Current as of ${currentAsOf} (range not published)`,
      });
    }
  }

  return Array.from(priorityMap.values())
    .filter((p) => p.score > 0)
    .sort((a, b) => b.score - a.score);
}
