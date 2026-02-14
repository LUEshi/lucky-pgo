import { useState, useCallback, useEffect, useRef } from "react";
import type { Pokemon, LuckyList } from "../types";
import {
  decodeLuckyDexBitset,
  encodeLuckyDexBitset,
  MAX_DEX_NUMBER,
  checksumDexPayload,
  collectLuckyDexNumbers,
} from "../utils/luckyShare";
import { buildPokedexFromLuckyDexSet } from "../utils/pokedexCatalog";

const STORAGE_KEY = "lucky-pgo-list";
const DEX_QUERY_KEY = "dex";
const DEX_COUNT_QUERY_KEY = "dxc";
const DEX_HASH_QUERY_KEY = "dxh";

function removeDexParamFromUrl() {
  const url = new URL(window.location.href);
  if (
    !url.searchParams.has(DEX_QUERY_KEY) &&
    !url.searchParams.has(DEX_COUNT_QUERY_KEY) &&
    !url.searchParams.has(DEX_HASH_QUERY_KEY)
  ) {
    return;
  }
  url.searchParams.delete(DEX_QUERY_KEY);
  url.searchParams.delete(DEX_COUNT_QUERY_KEY);
  url.searchParams.delete(DEX_HASH_QUERY_KEY);
  window.history.replaceState(null, "", url.toString());
}

function loadFromStorage(): LuckyList | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as LuckyList;
  } catch {
    return null;
  }
}

function saveToStorage(list: LuckyList) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

function hasCanonicalCoverage(pokemon: Pokemon[]): boolean {
  const seen = new Set<number>();
  for (const entry of pokemon) {
    if (entry.dexNumber >= 1 && entry.dexNumber <= MAX_DEX_NUMBER) {
      seen.add(entry.dexNumber);
    }
  }
  return seen.size === MAX_DEX_NUMBER;
}

function buildFallbackCanonicalPokemon(
  luckyDex: Set<number>,
  source: Pokemon[],
): Pokemon[] {
  const nameByDex = new Map<number, string>();
  for (const entry of source) {
    if (
      entry.dexNumber >= 1 &&
      entry.dexNumber <= MAX_DEX_NUMBER &&
      !nameByDex.has(entry.dexNumber) &&
      entry.name
    ) {
      nameByDex.set(entry.dexNumber, entry.name);
    }
  }

  const full: Pokemon[] = [];
  for (let dexNumber = 1; dexNumber <= MAX_DEX_NUMBER; dexNumber++) {
    full.push({
      dexNumber,
      name: nameByDex.get(dexNumber) ?? `Pokemon ${dexNumber}`,
      isLucky: luckyDex.has(dexNumber),
    });
  }
  return full;
}

