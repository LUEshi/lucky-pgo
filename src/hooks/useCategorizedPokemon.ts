import { useMemo } from "react";
import type { PriorityPokemon, PrioritySource } from "../types";

export type Category = "raids" | "wild" | "rocket" | "eggs";

export interface CategorizedPokemon {
  name: string;
  sources: PrioritySource[];
}

export const categoryOrder: Category[] = ["raids", "wild", "rocket", "eggs"];

const categorySourceTypes: Record<Category, string[]> = {
  raids: ["raid", "shadow-raid", "upcoming-raid"],
  wild: ["event", "research", "upcoming"],
  rocket: ["rocket"],
  eggs: ["egg"],
};

// Parse "X km" to number for sorting
function eggDistance(sources: PrioritySource[]): number {
  for (const s of sources) {
    if (s.type === "egg") {
      const match = s.label.match(/(\d+)/);
      if (match) return parseInt(match[1], 10);
    }
  }
  return 999;
}

export function useCategorizedPokemon(priorities: PriorityPokemon[]) {
  return useMemo(() => {
    const result: Record<Category, CategorizedPokemon[]> = {
      raids: [],
      wild: [],
      rocket: [],
      eggs: [],
    };

    for (const p of priorities) {
      for (const cat of categoryOrder) {
        const matchingSources = p.sources.filter((s) =>
          categorySourceTypes[cat].includes(s.type),
        );
        if (matchingSources.length > 0) {
          result[cat].push({ name: p.name, sources: matchingSources });
        }
      }
    }

    // Sort eggs by distance (shortest first)
    result.eggs.sort((a, b) => eggDistance(a.sources) - eggDistance(b.sources));

    return result;
  }, [priorities]);
}
