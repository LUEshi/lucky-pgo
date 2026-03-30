import type { GamemasterData, PvpPokemon, CpmEntry } from "../types/pvp";

const CACHE_KEY = "pvp-gamemaster-v1";
const GAMEMASTER_URL =
  "https://raw.githubusercontent.com/pvpoke/pvpoke/master/src/data/gamemaster.json";
const TTL_MS = 24 * 60 * 60 * 1000;

interface CachedGamemaster {
  data: GamemasterData;
  fetchedAt: number;
}

interface RawPokemon {
  speciesId?: string;
  speciesName?: string;
  dex?: number;
  baseStats?: { atk?: number; def?: number; hp?: number };
  types?: string[];
  fastMoves?: string[];
  chargedMoves?: string[];
  tags?: string[];
}

interface RawGamemaster {
  pokemon?: RawPokemon[];
  cpMultipliers?: Record<string, number>;
}

function parseGamemaster(raw: RawGamemaster): GamemasterData {
  const pokemon: PvpPokemon[] = (raw.pokemon ?? [])
    .filter(
      (p): p is Required<Pick<RawPokemon, "speciesId" | "speciesName" | "dex" | "baseStats">> &
        RawPokemon =>
        typeof p.speciesId === "string" &&
        typeof p.speciesName === "string" &&
        typeof p.dex === "number" &&
        p.baseStats != null &&
        typeof p.baseStats.atk === "number" &&
        typeof p.baseStats.def === "number" &&
        typeof p.baseStats.hp === "number",
    )
    .map((p) => ({
      speciesId: p.speciesId,
      speciesName: p.speciesName,
      dex: p.dex,
      baseStats: {
        atk: p.baseStats.atk as number,
        def: p.baseStats.def as number,
        hp: p.baseStats.hp as number,
      },
      types: p.types ?? [],
      fastMoves: p.fastMoves ?? [],
      chargedMoves: p.chargedMoves ?? [],
      tags: p.tags ?? [],
    }));

  const cpmTable: CpmEntry[] = Object.entries(raw.cpMultipliers ?? {})
    .map(([key, value]) => ({ level: parseFloat(key), cpm: value }))
    .sort((a, b) => a.level - b.level);

  return { pokemon, cpmTable };
}

export async function loadGamemaster(): Promise<GamemasterData> {
  // Try cache
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      const parsed: CachedGamemaster = JSON.parse(cached) as CachedGamemaster;
      if (Date.now() - parsed.fetchedAt < TTL_MS) {
        return parsed.data;
      }
    }
  } catch {
    // Cache read failed, fall through to fetch
  }

  // Fetch fresh data
  let response: Response;
  try {
    response = await fetch(GAMEMASTER_URL);
  } catch (err) {
    throw new Error(`Failed to fetch gamemaster data: ${String(err)}`);
  }

  if (!response.ok) {
    throw new Error(`Failed to fetch gamemaster data: HTTP ${response.status}`);
  }

  const raw = (await response.json()) as RawGamemaster;
  const data = parseGamemaster(raw);

  // Store in cache
  try {
    const toCache: CachedGamemaster = { data, fetchedAt: Date.now() };
    localStorage.setItem(CACHE_KEY, JSON.stringify(toCache));
  } catch {
    // Cache write failed (quota exceeded, etc.), ignore
  }

  return data;
}
