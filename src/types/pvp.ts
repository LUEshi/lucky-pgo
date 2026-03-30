export interface PvpPokemon {
  speciesId: string; // "azumarill", "azumarill_shadow"
  speciesName: string; // "Azumarill"
  dex: number;
  baseStats: { atk: number; def: number; hp: number };
  types: string[];
  fastMoves: string[];
  chargedMoves: string[];
  tags: string[];
}

export interface PvpIVCombo {
  atk: number;
  def: number;
  sta: number;
}

export interface PvpIVResult {
  rank: number;
  total: number;
  level: number;
  cp: number;
  ivs: PvpIVCombo;
  statProduct: number;
  statProductPct: number; // vs rank 1 (100 = same as rank 1)
  effectiveAtk: number;
  effectiveDef: number;
  effectiveHP: number;
}

export interface PvpLeagueResult {
  league: "great" | "ultra" | "master";
  cpCap: number;
  queriedIV: PvpIVResult | null;
  rank1: PvpIVResult | null;
  metaRank: number | null;
  metaScore: number | null;
  moveset: string[] | null;
}

export interface PvpLeagueRanking {
  speciesId: string;
  rank: number;
  score: number;
  moveset: string[];
}

export interface CpmEntry {
  level: number;
  cpm: number;
}

export interface GamemasterData {
  pokemon: PvpPokemon[];
  cpmTable: CpmEntry[];
}

export interface AllRankings {
  great: Map<string, PvpLeagueRanking>;
  ultra: Map<string, PvpLeagueRanking>;
  master: Map<string, PvpLeagueRanking>;
}
