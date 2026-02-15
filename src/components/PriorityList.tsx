import type { PriorityPokemon } from "../types";
import { useCategorizedPokemon, categoryOrder, type Category } from "../hooks/useCategorizedPokemon";
import type { CategorizedPokemon } from "../hooks/useCategorizedPokemon";
import { PriorityCard } from "./PriorityCard";
import { categoryDisplay } from "../utils/styleConstants";

interface PriorityListProps {
  priorities: PriorityPokemon[];
  hasPartner?: boolean;
  partnerName?: string;
}

function formatForClipboard(categorized: Record<Category, CategorizedPokemon[]>): string {
  const sections: string[] = [];
  for (const cat of categoryOrder) {
    const items = categorized[cat];
    if (items.length === 0) continue;
    sections.push(
      `${categoryDisplay[cat].title}\n${items.map((p) => `- ${p.name}`).join("\n")}`,
    );
  }
  return sections.join("\n\n");
}

export function PriorityList({
  priorities,
  hasPartner = false,
  partnerName = "Partner",
}: PriorityListProps) {
  const categorized = useCategorizedPokemon(priorities);

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
    <div>
      <div className="flex justify-end mb-2">
        <button
          onClick={() => navigator.clipboard.writeText(formatForClipboard(categorized))}
          className="text-xs text-gray-500 hover:text-gray-700 active:text-green-600 flex items-center gap-1 transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          Copy list
        </button>
      </div>
      {hasPartner && (
        <div className="mb-2 text-xs text-gray-600">
          Showing trades for you + {partnerName}
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {categoryOrder.map((category) => (
          <div key={category}>
            <h3 className={`text-sm font-semibold ${categoryDisplay[category].color} mb-2`}>
              {categoryDisplay[category].title}
              {categorized[category].length > 0 && (
                <span className="ml-1 text-gray-400 font-normal">
                  ({categorized[category].length})
                </span>
              )}
            </h3>
            {categorized[category].length === 0 ? (
              <p className="text-xs text-gray-400">None right now</p>
            ) : (
              <div className="space-y-1.5">
                {categorized[category].map((p) => (
                  <PriorityCard
                    key={p.name}
                    name={p.name}
                    sources={p.sources}
                    category={category}
                    neededBy={p.neededBy}
                  />
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
