import type {
  Pokemon,
  ScrapedDuckData,
  PriorityPokemon,
} from "../types";
import { pokemonMatches, baseName, normalizeName } from "./pokemonMatcher.js";
import { partitionEventsByTime } from "./eventFilters.js";

interface ScoreOptions {
  includeUpcoming?: boolean;
  partnerDex?: Set<number> | null;
}

type NeededBy = PriorityPokemon["neededBy"];

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

function neededByRank(neededBy: NeededBy): number {
  if (neededBy === "both") return 0;
  if (neededBy === "you" || neededBy === undefined) return 1;
  return 2;
}

function buildMissingPool(
  luckyList: Pokemon[],
  partnerDex: Set<number> | null,
): {
  missingPokemon: Pokemon[];
  userMissingDex: Set<number>;
  partnerMissingDex: Set<number> | null;
  hasPartner: boolean;
} {
  const userMissing = luckyList.filter((p) => !p.isLucky);
  const userMissingDex = new Set(userMissing.map((p) => p.dexNumber));

  if (!partnerDex) {
    return {
      missingPokemon: userMissing,
      userMissingDex,
      partnerMissingDex: null,
      hasPartner: false,
    };
  }

  const byDex = new Map<number, Pokemon>();
  for (const pokemon of luckyList) {
    byDex.set(pokemon.dexNumber, pokemon);
  }

  const partnerMissingDex = new Set<number>();
  for (const pokemon of luckyList) {
    if (!partnerDex.has(pokemon.dexNumber)) {
      partnerMissingDex.add(pokemon.dexNumber);
    }
  }

  const unionDex = new Set<number>([
    ...Array.from(userMissingDex),
    ...Array.from(partnerMissingDex),
  ]);
  const missingPokemon = Array.from(unionDex).map((dexNumber) => {
    const existing = byDex.get(dexNumber);
    if (existing) return existing;
    return {
      dexNumber,
      name: `Pokemon ${dexNumber}`,
      isLucky: false,
    } as Pokemon;
  });

  return {
    missingPokemon,
    userMissingDex,
    partnerMissingDex,
    hasPartner: true,
  };
}

function classifyNeededBy(
  dexNumber: number,
  userMissingDex: Set<number>,
  partnerMissingDex: Set<number> | null,
): NeededBy {
  if (!partnerMissingDex) return undefined;

  const userNeeds = userMissingDex.has(dexNumber);
  const partnerNeeds = partnerMissingDex.has(dexNumber);
  if (userNeeds && partnerNeeds) return "both";
  if (userNeeds) return "you";
  return "partner";
}

