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
import {
  mergeEventEnrichment,
  shouldIncludeOverlayEvent,
} from "../utils/eventOverlay.js";

const BASE =
  "https://raw.githubusercontent.com/bigfoott/ScrapedDuck/data";

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Snapshot overlay — merge enriched event data from daily snapshots
// ---------------------------------------------------------------------------

interface SnapshotIndex {
  snapshots?: Array<{ date: string; path: string }>;
}

interface SnapshotFile {
  data?: {
    events?: ScrapedDuckEvent[];
  };
}

/**
 * Load the newest snapshot's enriched event data and build a lookup map
 * by eventID. Returns null if no snapshot is available.
 */
async function loadSnapshotOverlay(): Promise<Map<string, ScrapedDuckEvent["extraData"]> | null> {
  try {
    const base = import.meta.env.BASE_URL;
    const indexRes = await fetch(`${base}history/index.json`);
    if (!indexRes.ok) return null;
    const index = (await indexRes.json()) as SnapshotIndex;
    const newest = index.snapshots?.[0];
    if (!newest) return null;

    const snapshotRes = await fetch(`${base}${newest.path}`);
    if (!snapshotRes.ok) return null;
    const snapshot = (await snapshotRes.json()) as SnapshotFile;

    const map = new Map<string, ScrapedDuckEvent["extraData"]>();
    for (const event of snapshot.data?.events ?? []) {
      if (shouldIncludeOverlayEvent(event)) {
        map.set(event.eventID, event.extraData);
      }
    }
    return map.size > 0 ? map : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useScrapedDuck() {
  const [data, setData] = useState<ScrapedDuckData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [liveEvents, initialRaids, research, initialEggs, initialRockets, overlay] =
          await Promise.all([
          fetchJson<ScrapedDuckEvent[]>(`${BASE}/events.min.json`),
          fetchJson<RaidBoss[]>(`${BASE}/raids.min.json`),
          fetchJson<ResearchTask[]>(`${BASE}/research.min.json`),
          fetchJson<EggPokemon[]>(`${BASE}/eggs.min.json`),
          fetchJson<RocketLineup[]>(`${BASE}/rocketLineups.min.json`),
          loadSnapshotOverlay(),
          ]);

        let raids = initialRaids;
        let eggs = initialEggs;
        let rockets = initialRockets;

        // Dedup where the API has duplicates
        raids = dedupeByKey(raids, (r) => r.name);
        eggs = dedupeByKey(eggs, (e) => e.name);
        rockets = dedupeByKey(rockets, (r) => r.name);

        // Merge enriched event data from snapshot
        const events = mergeEventEnrichment(liveEvents, overlay);

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
