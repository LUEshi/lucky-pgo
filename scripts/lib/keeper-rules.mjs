// Business rules for "keep or trash". This is the one place to tune them.
// Bump RULES_VERSION whenever a rule changes so reports say which rules produced them.

export const RULES_VERSION = 3;

export const RULES = {
  // PvP: keep if this Pokemon (or something it evolves into, in the same shadow/regular form)
  // is ranked this high or better in PvPoke's overall rankings for any league.
  // Rank is PvPoke's own rank (shadow entries are ranked alongside regular ones).
  pvpTopRank: 100,

  // PvE: keep if it appears in one of these Pokemon GO Hub per-type attacker tiers
  // (ranked by eDPS, any type of move it can learn, so dual-type Pokemon are checked
  // in every type list they appear in).
  pveKeepTiers: ["SS", "S", "A"],

  // Mega/Primal entries count for the regular (non-shadow) Pokemon that Mega Evolves.
  countMegas: true,

  // Which ways of getting a Pokemon the weekly report covers. "wild" = spawns LeekDuck lists on
  // this week's event pages (event spawns, Community Day, Spotlight Hour). Others available:
  // "raids", "eggs", "research", "rocket".
  sources: ["wild"],
};

export const LEAGUES = [
  { key: "great", label: "Great League", cap: 1500 },
  { key: "ultra", label: "Ultra League", cap: 2500 },
  { key: "master", label: "Master League", cap: 10000 },
];

export const TYPES = [
  "normal", "fighting", "flying", "poison", "ground", "rock", "bug", "ghost", "steel",
  "fire", "water", "grass", "electric", "psychic", "ice", "dragon", "dark", "fairy",
];

export const IV_GUIDANCE = {
  great: "low Attack, high Defense/HP (check a PvP IV rank checker)",
  ultra: "low Attack, high Defense/HP (check a PvP IV rank checker)",
  master: "15/15/15 or close to it",
  pve: "high Attack IV; level it up as far as you can",
};
