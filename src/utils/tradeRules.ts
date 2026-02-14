import { baseName, normalizeName } from "./pokemonMatcher.js";

const UNTRADABLE_MYTHICAL_KEYS = new Set<string>([
  "mew",
  "celebi",
  "jirachi",
  "deoxys",
  "phione",
  "manaphy",
  "darkrai",
  "shaymin",
  "arceus",
  "victini",
  "keldeo",
  "meloetta",
  "genesect",
  "diancie",
  "hoopa",
  "volcanion",
  "magearna",
  "marshadow",
  "zeraora",
  "zarude",
  "pecharunt",
]);

function isLegendaryTier(tier: string): boolean {
  const normalized = tier.toLowerCase();
  return (
    normalized.includes("5-star") ||
    normalized.includes("5 star") ||
    normalized.startsWith("5") ||
    normalized.includes("elite")
  );
}

function isUntradableMythical(name: string): boolean {
  const key = normalizeName(baseName(name));
  return UNTRADABLE_MYTHICAL_KEYS.has(key);
}

interface RaidTradeRuleInput {
  name: string;
  tier: string;
  isShadow: boolean;
  isNeeded: boolean;
}

export function getRaidTradeNote({
  name,
  tier,
  isShadow,
  isNeeded,
}: RaidTradeRuleInput): string | null {
  if (!isNeeded) return null;

  if (isUntradableMythical(name)) {
    return "Can't Trade (Mythical)";
  }

  // Shadow Pokemon cannot be traded directly; once purified, treat as Special Trade.
  if (isShadow) return "Purify + Special Trade";

  const needsSpecialTrade = isLegendaryTier(tier);
  if (needsSpecialTrade) return "Special Trade";
  return null;
}
