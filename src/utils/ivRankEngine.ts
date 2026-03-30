import type { CpmEntry, PvpIVCombo, PvpIVResult } from "../types/pvp";

/**
 * CP formula: floor(max(10, (baseAtk + atkIV) * sqrt(baseDef + defIV) * sqrt(baseSta + staIV) * cpm² / 10))
 */
export function computeCP(
  baseAtk: number,
  atkIV: number,
  baseDef: number,
  defIV: number,
  baseSta: number,
  staIV: number,
  cpm: number,
): number {
  const atk = baseAtk + atkIV;
  const def = baseDef + defIV;
  const sta = baseSta + staIV;
  const cp = Math.floor((atk * Math.sqrt(def) * Math.sqrt(sta) * cpm * cpm) / 10);
  return Math.max(10, cp);
}

/**
 * Effective stats:
 *   effectiveAtk = (base+iv)*cpm
 *   effectiveDef = (base+iv)*cpm
 *   effectiveHP = floor((base+iv)*cpm)
 *   statProduct = effectiveAtk * effectiveDef * effectiveHP
 */
export function computeStatProduct(
  baseAtk: number,
  atkIV: number,
  baseDef: number,
  defIV: number,
  baseSta: number,
  staIV: number,
  cpm: number,
): { statProduct: number; effectiveAtk: number; effectiveDef: number; effectiveHP: number } {
  const effectiveAtk = (baseAtk + atkIV) * cpm;
  const effectiveDef = (baseDef + defIV) * cpm;
  const effectiveHP = Math.floor((baseSta + staIV) * cpm);
  const statProduct = effectiveAtk * effectiveDef * effectiveHP;
  return { statProduct, effectiveAtk, effectiveDef, effectiveHP };
}

interface RankedCombo {
  ivs: PvpIVCombo;
  level: number;
  cp: number;
  statProduct: number;
  effectiveAtk: number;
  effectiveDef: number;
  effectiveHP: number;
}

/**
 * Compute rank of target IVs among all 4096 combinations (or ivFloor-adjusted set).
 * Sort descending by statProduct; break ties by higher effectiveAtk (CMP advantage).
 * For Master League pass cpCap=Infinity — finds best level at maxLevel.
 */
export function getIVRankResult(
  baseStats: { atk: number; def: number; hp: number },
  cpmTable: CpmEntry[],
  cpCap: number, // 1500 | 2500 | Infinity
  targetIVs: PvpIVCombo,
  ivFloor = 0,
  maxLevel = 50,
): { queriedIV: PvpIVResult; rank1: PvpIVResult } | null {
  const filtered = cpmTable.filter((entry) => entry.level <= maxLevel);
  if (filtered.length === 0) return null;

  const combos: RankedCombo[] = [];

  for (let atkIV = ivFloor; atkIV <= 15; atkIV++) {
    for (let defIV = ivFloor; defIV <= 15; defIV++) {
      for (let staIV = ivFloor; staIV <= 15; staIV++) {
        let bestLevel: number;
        let bestCpm: number;

        if (!isFinite(cpCap)) {
          // Master League: use highest level in filtered table
          const last = filtered[filtered.length - 1];
          bestLevel = last.level;
          bestCpm = last.cpm;
        } else {
          // Binary search for highest level where CP <= cpCap
          let lo = 0;
          let hi = filtered.length - 1;
          let foundIdx = -1;

          while (lo <= hi) {
            const mid = (lo + hi) >> 1;
            const cp = computeCP(
              baseStats.atk,
              atkIV,
              baseStats.def,
              defIV,
              baseStats.hp,
              staIV,
              filtered[mid].cpm,
            );
            if (cp <= cpCap) {
              foundIdx = mid;
              lo = mid + 1;
            } else {
              hi = mid - 1;
            }
          }

          if (foundIdx === -1) continue; // No valid level found
          bestLevel = filtered[foundIdx].level;
          bestCpm = filtered[foundIdx].cpm;
        }

        const cp = computeCP(
          baseStats.atk,
          atkIV,
          baseStats.def,
          defIV,
          baseStats.hp,
          staIV,
          bestCpm,
        );
        const stats = computeStatProduct(
          baseStats.atk,
          atkIV,
          baseStats.def,
          defIV,
          baseStats.hp,
          staIV,
          bestCpm,
        );

        combos.push({
          ivs: { atk: atkIV, def: defIV, sta: staIV },
          level: bestLevel,
          cp,
          ...stats,
        });
      }
    }
  }

  if (combos.length === 0) return null;

  // Sort descending by statProduct, break ties by descending effectiveAtk
  combos.sort((a, b) => {
    if (b.statProduct !== a.statProduct) return b.statProduct - a.statProduct;
    return b.effectiveAtk - a.effectiveAtk;
  });

  const rank1Combo = combos[0];

  // Find target IVs in sorted list
  const targetIdx = combos.findIndex(
    (c) => c.ivs.atk === targetIVs.atk && c.ivs.def === targetIVs.def && c.ivs.sta === targetIVs.sta,
  );

  if (targetIdx === -1) return null;

  const targetCombo = combos[targetIdx];
  const total = combos.length;

  const rank1Result: PvpIVResult = {
    rank: 1,
    total,
    level: rank1Combo.level,
    cp: rank1Combo.cp,
    ivs: rank1Combo.ivs,
    statProduct: rank1Combo.statProduct,
    statProductPct: 100,
    effectiveAtk: rank1Combo.effectiveAtk,
    effectiveDef: rank1Combo.effectiveDef,
    effectiveHP: rank1Combo.effectiveHP,
  };

  const queriedResult: PvpIVResult = {
    rank: targetIdx + 1,
    total,
    level: targetCombo.level,
    cp: targetCombo.cp,
    ivs: targetCombo.ivs,
    statProduct: targetCombo.statProduct,
    statProductPct: (targetCombo.statProduct / rank1Combo.statProduct) * 100,
    effectiveAtk: targetCombo.effectiveAtk,
    effectiveDef: targetCombo.effectiveDef,
    effectiveHP: targetCombo.effectiveHP,
  };

  return { queriedIV: queriedResult, rank1: rank1Result };
}
