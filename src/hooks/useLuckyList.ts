import { useState, useCallback, useEffect, useRef } from "react";
import type { Pokemon, LuckyList } from "../types";
import {
  decodeLuckyDexBitset,
  encodeLuckyDexBitset,
  MAX_DEX_NUMBER,
} from "../utils/luckyShare";
import { buildPokedexFromLuckyDexSet } from "../utils/pokedexCatalog";

const STORAGE_KEY = "lucky-pgo-list";
const DEX_QUERY_KEY = "dex";

function removeDexParamFromUrl() {
  const url = new URL(window.location.href);
  if (!url.searchParams.has(DEX_QUERY_KEY)) return;
  url.searchParams.delete(DEX_QUERY_KEY);
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

  useEffect(() => {
    if (luckyList) {
      saveToStorage(luckyList);
    }
  }, [luckyList]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const dexParam = params.get(DEX_QUERY_KEY);
    if (!dexParam) return;

    const decoded = decodeLuckyDexBitset(dexParam, MAX_DEX_NUMBER);
    if (!decoded) {
      setLinkImportError("Shared dex link is invalid or corrupted.");
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

    setPendingDexImport({ encoded: dexParam, luckyCount: decoded.size });
  }, []);

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
      const pokemon = await buildPokedexFromLuckyDexSet(decoded, MAX_DEX_NUMBER);
      setLuckyList({
        pokemon,
        lastUpdated: new Date().toISOString(),
      });
      setLinkImportError(null);
      setLinkImportMessage("Imported lucky list from shared link.");
    } catch {
      setLinkImportError(
        "Could not load the full Pokedex names needed for link import.",
      );
    } finally {
      setImportingFromLink(false);
      setPendingDexImport(null);
      removeDexParamFromUrl();
    }
  }, [pendingDexImport]);

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
