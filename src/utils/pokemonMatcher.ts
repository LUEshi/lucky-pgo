// Normalize Pokemon names for matching across data sources.
// Handles things like "Galarian Ponyta" vs "Ponyta (Galarian)" and casing differences.
export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

// Check if a ScrapedDuck Pokemon name matches a user's Pokemon entry.
// ScrapedDuck may use forms like "Alolan Vulpix" while the user's list may have "Vulpix".
// We do a loose match: if the normalized user name is contained in the normalized source name, it's a match.
export function pokemonMatches(
  userName: string,
  sourceName: string,
): boolean {
  const normalUser = normalizeName(userName);
  const normalSource = normalizeName(sourceName);

  // Exact match
  if (normalUser === normalSource) return true;

  // Source contains the user's name (e.g., "Alolan Vulpix" contains "Vulpix")
  if (normalSource.includes(normalUser)) return true;

  // User contains the source name
  if (normalUser.includes(normalSource)) return true;

  return false;
}

// Extract the base Pokemon name from a form name like "Alolan Vulpix" -> "Vulpix"
export function baseName(name: string): string {
  const prefixes = [
    "alolan",
    "galarian",
    "hisuian",
    "paldean",
    "mega",
    "shadow",
    "normal",
    "attack",
    "defense",
    "speed",
    "origin",
    "altered",
    "therian",
    "incarnate",
    "black",
    "white",
    "primal",
  ];
  const lower = name.toLowerCase().trim();
  for (const prefix of prefixes) {
    if (lower.startsWith(prefix + " ")) {
      return name.slice(prefix.length + 1).trim();
    }
  }
  // Handle "Name (Form)" pattern
  const parenMatch = name.match(/^(.+?)\s*\(/);
  if (parenMatch) return parenMatch[1].trim();

  return name.trim();
}

// Look up whether a Pokemon (by ScrapedDuck name) is lucky in the user's list.
// Returns true/false if found, null if the list isn't loaded or the Pokemon isn't in it.
export function findLuckyStatus(
  sourceName: string,
  luckyList: { name: string; isLucky: boolean }[] | undefined,
): boolean | null {
  if (!luckyList) return null;
  const base = baseName(sourceName);
  const match = luckyList.find((p) => pokemonMatches(p.name, base));
  return match?.isLucky ?? null;
}
