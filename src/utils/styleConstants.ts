import type { PrioritySource } from "../types";
import type { Category } from "../hooks/useCategorizedPokemon";

export const categoryDisplay: Record<
  Category,
  { title: string; color: string }
> = {
  raids: { title: "Raids", color: "text-red-700" },
  wild: { title: "Wild / Events / Research", color: "text-green-700" },
  rocket: { title: "Team Rocket", color: "text-gray-700" },
  eggs: { title: "Eggs", color: "text-blue-700" },
};

// Badge colors for source type tags
export const sourceColors: Record<string, string> = {
  raid: "bg-red-100 text-red-800",
  "shadow-raid": "bg-purple-200 text-purple-900",
  "upcoming-raid": "bg-orange-100 text-orange-800",
  event: "bg-green-100 text-green-800",
  research: "bg-purple-100 text-purple-800",
  upcoming: "bg-yellow-100 text-yellow-800",
  rocket: "bg-gray-700 text-gray-100",
  egg: "bg-blue-100 text-blue-800",
};

// Card background by primary source type
export function cardBg(sources: PrioritySource[]): string {
  const types = sources.map((s) => s.type);
  if (types.includes("shadow-raid")) return "bg-purple-50 border-purple-200";
  if (types.includes("raid") || types.includes("upcoming-raid"))
    return "bg-red-50 border-red-200";
  if (types.includes("rocket")) return "bg-gray-50 border-gray-300";
  if (types.includes("event") || types.includes("research"))
    return "bg-green-50 border-green-200";
  return "bg-white border-gray-200";
}

// Egg distance → card color
export const eggDistanceColors: Record<string, string> = {
  "1 km": "bg-blue-100 border-blue-300",
  "2 km": "bg-green-100 border-green-300",
  "5 km": "bg-yellow-100 border-yellow-300",
  "7 km": "bg-pink-100 border-pink-300",
  "10 km": "bg-purple-100 border-purple-300",
  "12 km": "bg-red-100 border-red-300",
};

export function eggCardBg(sources: PrioritySource[]): string {
  for (const s of sources) {
    if (s.type === "egg" && eggDistanceColors[s.label]) {
      return eggDistanceColors[s.label];
    }
  }
  return "bg-blue-50 border-blue-200";
}

// Raid boss card styling based on lucky status and shadow type
export function raidCardStyle(
  lucky: boolean | null,
  isShadow: boolean,
): string {
  if (lucky === true) return "bg-yellow-50 border-yellow-300";
  if (lucky === false && isShadow) return "bg-purple-50 border-purple-300";
  if (lucky === false) return "bg-white border-red-200";
  return "bg-white border-gray-200";
}
