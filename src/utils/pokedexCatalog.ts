import type { Pokemon } from "../types";

const CACHE_KEY = "lucky-pgo-pokedex-names-v1";
const POKEAPI_SPECIES_URL = "https://pokeapi.co/api/v2/pokemon-species?limit=2000";

interface SpeciesListResponse {
  results: Array<{ name: string; url: string }>;
}

function parseDexFromUrl(url: string): number | null {
  const match = url.match(/\/pokemon-species\/(\d+)\/?$/);
  if (!match) return null;
  return parseInt(match[1], 10);
}

function formatName(name: string): string {
  return name
    .split("-")
    .map((part) =>
      part.length > 0 ? part[0].toUpperCase() + part.slice(1) : part,
    )
    .join(" ");
}

function loadCachedNameMap(): Map<number, string> | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Record<string, string>;
    const map = new Map<number, string>();
    for (const [dex, name] of Object.entries(parsed)) {
      const dexNumber = parseInt(dex, 10);
      if (!Number.isNaN(dexNumber) && name) {
        map.set(dexNumber, name);
      }
    }
    return map.size > 0 ? map : null;
  } catch {
    return null;
  }
}

function saveCachedNameMap(map: Map<number, string>) {
  const serialized: Record<string, string> = {};
  for (const [dex, name] of map.entries()) {
    serialized[String(dex)] = name;
  }
  localStorage.setItem(CACHE_KEY, JSON.stringify(serialized));
}

async function fetchNameMap(): Promise<Map<number, string>> {
  const response = await fetch(POKEAPI_SPECIES_URL);
  if (!response.ok) {
    throw new Error(`Failed to fetch Pokedex species: ${response.status}`);
  }

  const data = (await response.json()) as SpeciesListResponse;
  const map = new Map<number, string>();

  for (const species of data.results) {
    const dexNumber = parseDexFromUrl(species.url);
    if (!dexNumber) continue;
    map.set(dexNumber, formatName(species.name));
  }

  if (map.size === 0) {
    throw new Error("No species returned from PokeAPI");
  }

  saveCachedNameMap(map);
  return map;
}

export async function getPokedexNameMap(): Promise<Map<number, string>> {
  const cached = loadCachedNameMap();
  if (cached) return cached;
  return fetchNameMap();
}

export async function buildPokedexFromLuckyDexSet(
  luckyDex: Set<number>,
  maxDex: number,
): Promise<Pokemon[]> {
  const nameMap = await getPokedexNameMap();
  const list: Pokemon[] = [];

  for (let dexNumber = 1; dexNumber <= maxDex; dexNumber++) {
    list.push({
      dexNumber,
      name: nameMap.get(dexNumber) ?? `Pokemon ${dexNumber}`,
      isLucky: luckyDex.has(dexNumber),
    });
  }

  return list;
}
