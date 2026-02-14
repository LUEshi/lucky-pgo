import { useMemo } from "react";
import type { Pokemon } from "../types";

interface PokedexViewProps {
  pokemon: Pokemon[];
  onToggleLucky: (dexNumber: number) => void;
  search: string;
  filter: Filter;
  onSearchChange: (value: string) => void;
  onFilterChange: (value: Filter) => void;
}

export type Filter = "all" | "missing" | "lucky";

export function PokedexView({
  pokemon,
  onToggleLucky,
  search,
  filter,
  onSearchChange,
  onFilterChange,
}: PokedexViewProps) {
  const filtered = useMemo(() => {
    let list = pokemon;
    if (filter === "missing") list = list.filter((p) => !p.isLucky);
    if (filter === "lucky") list = list.filter((p) => p.isLucky);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) || String(p.dexNumber).includes(q),
      );
    }
    return list;
  }, [pokemon, search, filter]);

  return (
    <div>
      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <input
          type="text"
          placeholder="Search by name or number..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
        />
        <div className="flex gap-1">
          {(["all", "missing", "lucky"] as Filter[]).map((f) => (
            <button
              key={f}
              onClick={() => onFilterChange(f)}
              className={`px-3 py-2 text-xs font-medium rounded-lg capitalize transition-colors ${
                filter === f
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>
      <div className="text-xs text-gray-400 mb-2">
        Showing {filtered.length} of {pokemon.length}
      </div>
      <div className="space-y-1 max-h-[60vh] overflow-y-auto">
        {filtered.map((p) => (
          <div
            key={p.dexNumber}
            className={`flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition-colors ${
              p.isLucky
                ? "bg-yellow-50 hover:bg-yellow-100"
                : "bg-white hover:bg-gray-50"
            }`}
            onClick={() => onToggleLucky(p.dexNumber)}
          >
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-400 w-8 text-right">
                #{p.dexNumber}
              </span>
              <span
                className={`text-sm ${p.isLucky ? "text-yellow-700 font-medium" : "text-gray-800"}`}
              >
                {p.name}
              </span>
            </div>
            <span className="text-lg">{p.isLucky ? "\u2B50" : "\u25CB"}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
