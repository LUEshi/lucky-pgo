import type { PriorityPokemon, PrioritySource } from "../types";
import type { Category } from "../hooks/useCategorizedPokemon";
import { sourceColors, cardBg, eggCardBg } from "../utils/styleConstants";

interface PriorityCardProps {
  name: string;
  sources: PrioritySource[];
  category: Category;
  neededBy?: PriorityPokemon["neededBy"];
}

export function PriorityCard({
  name,
  sources,
  category,
  neededBy,
}: PriorityCardProps) {
  const bg = category === "eggs" ? eggCardBg(sources) : cardBg(sources);
  const leftBorderClass =
    neededBy === "both"
      ? "border-l-4 border-l-amber-400"
      : neededBy === "partner"
        ? "border-l-4 border-l-blue-200"
        : "";
  const availabilityRows = Array.from(
    new Set(
      sources
        .filter((s) => s.availability)
        .map((s) => `${s.label}: ${s.availability}`),
    ),
  );

  return (
    <div className={`border rounded-lg px-3 py-2 ${bg} ${leftBorderClass}`}>
      <div className="flex items-center gap-2">
        <div className="font-medium text-sm text-gray-900">{name}</div>
        {neededBy === "both" && (
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800">
            Both need
          </span>
        )}
        {neededBy === "partner" && (
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700">
            Partner
          </span>
        )}
      </div>
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
