import type { AllRankings, PvpLeagueRanking } from "../types/pvp";

const TTL_MS = 24 * 60 * 60 * 1000;

const RANKINGS_URLS: Record<string, string> = {
  "pvp-rankings-1500-v1":
    "https://raw.githubusercontent.com/pvpoke/pvpoke/master/src/data/rankings/all/overall/rankings-1500.json",
  "pvp-rankings-2500-v1":
    "https://raw.githubusercontent.com/pvpoke/pvpoke/master/src/data/rankings/all/overall/rankings-2500.json",
  "pvp-rankings-10000-v1":
    "https://raw.githubusercontent.com/pvpoke/pvpoke/master/src/data/rankings/all/overall/rankings-10000.json",
};

interface CachedRankings {
  data: PvpLeagueRanking[];
  fetchedAt: number;
}

interface RawRankingEntry {
  speciesId?: string;
  score?: number;
  moveset?: string[];
}

async function loadRankingsForKey(cacheKey: string): Promise<Map<string, PvpLeagueRanking>> {
  // Try cache
  try {
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      const parsed: CachedRankings = JSON.parse(cached) as CachedRankings;
      if (Date.now() - parsed.fetchedAt < TTL_MS) {
        const map = new Map<string, PvpLeagueRanking>();
        for (const entry of parsed.data) {
          map.set(entry.speciesId, entry);
        }
        return map;
      }
    }
  } catch {
    // Cache read failed, fall through to fetch
  }

  const url = RANKINGS_URLS[cacheKey];
  if (!url) {
    throw new Error(`Unknown rankings cache key: ${cacheKey}`);
  }

  let response: Response;
  try {
    response = await fetch(url);
  } catch (err) {
    throw new Error(`Failed to fetch rankings (${cacheKey}): ${String(err)}`);
  }

  if (!response.ok) {
    throw new Error(`Failed to fetch rankings (${cacheKey}): HTTP ${response.status}`);
  }

  const rawArray = (await response.json()) as RawRankingEntry[];
  const rankings: PvpLeagueRanking[] = rawArray.map((entry, idx) => ({
    speciesId: entry.speciesId ?? "",
    rank: idx + 1,
    score: entry.score ?? 0,
    moveset: entry.moveset ?? [],
  }));

  // Store in cache
  try {
    const toCache: CachedRankings = { data: rankings, fetchedAt: Date.now() };
    localStorage.setItem(cacheKey, JSON.stringify(toCache));
  } catch {
    // Cache write failed, ignore
  }

  const map = new Map<string, PvpLeagueRanking>();
  for (const entry of rankings) {
    map.set(entry.speciesId, entry);
  }
  return map;
}

export async function loadAllRankings(): Promise<AllRankings> {
  const [great, ultra, master] = await Promise.all([
    loadRankingsForKey("pvp-rankings-1500-v1"),
    loadRankingsForKey("pvp-rankings-2500-v1"),
    loadRankingsForKey("pvp-rankings-10000-v1"),
  ]);

  return { great, ultra, master };
}
