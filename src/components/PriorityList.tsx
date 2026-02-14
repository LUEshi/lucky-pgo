import { useMemo } from "react";
import type { PriorityPokemon, PrioritySource } from "../types";

interface PriorityListProps {
  priorities: PriorityPokemon[];
}

type Category = "raids" | "wild" | "rocket" | "eggs";

interface CategorizedPokemon {
  name: string;
  sources: PrioritySource[];
}

const categories: {
  key: Category;
  title: string;
  color: string;
  types: string[];
}[] = [
  {
    key: "raids",
    title: "Raids",
    color: "text-red-700",
    types: ["raid", "shadow-raid", "upcoming-raid"],
  },
  {
    key: "wild",
    title: "Wild / Events / Research",
    color: "text-green-700",
    types: ["event", "research", "upcoming"],
  },
  {
    key: "rocket",
    title: "Team Rocket",
    color: "text-gray-700",
    types: ["rocket"],
  },
  {
    key: "eggs",
    title: "Eggs",
    color: "text-blue-700",
    types: ["egg"],
  },
];

const sourceColors: Record<string, string> = {
  raid: "bg-red-100 text-red-800",
  "shadow-raid": "bg-purple-200 text-purple-900",
  "upcoming-raid": "bg-orange-100 text-orange-800",
  event: "bg-green-100 text-green-800",
  research: "bg-purple-100 text-purple-800",
  upcoming: "bg-yellow-100 text-yellow-800",
  rocket: "bg-gray-700 text-gray-100",
  egg: "bg-blue-100 text-blue-800",
};

// Card background per source type
function cardBg(sources: PrioritySource[]): string {
  const types = sources.map((s) => s.type);
  if (types.includes("shadow-raid")) return "bg-purple-50 border-purple-200";
  if (types.includes("raid") || types.includes("upcoming-raid"))
    return "bg-red-50 border-red-200";
  if (types.includes("rocket")) return "bg-gray-50 border-gray-300";
  if (types.includes("event") || types.includes("research"))
    return "bg-green-50 border-green-200";
  return "bg-white border-gray-200";
}

// Egg distance colors
const eggDistanceColors: Record<string, string> = {
  "1 km": "bg-blue-100 border-blue-300",
  "2 km": "bg-green-100 border-green-300",
  "5 km": "bg-yellow-100 border-yellow-300",
  "7 km": "bg-pink-100 border-pink-300",
  "10 km": "bg-purple-100 border-purple-300",
  "12 km": "bg-red-100 border-red-300",
};

function eggCardBg(sources: PrioritySource[]): string {
  // Use the color of the shortest distance egg
  for (const s of sources) {
    if (s.type === "egg" && eggDistanceColors[s.label]) {
      return eggDistanceColors[s.label];
    }
  }
  return "bg-blue-50 border-blue-200";
}

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

export function PriorityList({ priorities }: PriorityListProps) {
  const categorized = useMemo(() => {
    const result: Record<Category, CategorizedPokemon[]> = {
      raids: [],
      wild: [],
      rocket: [],
      eggs: [],
    };

    for (const p of priorities) {
      for (const cat of categories) {
        const matchingSources = p.sources.filter((s) =>
          cat.types.includes(s.type),
        );
        if (matchingSources.length > 0) {
          result[cat.key].push({ name: p.name, sources: matchingSources });
        }
      }
    }

    // Sort eggs by distance (shortest first)
    result.eggs.sort((a, b) => eggDistance(a.sources) - eggDistance(b.sources));

    return result;
  }, [priorities]);

  const hasAny = Object.values(categorized).some((list) => list.length > 0);

  if (!hasAny) {
    return (
      <div className="text-center py-8 text-gray-500">
        <p>No priority Pokemon found right now.</p>
        <p className="text-sm mt-1">
          Either you've caught them all, or there are no current events matching
          your missing Pokemon!
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {categories.map((cat) => (
        <div key={cat.key}>
          <h3 className={`text-sm font-semibold ${cat.color} mb-2`}>
            {cat.title}
            {categorized[cat.key].length > 0 && (
              <span className="ml-1 text-gray-400 font-normal">
                ({categorized[cat.key].length})
              </span>
            )}
          </h3>
          {categorized[cat.key].length === 0 ? (
            <p className="text-xs text-gray-400">None right now</p>
          ) : (
            <div className="space-y-1.5">
              {categorized[cat.key].map((p) => (
                <div
                  key={p.name}
                  className={`border rounded-lg px-3 py-2 ${
                    cat.key === "eggs"
                      ? eggCardBg(p.sources)
                      : cardBg(p.sources)
                  }`}
                >
                  <div className="font-medium text-sm text-gray-900">
                    {p.name}
                  </div>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {p.sources.map((s, i) => (
                      <span
                        key={i}
                        className={`text-[10px] px-1.5 py-0.5 rounded-full ${sourceColors[s.type] ?? "bg-gray-100 text-gray-700"}`}
                        title={s.detail}
                      >
                        {s.label}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
