import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { computeCP, computeStatProduct, getIVRankResult } from "../src/utils/ivRankEngine.js";
import type { CpmEntry } from "../src/types/pvp.js";

const MINIMAL_CPM: CpmEntry[] = [
  { level: 1, cpm: 0.094 },
  { level: 1.5, cpm: 0.135 },
  { level: 2, cpm: 0.166 },
  { level: 5, cpm: 0.29 },
  { level: 10, cpm: 0.422 },
  { level: 15, cpm: 0.517 },
  { level: 20, cpm: 0.5974 },
  { level: 25, cpm: 0.667 },
  { level: 30, cpm: 0.7317 },
  { level: 35, cpm: 0.76 },
  { level: 40, cpm: 0.813 },
  { level: 40.5, cpm: 0.817 },
  { level: 41, cpm: 0.821 },
  { level: 50, cpm: 0.89 },
];

describe("computeCP", () => {
  it("should use the correct CP formula", () => {
    // CP = floor((baseAtk+atkIV) * sqrt(baseDef+defIV) * sqrt(baseSta+staIV) * cpm² / 10)
    // computeCP(30, 3, 30, 3, 30, 3, 0.813):
    //   atk=33, def=33, sta=33, cpm²=0.661
    //   = floor(33 * sqrt(33) * sqrt(33) * 0.661 / 10)
    //   = floor(33 * 33 * 0.661 / 10)
    //   = floor(1089 * 0.661 / 10)
    //   = floor(719.8 / 10)
    //   = floor(71.98) = 71
    const result = computeCP(30, 3, 30, 3, 30, 3, 0.813);
    assert.equal(result, 71);
  });

  it("should return minimum CP of 10", () => {
    // Very low base stats, low cpm
    const result = computeCP(1, 0, 1, 0, 1, 0, 0.094);
    assert.ok(result >= 10, `Expected CP >= 10, got ${result}`);
  });

  it("should increase with higher IVs", () => {
    const cp0 = computeCP(100, 0, 100, 0, 100, 0, 0.5);
    const cp15 = computeCP(100, 15, 100, 15, 100, 15, 0.5);
    assert.ok(cp15 > cp0, `Expected 15/15/15 CP (${cp15}) > 0/0/0 CP (${cp0})`);
  });
});

describe("computeStatProduct", () => {
  it("should compute effective stats correctly", () => {
    const cpm = 0.5;
    const { effectiveAtk, effectiveDef, effectiveHP, statProduct } = computeStatProduct(
      100, 10, 100, 10, 100, 10, cpm
    );
    // effectiveAtk = (100 + 10) * 0.5 = 55
    assert.equal(effectiveAtk, 55);
    // effectiveDef = (100 + 10) * 0.5 = 55
    assert.equal(effectiveDef, 55);
    // effectiveHP = floor((100 + 10) * 0.5) = floor(55) = 55
    assert.equal(effectiveHP, 55);
    // statProduct = 55 * 55 * 55 = 166375
    assert.equal(statProduct, 166375);
  });

  it("should floor effectiveHP", () => {
    const cpm = 0.3;
    const { effectiveHP } = computeStatProduct(100, 0, 100, 0, 100, 0, cpm);
    // effectiveHP = floor(100 * 0.3) = floor(30) = 30
    assert.equal(effectiveHP, 30);
  });

  it("should not floor effectiveAtk and effectiveDef", () => {
    const cpm = 0.3;
    const { effectiveAtk, effectiveDef } = computeStatProduct(100, 0, 100, 0, 100, 0, cpm);
    // effectiveAtk = 100 * 0.3 = 30 (exact)
    assert.equal(effectiveAtk, 30);
    assert.equal(effectiveDef, 30);
  });
});

describe("getIVRankResult - Master League (no CP cap)", () => {
  it("should rank 15/15/15 as #1 in Master League", () => {
    const baseStats = { atk: 200, def: 150, hp: 200 };
    const result = getIVRankResult(
      baseStats,
      MINIMAL_CPM,
      Infinity,
      { atk: 15, def: 15, sta: 15 },
      0,
      50
    );
    assert.ok(result !== null, "Expected result to not be null");
    assert.equal(result.queriedIV.rank, 1, `Expected rank 1, got ${result.queriedIV.rank}`);
    assert.equal(result.rank1.ivs.atk, 15);
    assert.equal(result.rank1.ivs.def, 15);
    assert.equal(result.rank1.ivs.sta, 15);
  });

  it("should have statProductPct of 100 for rank 1", () => {
    const baseStats = { atk: 200, def: 150, hp: 200 };
    const result = getIVRankResult(
      baseStats,
      MINIMAL_CPM,
      Infinity,
      { atk: 15, def: 15, sta: 15 },
      0,
      50
    );
    assert.ok(result !== null);
    assert.equal(result.rank1.statProductPct, 100);
  });

  it("should have total of 4096 combos for ivFloor=0", () => {
    const baseStats = { atk: 200, def: 150, hp: 200 };
    const result = getIVRankResult(
      baseStats,
      MINIMAL_CPM,
      Infinity,
      { atk: 15, def: 15, sta: 15 },
      0,
      50
    );
    assert.ok(result !== null);
    assert.equal(result.queriedIV.total, 4096, `Expected 4096 total, got ${result.queriedIV.total}`);
  });
});

