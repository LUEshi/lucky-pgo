import type { Pokemon } from "../types";

export const MAX_DEX_NUMBER = 1025;

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(input: string): Uint8Array | null {
  if (!input) return null;
  const base64 = input.replace(/-/g, "+").replace(/_/g, "/");
  const padLen = (4 - (base64.length % 4)) % 4;
  const padded = base64 + "=".repeat(padLen);
  try {
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  } catch {
    return null;
  }
}

export function encodeLuckyDexBitset(
  pokemon: Pokemon[],
  maxDex: number = MAX_DEX_NUMBER,
): string {
  const bytes = new Uint8Array(Math.ceil(maxDex / 8));
  for (const entry of pokemon) {
    if (!entry.isLucky || entry.dexNumber < 1 || entry.dexNumber > maxDex) continue;
    const idx = entry.dexNumber - 1;
    bytes[Math.floor(idx / 8)] |= 1 << (idx % 8);
  }
  return toBase64Url(bytes);
}

export function collectLuckyDexNumbers(
  pokemon: Pokemon[],
  maxDex: number = MAX_DEX_NUMBER,
): Set<number> {
  const set = new Set<number>();
  for (const entry of pokemon) {
    if (!entry.isLucky || entry.dexNumber < 1 || entry.dexNumber > maxDex) continue;
    set.add(entry.dexNumber);
  }
  return set;
}

export function decodeLuckyDexBitset(
  encoded: string,
  maxDex: number = MAX_DEX_NUMBER,
): Set<number> | null {
  const bytes = fromBase64Url(encoded);
  if (!bytes) return null;

  const neededLen = Math.ceil(maxDex / 8);
  if (bytes.length < neededLen) return null;

  const luckyDex = new Set<number>();
  for (let dexNumber = 1; dexNumber <= maxDex; dexNumber++) {
    const idx = dexNumber - 1;
    const byte = bytes[Math.floor(idx / 8)];
    if (byte & (1 << (idx % 8))) {
      luckyDex.add(dexNumber);
    }
  }
  return luckyDex;
}

export function checksumDexPayload(encoded: string): string {
  // FNV-1a 32-bit hash, hex-encoded for compact URL integrity checking.
  let hash = 0x811c9dc5;
  for (let i = 0; i < encoded.length; i++) {
    hash ^= encoded.charCodeAt(i);
    hash = (hash * 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}
