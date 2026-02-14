import { useState, useEffect } from "react";
import type {
  ScrapedDuckData,
  ScrapedDuckEvent,
  RaidBoss,
  ResearchTask,
  EggPokemon,
  RocketLineup,
} from "../types";
import { dedupeByKey } from "../utils/array";

const BASE =
  "https://raw.githubusercontent.com/bigfoott/ScrapedDuck/data";

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
  return res.json() as Promise<T>;
}

export function useScrapedDuck() {
  const [data, setData] = useState<ScrapedDuckData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [events, initialRaids, research, initialEggs, initialRockets] =
          await Promise.all([
          fetchJson<ScrapedDuckEvent[]>(`${BASE}/events.min.json`),
          fetchJson<RaidBoss[]>(`${BASE}/raids.min.json`),
          fetchJson<ResearchTask[]>(`${BASE}/research.min.json`),
          fetchJson<EggPokemon[]>(`${BASE}/eggs.min.json`),
          fetchJson<RocketLineup[]>(`${BASE}/rocketLineups.min.json`),
          ]);

        let raids = initialRaids;
        let eggs = initialEggs;
        let rockets = initialRockets;

        // Dedup where the API has duplicates
        raids = dedupeByKey(raids, (r) => r.name);
        eggs = dedupeByKey(eggs, (e) => e.name);
        rockets = dedupeByKey(rockets, (r) => r.name);

        if (!cancelled) {
          setData({ events, raids, research, eggs, rockets });
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Failed to load event data",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return { data, loading, error };
}