describe("getIVRankResult - Great League", () => {
  it("should find a valid result for a Pokemon under CP 1500", () => {
    // Use Azumarill-like stats: ATK=112, DEF=152, HP=225
    const baseStats = { atk: 112, def: 152, hp: 225 };
    const result = getIVRankResult(
      baseStats,
      MINIMAL_CPM,
      1500,
      { atk: 8, def: 15, sta: 15 }, // typical Azumarill GL spread
      0,
      50
    );
    // Should find a result (Azumarill works well in GL)
    assert.ok(result !== null, "Expected result for Azumarill in GL");
    assert.ok(result.queriedIV.rank >= 1, "Rank should be >= 1");
    assert.ok(result.queriedIV.cp <= 1500, `CP ${result.queriedIV.cp} should be <= 1500`);
  });

  it("should rank lower ATK IV as better than higher ATK IV for Great League bulk", () => {
    // For GL, lower ATK can lead to better stat product because you can power up higher
    // Use a bulky Pokemon where the CP ceiling matters
    // Lanturn-like: ATK=146, DEF=146, HP=260
    const baseStats = { atk: 146, def: 146, hp: 260 };

    // Check 1/15/14 vs 15/15/15 in Great League
    const lowAtkResult = getIVRankResult(
      baseStats,
      MINIMAL_CPM,
      1500,
      { atk: 0, def: 15, sta: 15 },
      0,
      50
    );
    const highAtkResult = getIVRankResult(
      baseStats,
      MINIMAL_CPM,
      1500,
      { atk: 15, def: 15, sta: 15 },
      0,
      50
    );

    assert.ok(lowAtkResult !== null, "Low ATK result should not be null");
    assert.ok(highAtkResult !== null, "High ATK result should not be null");

    // In GL, lower ATK IVs often rank better because they allow higher level powering up
    // (with the same CP cap, a Pokemon with lower ATK can have better overall stat product)
    assert.ok(
      lowAtkResult.queriedIV.rank <= highAtkResult.queriedIV.rank,
      `Lower ATK IV rank (${lowAtkResult.queriedIV.rank}) should be <= high ATK IV rank (${highAtkResult.queriedIV.rank})`
    );
  });
});

describe("getIVRankResult - ivFloor", () => {
  it("should exclude combos below ivFloor", () => {
    const baseStats = { atk: 200, def: 150, hp: 200 };

    // With floor 12, each IV is 12-15, so 4^3 = 64 combinations
    const resultWith12Floor = getIVRankResult(
      baseStats,
      MINIMAL_CPM,
      Infinity,
      { atk: 15, def: 15, sta: 15 },
      12,
      50
    );
    assert.ok(resultWith12Floor !== null);
    assert.equal(
      resultWith12Floor.queriedIV.total,
      64,
      `Expected 64 combos with floor 12, got ${resultWith12Floor.queriedIV.total}`
    );
  });

  it("should return null if target IVs are below ivFloor", () => {
    const baseStats = { atk: 200, def: 150, hp: 200 };

    // Target IVs of 0/14/15 with floor 12 — 0 is below the floor
    const result = getIVRankResult(
      baseStats,
      MINIMAL_CPM,
      Infinity,
      { atk: 0, def: 14, sta: 15 },
      12,
      50
    );
    assert.equal(result, null, "Expected null when target IVs are below floor");
  });

  it("should have total of 1 when floor is 15", () => {
    const baseStats = { atk: 200, def: 150, hp: 200 };
    const result = getIVRankResult(
      baseStats,
      MINIMAL_CPM,
      Infinity,
      { atk: 15, def: 15, sta: 15 },
      15,
      50
    );
    assert.ok(result !== null);
    assert.equal(result.queriedIV.total, 1, `Expected 1 combo with floor 15, got ${result.queriedIV.total}`);
    assert.equal(result.queriedIV.rank, 1);
  });
});