export function scorePokemon(
  luckyList: Pokemon[],
  data: ScrapedDuckData,
  options: ScoreOptions = {},
): PriorityPokemon[] {
  const includeUpcoming = options.includeUpcoming ?? true;
  const partnerDex = options.partnerDex ?? null;
  const now = new Date();
  const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const { missingPokemon, userMissingDex, partnerMissingDex, hasPartner } =
    buildMissingPool(luckyList, partnerDex);
  const findMatch = buildMissingIndex(missingPokemon);

  const priorityMap = new Map<number, PriorityPokemon>();

  function getOrCreate(pokemon: Pokemon): PriorityPokemon {
    const neededBy = classifyNeededBy(
      pokemon.dexNumber,
      userMissingDex,
      partnerMissingDex,
    );
    let entry = priorityMap.get(pokemon.dexNumber);
    if (!entry) {
      entry = {
        name: pokemon.name,
        normalizedName: pokemon.name.toLowerCase(),
        score: 0,
        sources: [],
        ...(hasPartner ? { neededBy } : {}),
      };
      priorityMap.set(pokemon.dexNumber, entry);
    } else if (hasPartner) {
      entry.neededBy = neededBy;
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

  // Dedupe: avoid double-scoring the same Pokemon from the same event + source type
  const seenEventSource = new Set<string>();
  function eventDedupKey(eventId: string, name: string, type: string): string {
    return `${eventId}:${normalizeName(name)}:${type}`;
  }

  for (const event of activeEvents) {
    const generic = event.extraData?.generic;

    // Use enriched spawns if available
    if (generic?.spawns && generic.spawns.length > 0) {
      for (const spawn of generic.spawns) {
        const key = eventDedupKey(event.eventID, spawn.name, "event");
        if (seenEventSource.has(key)) continue;
        const match = findMatch(baseName(spawn.name));
        if (!match) continue;
        seenEventSource.add(key);
        const entry = getOrCreate(match);
        entry.score += 4;
        entry.sources.push({
          type: "event",
          label: "Event",
          detail: event.name,
        });
      }
    } else if (generic?.hasSpawns) {
      // Fallback: use raidbattles.bosses when no enriched spawns
      const bosses = event.extraData?.raidbattles?.bosses ?? [];
      for (const boss of bosses) {
        const key = eventDedupKey(event.eventID, boss.name, "event");
        if (seenEventSource.has(key)) continue;
        const match = findMatch(baseName(boss.name));
        if (!match) continue;
        seenEventSource.add(key);
        const entry = getOrCreate(match);
        entry.score += 4;
        entry.sources.push({
          type: "event",
          label: "Event",
          detail: event.name,
        });
      }
    }

    // Use enriched event research if available
    if (generic?.eventResearch && generic.eventResearch.length > 0) {
      for (const task of generic.eventResearch) {
        for (const reward of task.rewards) {
          const key = eventDedupKey(event.eventID, reward.name, "research");
          if (seenEventSource.has(key)) continue;
          const match = findMatch(baseName(reward.name));
          if (!match) continue;
          seenEventSource.add(key);
          const entry = getOrCreate(match);
          entry.score += 2;
          entry.sources.push({
            type: "research",
            label: "Event Research",
            detail: `${event.name}: ${task.task}`,
          });
        }
      }
    }

    // Use enriched event eggs if available
    if (generic?.eventEggs && generic.eventEggs.length > 0) {
      for (const egg of generic.eventEggs) {
        const key = eventDedupKey(event.eventID, egg.name, `egg:${egg.eggDistance}`);
        if (seenEventSource.has(key)) continue;
        const match = findMatch(baseName(egg.name));
        if (!match) continue;
        seenEventSource.add(key);
        const entry = getOrCreate(match);
        const hasSameEggSource = entry.sources.some(
          (source) => source.type === "egg" && source.label === egg.eggDistance,
        );
        if (hasSameEggSource) continue;
        entry.score += 1;
        entry.sources.push({
          type: "egg",
          label: egg.eggDistance,
          detail: egg.name,
        });
      }
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
      const generic = event.extraData?.generic;

      // Upcoming enriched spawns
      if (generic?.spawns && generic.spawns.length > 0) {
        for (const spawn of generic.spawns) {
          const key = eventDedupKey(event.eventID, spawn.name, "upcoming");
          if (seenEventSource.has(key)) continue;
          const match = findMatch(baseName(spawn.name));
          if (!match) continue;
          seenEventSource.add(key);
          const entry = getOrCreate(match);
          entry.score += 1;
          entry.sources.push({
            type: isRaidEvent ? "upcoming-raid" : "upcoming",
            label: "Upcoming",
            detail: event.name,
            availability: formatDateRange(event.start, event.end),
            link: event.link,
          });
        }
      } else {
        // Fallback: upcoming raid bosses when enriched spawns are unavailable
        const bosses = event.extraData?.raidbattles?.bosses ?? [];
        for (const boss of bosses) {
          const key = eventDedupKey(event.eventID, boss.name, "upcoming");
          if (seenEventSource.has(key)) continue;
          const match = findMatch(baseName(boss.name));
          if (!match) continue;
          seenEventSource.add(key);
          const entry = getOrCreate(match);
          entry.score += 1;
          entry.sources.push({
            type: isRaidEvent ? "upcoming-raid" : "upcoming",
            label: "Upcoming",
            detail: event.name,
            availability: formatDateRange(event.start, event.end),
            link: event.link,
          });
        }
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
      });
    }
  }

  const scored = Array.from(priorityMap.values()).filter((p) => p.score > 0);
  if (!hasPartner) {
    return scored.sort((a, b) => b.score - a.score);
  }

  return scored.sort(
    (a, b) =>
      b.score - a.score ||
      neededByRank(a.neededBy) - neededByRank(b.neededBy) ||
      a.name.localeCompare(b.name),
  );
}
