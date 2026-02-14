import { useState, useCallback, useEffect } from "react";
import type { Pokemon, LuckyList } from "../types";
import {
  decodeLuckyDexBitset,
  encodeLuckyDexBitset,
  MAX_DEX_NUMBER,
} from "../utils/luckyShare";
import { buildPokedexFromLuckyDexSet } from "../utils/pokedexCatalog";

const STORAGE_KEY = "lucky-pgo-list";
const DEX_QUERY_KEY = "dex";

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

export function useLuckyList() {
  const [luckyList, setLuckyList] = useState<LuckyList | null>(() =>
    loadFromStorage(),
  );
  const [linkImportError, setLinkImportError] = useState<string | null>(null);
  const [linkImportMessage, setLinkImportMessage] = useState<string | null>(null);

  useEffect(() => {
    if (luckyList) {
      saveToStorage(luckyList);
    }
  }, [luckyList]);

  useEffect(() => {
    let cancelled = false;

    async function importFromLinkIfPresent() {
      const params = new URLSearchParams(window.location.search);
      const dexParam = params.get(DEX_QUERY_KEY);
      if (!dexParam) return;

      const decoded = decodeLuckyDexBitset(dexParam, MAX_DEX_NUMBER);
      if (!decoded) {
        setLinkImportError("Shared dex link is invalid or corrupted.");
        return;
      }

      if (luckyList) {
        const currentBitset = encodeLuckyDexBitset(luckyList.pokemon, MAX_DEX_NUMBER);
        if (currentBitset === dexParam) return;

        const replace = window.confirm(
          "This link contains a shared lucky list. Replace your current local list with it?",
        );
        if (!replace) return;
      }

      try {
        const pokemon = await buildPokedexFromLuckyDexSet(decoded, MAX_DEX_NUMBER);
        if (cancelled) return;

        setLuckyList({
          pokemon,
          lastUpdated: new Date().toISOString(),
        });
        setLinkImportError(null);
        setLinkImportMessage("Imported lucky list from shared link.");
      } catch {
        if (cancelled) return;
        setLinkImportError(
          "Could not load the full Pokedex names needed for link import.",
        );
      }
    }

    importFromLinkIfPresent();

    return () => {
      cancelled = true;
    };
  }, [luckyList]);

  const importPokemon = useCallback((pokemon: Pokemon[]) => {
    setLuckyList({
      pokemon,
      lastUpdated: new Date().toISOString(),
    });
  }, []);

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
  };
}
