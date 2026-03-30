import { useState, useRef } from "react";
import type { PvpPokemon } from "../../types/pvp";

interface Props {
  allPokemon: PvpPokemon[];
  selected: PvpPokemon | null;
  onSelect: (pokemon: PvpPokemon) => void;
  disabled?: boolean;
}

export function PokemonSearch({ allPokemon, selected, onSelect, disabled }: Props) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const filtered =
    query.length > 0
      ? allPokemon
          .filter((p) => p.speciesName.toLowerCase().includes(query.toLowerCase()))
          .slice(0, 20)
      : [];

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    setQuery(e.target.value);
    setOpen(true);
  }

  function handleFocus() {
    if (query.length > 0) {
      setOpen(true);
    }
  }

  function handleBlur() {
    // Use a small timeout so onMouseDown on items fires first
    setTimeout(() => {
      setOpen(false);
    }, 150);
  }

  function handleSelect(pokemon: PvpPokemon) {
    onSelect(pokemon);
    setQuery("");
    setOpen(false);
  }

  const displayValue = query.length > 0 ? query : (selected?.speciesName ?? "");

  return (
    <div ref={containerRef} className="relative">
      <input
        type="text"
        value={displayValue}
        onChange={handleInputChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        disabled={disabled}
        placeholder="Search Pokemon..."
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:opacity-50 disabled:bg-gray-100"
      />
      {open && filtered.length > 0 && (
        <ul className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {filtered.map((pokemon) => (
            <li key={pokemon.speciesId}>
              <button
                type="button"
                onMouseDown={() => handleSelect(pokemon)}
                className="w-full text-left px-3 py-2 text-sm hover:bg-purple-50 hover:text-purple-900 transition-colors"
              >
                {pokemon.speciesName}
                <span className="ml-1 text-xs text-gray-400">#{pokemon.dex}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
