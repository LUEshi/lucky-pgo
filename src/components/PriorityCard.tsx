import type { PrioritySource } from "../types";
import type { Category } from "../hooks/useCategorizedPokemon";
import { sourceColors, cardBg, eggCardBg } from "../utils/styleConstants";

interface PriorityCardProps {
  name: string;
  sources: PrioritySource[];
  category: Category;
}

export function PriorityCard({ name, sources, category }: PriorityCardProps) {
  const bg = category === "eggs" ? eggCardBg(sources) : cardBg(sources);
  const availabilityRows = Array.from(
    new Set(
      sources
        .filter((s) => s.availability)
        .map((s) => `${s.label}: ${s.availability}`),
    ),
  );

  return (
    <div className={`border rounded-lg px-3 py-2 ${bg}`}>
      <div className="font-medium text-sm text-gray-900">{name}</div>
      <div className="flex flex-wrap gap-1 mt-1">
        {sources.map((s, i) => (
          <span
            key={i}
            className={`text-[10px] px-1.5 py-0.5 rounded-full ${sourceColors[s.type] ?? "bg-gray-100 text-gray-700"}`}
            title={s.detail}
          >
            {s.label}
          </span>
        ))}
      </div>
      {availabilityRows.length > 0 && (
        <div className="mt-1 text-[10px] text-gray-600">
          {availabilityRows.map((row) => (
            <div key={row}>{row}</div>
          ))}
        </div>
      )}
    </div>
  );
}
