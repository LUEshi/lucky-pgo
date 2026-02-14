import type { PriorityPokemon } from "../types";
import { useCategorizedPokemon, categoryOrder } from "../hooks/useCategorizedPokemon";
import { PriorityCard } from "./PriorityCard";
import { categoryDisplay } from "../utils/styleConstants";

interface PriorityListProps {
  priorities: PriorityPokemon[];
}

export function PriorityList({ priorities }: PriorityListProps) {
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
                />
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
