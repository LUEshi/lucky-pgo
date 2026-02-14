import type { Pokemon } from "../types";

// Pokemon names contain only letters, spaces, hyphens, periods, and apostrophes
// e.g. "Mr. Mime", "Ho-Oh", "Farfetch'd", "Nidoran♀" (unicode)
// This rejects header junk like "96.03%", "Owned :", "Obtainable Luckies"
function isPokemonName(s: string): boolean {
  if (!s || s.length < 2 || s.length > 30) return false;
  // Reject if it contains colons, percent signs, digits, or equals
  if (/[:%=0-9]/.test(s)) return false;
  // IMPORTANT: keep this as a whole-label match via `(?:\b|$)`.
  // Prefix matching (`^no`) will incorrectly reject real names like "Noibat"/"Noivern".
  if (/^(no\.?|name|lucky|owned|obtainable|generation|total|confirm|regional|untradable|unreleased|trainer|spreadsheet)(?:\b|$)/i.test(s)) return false;
  // Must start with a letter
  if (!/^[a-zA-Z]/.test(s)) return false;
  return true;
}

// Parse the Google Sheet CSV which has:
// - A large header section (trainer name, stats, generation labels, column headers)
// - Multiple Pokemon per row in repeating 4-column groups: No. | Name | (blank) | Lucky
//   (some groups may be 3 columns: No. | Name | Lucky)
export function parseCsv(text: string): Pokemon[] {
  const lines = text.trim().split(/\r?\n/);
  const pokemon: Pokemon[] = [];
  const seen = new Set<number>();

  // Detect delimiter: if first data-ish line has comma, use comma; otherwise try tabs
  const delimiter = text.includes(",") ? "," : "\t";

  for (const line of lines) {
    const parts = line.split(delimiter);

    // Scan across all columns looking for [dexNumber, name, ..., TRUE/FALSE] groups
    for (let i = 0; i < parts.length - 1; i++) {
      const cell = parts[i].trim();

      // Cell must be exactly a number (not "151 something" or " No.")
      if (!/^\d+$/.test(cell)) continue;
      const dexNumber = parseInt(cell, 10);
      if (dexNumber < 1 || dexNumber > 1025) continue;

      // Find the name: next non-empty cell
      let name = "";
      let nameIdx = -1;
      for (let j = i + 1; j < Math.min(i + 3, parts.length); j++) {
        const val = parts[j]?.trim();
        if (val && isPokemonName(val)) {
          name = val;
          nameIdx = j;
          break;
        }
      }
      if (!name || nameIdx === -1) continue;

      // Find lucky status: look ahead from after the name for TRUE/FALSE
      let isLucky = false;
      let foundStatus = false;
      for (let j = nameIdx + 1; j < Math.min(nameIdx + 4, parts.length); j++) {
        const val = parts[j]?.trim().toUpperCase();
        if (val === "TRUE" || val === "FALSE") {
          isLucky = val === "TRUE";
          foundStatus = true;
          i = j; // skip past this group
          break;
        }
        // Stop if we hit another dex number (start of next group)
        if (val && /^\d+$/.test(val)) {
          i = j - 1; // back up so outer loop picks up this number
          break;
        }
      }

      // If no TRUE/FALSE found, the Pokemon might be untradable/unreleased — skip it
      // (e.g. Victini with a blank lucky column)
      if (!foundStatus) continue;

      if (!seen.has(dexNumber)) {
        seen.add(dexNumber);
        pokemon.push({ dexNumber, name, isLucky });
      }
    }
  }

  return pokemon.sort((a, b) => a.dexNumber - b.dexNumber);
}
