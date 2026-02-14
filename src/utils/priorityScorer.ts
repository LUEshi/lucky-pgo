import type {
  Pokemon,
  ScrapedDuckData,
  PriorityPokemon,
} from "../types";
import { pokemonMatches, baseName } from "./pokemonMatcher";

function tierScore(tier: string): number {
  if (tier.includes("Mega") || tier.includes("5")) return 5;
  if (tier.includes("3")) return 4;
  if (tier.includes("1")) return 3;
  return 3;
}

export function scorePokemon(
  luckyList: Pokemon[],
  data: ScrapedDuckData,
): PriorityPokemon[] {
  const now = new Date();
  const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  // Only look at Pokemon we DON'T have lucky
  const missing = luckyList.filter((p) => !p.isLucky);

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
    const raidBase = baseName(raid.name);
    const isShadow = raid.tier.toLowerCase().includes("shadow");
    for (const pokemon of missing) {
      if (pokemonMatches(pokemon.name, raidBase)) {
        const entry = getOrCreate(pokemon);
        // Shadow raids score lower: need to purify + uses special trade
        const points = isShadow ? 2 : tierScore(raid.tier);
        entry.score += points;
        entry.sources.push({
          type: isShadow ? "shadow-raid" : "raid",
          label: isShadow ? `Shadow ${raid.tier}` : raid.tier,
          detail: raid.name,
        });
      }
    }
  }

  // Score active event spawns
  const activeEvents = data.events.filter((e) => {
    const start = new Date(e.start);
    const end = new Date(e.end);
    return start <= now && end >= now;
  });

  const upcomingEvents = data.events.filter((e) => {
    const start = new Date(e.start);
    return start > now && start <= sevenDaysFromNow;
  });

  for (const event of activeEvents) {
    if (!event.extraData?.generic?.hasSpawns) continue;
    const bosses = event.extraData?.raidbattles?.bosses ?? [];
    for (const boss of bosses) {
      const bossBase = baseName(boss.name);
      for (const pokemon of missing) {
        if (pokemonMatches(pokemon.name, bossBase)) {
          const entry = getOrCreate(pokemon);
          entry.score += 4;
          entry.sources.push({
            type: "event",
            label: "Event Spawn",
            detail: event.name,
          });
        }
      }
    }
  }

  // Score upcoming events — distinguish raid events from spawn events
  for (const event of upcomingEvents) {
    const isRaidEvent =
      event.eventType === "raid-day" ||
      event.eventType === "raid-battles" ||
      event.eventType === "raid-hour" ||
      event.name.toLowerCase().includes("raid");
    const bosses = event.extraData?.raidbattles?.bosses ?? [];
    for (const boss of bosses) {
      const bossBase = baseName(boss.name);
      for (const pokemon of missing) {
        if (pokemonMatches(pokemon.name, bossBase)) {
          const entry = getOrCreate(pokemon);
          entry.score += 1;
          entry.sources.push({
            type: isRaidEvent ? "upcoming-raid" : "upcoming",
            label: "Upcoming",
            detail: event.name,
          });
        }
      }
    }
  }

  // Score research rewards
  for (const task of data.research) {
    for (const reward of task.rewards) {
      const rewardBase = baseName(reward.name);
      for (const pokemon of missing) {
        if (pokemonMatches(pokemon.name, rewardBase)) {
          const entry = getOrCreate(pokemon);
          entry.score += 2;
          entry.sources.push({
            type: "research",
            label: "Research",
            detail: task.text,
          });
        }
      }
    }
  }

  // Score egg Pokemon
  for (const egg of data.eggs) {
    const eggBase = baseName(egg.name);
    for (const pokemon of missing) {
      if (pokemonMatches(pokemon.name, eggBase)) {
        const entry = getOrCreate(pokemon);
        entry.score += 1;
        entry.sources.push({
          type: "egg",
          label: egg.eggType,
          detail: egg.name,
        });
      }
    }
  }

  // Score Team Rocket Pokemon (only encounter-eligible ones matter for trading)
  for (const lineup of data.rockets) {
    const allSlots = [
      ...lineup.firstPokemon,
      ...lineup.secondPokemon,
      ...lineup.thirdPokemon,
    ];
    const encounters = allSlots.filter((p) => p.isEncounter);
    for (const rocketMon of encounters) {
      const rocketBase = baseName(rocketMon.name);
      for (const pokemon of missing) {
        if (pokemonMatches(pokemon.name, rocketBase)) {
          const entry = getOrCreate(pokemon);
          // Leaders/Giovanni are more notable
          const isLeader =
            lineup.title.includes("Leader") ||
            lineup.title.includes("Boss");
          entry.score += isLeader ? 2 : 1;
          entry.sources.push({
            type: "rocket",
            label: isLeader ? lineup.name : `Rocket ${lineup.type || "Grunt"}`,
            detail: `${lineup.title}: ${lineup.name}`,
          });
        }
      }
    }
  }

  return Array.from(priorityMap.values())
    .filter((p) => p.score > 0)
    .sort((a, b) => b.score - a.score);
}
