// Parse Pokemon GO Hub's "Best <Type>-type Attackers" pages
// (https://db.pokemongohub.net/pokemon-list/best-per-type/<type>), ranked by eDPS.
import { JSDOM } from "jsdom";

export const GOHUB_URL = (type) => `https://db.pokemongohub.net/pokemon-list/best-per-type/${type}`;
// Max Battle attackers (Dynamax / Gigantamax), ranked by Max Attack damage, tiers SS..F.
export const GOHUB_DMAX_URL = (type) => `https://db.pokemongohub.net/pokemon-list/best-dynamax-per-type/${type}`;

/**
 * Works for both the raid page (Charged Attack / eDPS / % of best) and the Dynamax page (Max Attack / DMG).
 * Returns { builtAt, entries: [{ type, tier, rank, name, fast, charged, legacy, edps, pctOfBest, dmg }] }.
 * The Tier column spans rows, so rows without a tier cell inherit the previous tier.
 */
export function parseGoHubTypePage(html, type) {
  const doc = new JSDOM(html).window.document;
  const table = doc.querySelector("table");
  if (!table) throw new Error(`GO Hub ${type}: no table found (page layout changed?)`);

  const header = [...table.querySelectorAll("tr")[0].children].map((c) => c.textContent.replace(/^Sort:\s*/, "").trim());
  const col = (label) => header.findIndex((h) => h.toLowerCase().startsWith(label));
  const charged = col("charged") >= 0 ? col("charged") : col("max attack");
  const idx = { tier: col("tier"), rank: col("#"), name: col("pok"), fast: col("fast"), charged, edps: col("edps"), pct: col("% of best"), dmg: col("dmg") };
  const required = [idx.tier, idx.rank, idx.name, idx.fast, idx.charged];
  if (required.some((i) => i < 0)) throw new Error(`GO Hub ${type}: unexpected columns ${header.join(", ")}`);

  const entries = [];
  let tier = null;
  for (const row of [...table.querySelectorAll("tr")].slice(1)) {
    let cells = [...row.children].map((c) => c.textContent.replace(/\s+/g, " ").trim());
    if (cells.length === header.length) tier = cells[idx.tier];
    else if (cells.length === header.length - 1) cells = [tier, ...cells];
    else continue;
    const fast = cells[idx.fast];
    const charged = cells[idx.charged];
    entries.push({
      type,
      tier,
      rank: Number.parseInt(cells[idx.rank], 10),
      name: cells[idx.name],
      fast: fast.replace(/\+$/, ""),
      charged: charged.replace(/\+$/, ""),
      // GO Hub marks Elite TM / legacy / Community Day moves with "+"
      legacy: [fast, charged].filter((m) => m.endsWith("+")).map((m) => m.replace(/\+$/, "")),
      edps: idx.edps >= 0 ? Number.parseFloat(cells[idx.edps]) : null,
      pctOfBest: idx.pct >= 0 ? cells[idx.pct] : null,
      dmg: idx.dmg >= 0 ? Number.parseFloat(cells[idx.dmg]) : null,
    });
  }
  if (!entries.length) throw new Error(`GO Hub ${type}: table had no rows`);
  const builtAt = doc.querySelector("time[datetime]")?.getAttribute("datetime") ?? null;
  return { builtAt, entries };
}
