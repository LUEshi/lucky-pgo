import { useCallback, useMemo, useState } from "react";
import { MAX_DEX_NUMBER } from "../utils/luckyShare.js";

export interface PartnerDexData {
  name: string;
  dex: number[];
  updatedAt: string;
}

const STORAGE_KEY = "lucky-pgo-partner-dex";
const DEFAULT_PARTNER_NAME = "Partner";

function clampDexNumber(value: number): number {
  if (value < 1) return 1;
  if (value > MAX_DEX_NUMBER) return MAX_DEX_NUMBER;
  return value;
}

export function normalizePartnerDexNumbers(
  input: unknown,
): number[] | null {
  if (!Array.isArray(input)) return null;

  const deduped = new Set<number>();
  for (const value of input) {
    if (typeof value !== "number" || !Number.isFinite(value)) return null;
    const dex = clampDexNumber(Math.trunc(value));
    deduped.add(dex);
  }

  return Array.from(deduped).sort((a, b) => a - b);
}

export function parsePartnerDexData(raw: string): PartnerDexData | null {
  try {
    const parsed = JSON.parse(raw) as {
      name?: unknown;
      dex?: unknown;
      updatedAt?: unknown;
    };

    if (typeof parsed !== "object" || !parsed) return null;

    const dex = normalizePartnerDexNumbers(parsed.dex);
    if (!dex) return null;

    const name =
      typeof parsed.name === "string" && parsed.name.trim()
        ? parsed.name.trim()
        : DEFAULT_PARTNER_NAME;
    const updatedAt =
      typeof parsed.updatedAt === "string" && parsed.updatedAt
        ? parsed.updatedAt
        : new Date().toISOString();

    return {
      name,
      dex,
      updatedAt,
    };
  } catch {
    return null;
  }
}

export function buildPartnerDexData(
  dex: Set<number>,
  name: string = DEFAULT_PARTNER_NAME,
): PartnerDexData {
  const normalized = normalizePartnerDexNumbers(Array.from(dex)) ?? [];
  return {
    name: name.trim() || DEFAULT_PARTNER_NAME,
    dex: normalized,
    updatedAt: new Date().toISOString(),
  };
}

function loadPartnerDexData(): PartnerDexData | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return parsePartnerDexData(raw);
  } catch {
    return null;
  }
}

function savePartnerDexData(data: PartnerDexData) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function usePartnerDex() {
  const [partnerData, setPartnerData] = useState<PartnerDexData | null>(() =>
    loadPartnerDexData(),
  );

  const setPartnerDex = useCallback((dex: Set<number>, name?: string) => {
    const next = buildPartnerDexData(dex, name);
    savePartnerDexData(next);
    setPartnerData(next);
  }, []);

  const clearPartnerDex = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setPartnerData(null);
  }, []);

  const partnerDex = useMemo(
    () => (partnerData ? new Set(partnerData.dex) : null),
    [partnerData],
  );

  return {
    partnerDex,
    partnerName: partnerData?.name ?? null,
    partnerUpdatedAt: partnerData?.updatedAt ?? null,
    partnerLuckyCount: partnerData?.dex.length ?? 0,
    setPartnerDex,
    clearPartnerDex,
    hasPartner: !!partnerData,
  };
}
