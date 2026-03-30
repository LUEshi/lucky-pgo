import { useState, useMemo, useEffect } from "react";
import type { PvpPokemon, CpmEntry, AllRankings, PvpLeagueResult } from "../../types/pvp";
import { loadGamemaster } from "../../services/gameMasterService";
import { loadAllRankings } from "../../services/leagueRankService";
import { getIVRankResult } from "../../utils/ivRankEngine";
import { PokemonSearch } from "./PokemonSearch";
import { IvInput } from "./IvInput";
import { LeagueCard } from "./LeagueCard";

interface Props {
  onBack: () => void;
}

const LEAGUES: Array<{ league: "great" | "ultra" | "master"; cpCap: number; label: string }> = [
  { league: "great", cpCap: 1500, label: "Great League" },
  { league: "ultra", cpCap: 2500, label: "Ultra League" },
  { league: "master", cpCap: Infinity, label: "Master League" },
];

function parseUrlParams(): {
  mon: string | null;
  iv: { atk: number; def: number; sta: number } | null;
  floor: number | null;
  lvl: number | null;
} {
  const params = new URLSearchParams(window.location.search);
  const mon = params.get("mon");

  let iv: { atk: number; def: number; sta: number } | null = null;
  const ivStr = params.get("iv");
  if (ivStr) {
    const parts = ivStr.split(".").map(Number);
    if (parts.length === 3 && parts.every((n) => !isNaN(n) && n >= 0 && n <= 15)) {
      iv = { atk: parts[0], def: parts[1], sta: parts[2] };
    }
  }

  const floorStr = params.get("floor");
  const floor = floorStr !== null ? parseInt(floorStr, 10) : null;

  const lvlStr = params.get("lvl");
  const lvl = lvlStr !== null ? parseInt(lvlStr, 10) : null;

  return { mon, iv, floor, lvl };
}

export function PvpIvChecker({ onBack }: Props) {
  const [allPokemon, setAllPokemon] = useState<PvpPokemon[]>([]);
  const [cpmTable, setCpmTable] = useState<CpmEntry[]>([]);
  const [rankings, setRankings] = useState<AllRankings | null>(null);
  const [loading, setLoading] = useState(true);
  const [dataError, setDataError] = useState<string | null>(null);

  // Parse IV-related URL params at init time (pokemon selection deferred until data loads)
  const [selectedPokemon, setSelectedPokemon] = useState<PvpPokemon | null>(null);
  const [ivs, setIvs] = useState<{ atk: number; def: number; sta: number }>(() => {
    const { iv } = parseUrlParams();
    return iv ?? { atk: 0, def: 14, sta: 15 };
  });
  const [ivFloor, setIvFloor] = useState(() => {
    const { floor } = parseUrlParams();
    return floor !== null && !isNaN(floor) ? floor : 0;
  });
  const [maxLevel, setMaxLevel] = useState(() => {
    const { lvl } = parseUrlParams();
    return lvl !== null && !isNaN(lvl) ? lvl : 50;
  });

  // Load data on mount; apply URL params once pokemon list is ready
  useEffect(() => {
    let cancelled = false;

    Promise.all([loadGamemaster(), loadAllRankings()])
      .then(([gm, rankData]) => {
        if (cancelled) return;
        setAllPokemon(gm.pokemon);
        setCpmTable(gm.cpmTable);
        setRankings(rankData);
        setLoading(false);
        // Apply mon param here (async callback, not synchronous effect body)
        const { mon } = parseUrlParams();
        if (mon) {
          const found = gm.pokemon.find((p) => p.speciesId === mon);
          if (found) setSelectedPokemon(found);
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setDataError(err instanceof Error ? err.message : String(err));
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Sync URL on changes
  useEffect(() => {
    const url = new URL(window.location.href);

    if (selectedPokemon) {
      url.searchParams.set("mon", selectedPokemon.speciesId);
    } else {
      url.searchParams.delete("mon");
    }
    url.searchParams.set("iv", `${ivs.atk}.${ivs.def}.${ivs.sta}`);
    url.searchParams.set("floor", String(ivFloor));
    url.searchParams.set("lvl", String(maxLevel));

    window.history.replaceState(null, "", url.toString());
  }, [selectedPokemon, ivs, ivFloor, maxLevel]);

  const leagueResults = useMemo<PvpLeagueResult[]>(() => {
    if (!selectedPokemon || cpmTable.length === 0) return [];

    return LEAGUES.map(({ league, cpCap }) => {
      const result = getIVRankResult(
        selectedPokemon.baseStats,
        cpmTable,
        cpCap,
        ivs,
        ivFloor,
        maxLevel,
      );

      const meta = rankings?.[league].get(selectedPokemon.speciesId) ?? null;

      return {
        league,
        cpCap,
        queriedIV: result?.queriedIV ?? null,
        rank1: result?.rank1 ?? null,
        metaRank: meta?.rank ?? null,
        metaScore: meta?.score ?? null,
        moveset: meta?.moveset ?? null,
      } satisfies PvpLeagueResult;
    });
  }, [selectedPokemon, cpmTable, ivs, ivFloor, maxLevel, rankings]);

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-2xl mx-auto px-4 py-4">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={onBack}
            className="text-sm text-gray-600 hover:text-gray-900 flex items-center gap-1 transition-colors"
          >
            ← Back
          </button>
          <h1 className="text-xl font-bold text-gray-900">PvP IV Checker</h1>
        </div>

        {loading && (
          <div className="text-center py-16 text-gray-500">
            <p>Loading game data...</p>
          </div>
        )}

        {dataError && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm mb-4">
            Failed to load data: {dataError}
          </div>
        )}

        {!loading && !dataError && (
          <div className="space-y-4">
            <PokemonSearch
              allPokemon={allPokemon}
              selected={selectedPokemon}
              onSelect={setSelectedPokemon}
            />

            <IvInput
              ivs={ivs}
              onChange={setIvs}
              ivFloor={ivFloor}
              onIvFloorChange={setIvFloor}
              maxLevel={maxLevel}
              onMaxLevelChange={setMaxLevel}
            />

            {selectedPokemon && leagueResults.length > 0 && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                {leagueResults.map((result) => (
                  <LeagueCard key={result.league} result={result} />
                ))}
              </div>
            )}

            {!selectedPokemon && (
              <div className="text-center py-12 text-gray-400 text-sm">
                Search for a Pokemon to check its IV rankings
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
