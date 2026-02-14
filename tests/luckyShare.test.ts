import test from "node:test";
import assert from "node:assert/strict";
import {
  encodeLuckyDexBitset,
  decodeLuckyDexBitset,
  collectLuckyDexNumbers,
  checksumDexPayload,
} from "../src/utils/luckyShare.js";

test("link share bitset round-trips lucky dex values, including Noibat", () => {
  const pokemon = [
    { dexNumber: 1, name: "Bulbasaur", isLucky: true },
    { dexNumber: 714, name: "Noibat", isLucky: true },
    { dexNumber: 715, name: "Noivern", isLucky: false },
  ];

  const encoded = encodeLuckyDexBitset(pokemon, 1025);
  const decoded = decodeLuckyDexBitset(encoded, 1025);
  assert.ok(decoded);
  assert.equal(decoded.has(1), true);
  assert.equal(decoded.has(714), true);
  assert.equal(decoded.has(715), false);
});

test("collectLuckyDexNumbers keeps only in-range lucky entries", () => {
  const pokemon = [
    { dexNumber: 0, name: "Zero", isLucky: true },
    { dexNumber: 714, name: "Noibat", isLucky: true },
    { dexNumber: 715, name: "Noivern", isLucky: false },
    { dexNumber: 2000, name: "OutOfRange", isLucky: true },
  ];

  const luckyDex = collectLuckyDexNumbers(pokemon, 1025);
  assert.deepEqual([...luckyDex].sort((a, b) => a - b), [714]);
});

test("checksum changes when payload changes", () => {
  const a = checksumDexPayload("abc123");
  const b = checksumDexPayload("abc124");
  assert.notEqual(a, b);
});
