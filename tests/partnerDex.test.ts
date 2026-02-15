import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizePartnerDexNumbers,
  parsePartnerDexData,
  buildPartnerDexData,
} from "../src/hooks/usePartnerDex.js";

test("rejects malformed payloads", () => {
  assert.equal(parsePartnerDexData("not json"), null);
  assert.equal(parsePartnerDexData(JSON.stringify({ dex: "bad" })), null);
  assert.equal(parsePartnerDexData(JSON.stringify({ dex: [1, "2"] })), null);
});

test("clamps out-of-range dex numbers and dedupes", () => {
  const normalized = normalizePartnerDexNumbers([0, 1, 1, 1026, 7]);
  assert.deepEqual(normalized, [1, 7, 1025]);
});

test("round-trips partner dex data", () => {
  const built = buildPartnerDexData(new Set<number>([5, 1026, 1]), "Partner");
  const parsed = parsePartnerDexData(JSON.stringify(built));

  assert.ok(parsed);
  assert.equal(parsed.name, "Partner");
  assert.deepEqual(parsed.dex, [1, 5, 1025]);
  assert.equal(typeof parsed.updatedAt, "string");
});
