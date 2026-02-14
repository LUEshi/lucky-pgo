import { useState, useCallback, useEffect } from "react";
import type { Pokemon, LuckyList } from "../types";

const STORAGE_KEY = "lucky-pgo-list";

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

  useEffect(() => {
    if (luckyList) {
      saveToStorage(luckyList);
    }
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
  };
}