export function useLuckyList() {
  const [luckyList, setLuckyList] = useState<LuckyList | null>(() =>
    loadFromStorage(),
  );
  const initialLuckyListRef = useRef<LuckyList | null>(luckyList);
  const [linkImportError, setLinkImportError] = useState<string | null>(null);
  const [linkImportMessage, setLinkImportMessage] = useState<string | null>(null);
  const [pendingDexImport, setPendingDexImport] = useState<{
    encoded: string;
    luckyCount: number;
  } | null>(null);
  const [importingFromLink, setImportingFromLink] = useState(false);

  const canonicalizeAndSetLuckyList = useCallback(
    async (sourcePokemon: Pokemon[], statusMessage?: string) => {
      const luckyDex = collectLuckyDexNumbers(sourcePokemon, MAX_DEX_NUMBER);
      const fallback = buildFallbackCanonicalPokemon(luckyDex, sourcePokemon);
      const now = new Date().toISOString();

      // Immediate canonical fallback keeps dex index stable even if catalog fetch fails.
      setLuckyList({
        pokemon: fallback,
        lastUpdated: now,
      });

      try {
        const canonical = await buildPokedexFromLuckyDexSet(luckyDex, MAX_DEX_NUMBER);
        setLuckyList({
          pokemon: canonical,
          lastUpdated: new Date().toISOString(),
        });
      } catch {
        // Keep fallback data; names may be generic for entries not present in source.
      }

      if (statusMessage) {
        setLinkImportMessage(statusMessage);
      }
    },
    [],
  );

  useEffect(() => {
    if (luckyList) {
      saveToStorage(luckyList);
    }
  }, [luckyList]);

  useEffect(() => {
    if (!luckyList) return;
    if (hasCanonicalCoverage(luckyList.pokemon)) return;
    void canonicalizeAndSetLuckyList(luckyList.pokemon);
  }, [luckyList, canonicalizeAndSetLuckyList]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const dexParam = params.get(DEX_QUERY_KEY);
    if (!dexParam) return;

    const expectedCountParam = params.get(DEX_COUNT_QUERY_KEY);
    const expectedHashParam = params.get(DEX_HASH_QUERY_KEY);

    if (expectedHashParam && checksumDexPayload(dexParam) !== expectedHashParam) {
      setLinkImportError(
        "Shared dex link appears corrupted (checksum mismatch). Ask for a fresh share link.",
      );
      return;
    }

    const decoded = decodeLuckyDexBitset(dexParam, MAX_DEX_NUMBER);
    if (!decoded) {
      setLinkImportError("Shared dex link is invalid or corrupted.");
      return;
    }

    const expectedCount = expectedCountParam ? parseInt(expectedCountParam, 10) : NaN;
    if (!Number.isNaN(expectedCount) && expectedCount !== decoded.size) {
      setLinkImportError(
        `Shared dex link appears corrupted (expected ${expectedCount} lucky entries, got ${decoded.size}).`,
      );
      return;
    }

    if (initialLuckyListRef.current) {
      const currentBitset = encodeLuckyDexBitset(
        initialLuckyListRef.current.pokemon,
        MAX_DEX_NUMBER,
      );
      if (currentBitset === dexParam) {
        setLinkImportMessage("Shared dex matches your current list.");
        removeDexParamFromUrl();
        return;
      }
    }

    if (import.meta.env.DEV) {
      console.info("[shared-dex] import candidate", {
        luckyCount: decoded.size,
        noibatLucky: decoded.has(714),
        hash: checksumDexPayload(dexParam),
      });
    }

    setPendingDexImport({ encoded: dexParam, luckyCount: decoded.size });
  }, []);

  const importPokemon = useCallback((pokemon: Pokemon[]) => {
    void canonicalizeAndSetLuckyList(pokemon);
  }, [canonicalizeAndSetLuckyList]);

  const toggleLucky = useCallback((dexNumber: number) => {
    setLuckyList((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        pokemon: prev.pokemon.map((p) =>
          p.dexNumber === dexNumber ? { ...p, isLucky: !p.isLucky } : p,
        ),
        lastUpdated: new Date().toISOString(),
      };
    });
  }, []);

  const clearList = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setLuckyList(null);
  }, []);

  const applyPendingDexImport = useCallback(async () => {
    if (!pendingDexImport) return;

    const decoded = decodeLuckyDexBitset(pendingDexImport.encoded, MAX_DEX_NUMBER);
    if (!decoded) {
      setLinkImportError("Shared dex link is invalid or corrupted.");
      setPendingDexImport(null);
      removeDexParamFromUrl();
      return;
    }

    try {
      setImportingFromLink(true);
      await canonicalizeAndSetLuckyList(
        Array.from(decoded).map((dexNumber) => ({
          dexNumber,
          name: `Pokemon ${dexNumber}`,
          isLucky: true,
        })),
        "Imported lucky list from shared link.",
      );
      setLinkImportError(null);
    } catch {
      setLinkImportError(
        "Could not load the full Pokedex names needed for link import.",
      );
    } finally {
      setImportingFromLink(false);
      setPendingDexImport(null);
      removeDexParamFromUrl();
    }
  }, [pendingDexImport, canonicalizeAndSetLuckyList]);

  const dismissPendingDexImport = useCallback(() => {
    setPendingDexImport(null);
    setLinkImportMessage("Ignored shared dex link. Your local list is unchanged.");
    removeDexParamFromUrl();
  }, []);

  const luckyCount = luckyList?.pokemon.filter((p) => p.isLucky).length ?? 0;
  const totalCount = luckyList?.pokemon.length ?? 0;

  return {
    luckyList,
    importPokemon,
    toggleLucky,
    clearList,
    luckyCount,
    totalCount,
    linkImportError,
    linkImportMessage,
    pendingDexImport,
    importingFromLink,
    applyPendingDexImport,
    dismissPendingDexImport,
  };
}
