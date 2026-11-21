// Pure logic for the keep-or-junk evaluator. No network / filesystem access here.

export const LEAGUES = [
  { key: "great", label: "Great", cap: 1500 },
  { key: "ultra", label: "Ultra", cap: 2500 },
  { key: "master", label: "Master", cap: 10000 },
];

export const DEFAULT_THRESHOLDS = {
  // PvP: rank among non-shadow, non-mega species in PvPoke's overall rankings
  pvpKeep: { great: 150, ultra: 150, master: 100 },
  pvpMaybe: { great: 300, ultra: 300, master: 200 },
  // PvE proxies (base-stat based, see computePveProxies)
  attackerOverallTop: 60,
  attackerTypeTop: 3,
  defenderTop: 40,
};

export function normalizeKey(name) {
  return String(name)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

const REGIONS = ["alolan", "galarian", "hisuian", "paldean"];

/** "Alolan Vulpix" / "Vulpix (Alolan)" -> "vulpixalolan"; "Passimian" -> "passimian". */
export function speciesKey(name) {
  let n = String(name).trim();
  const paren = n.match(/^(.*?)\s*\(([^)]*)\)\s*$/);
  let region = "";
  if (paren) {
    n = paren[1];
    region = normalizeKey(paren[2]);
  }
  const words = n.split(/\s+/);
  if (words.length > 1 && REGIONS.includes(normalizeKey(words[0]))) {
    region = normalizeKey(words[0]);
    n = words.slice(1).join(" ");
  }
  return normalizeKey(n) + region;
}

const isVariant = (s) => /_shadow$|_mega|_primal|_gmax|_dynamax/.test(s.speciesId);

/** Keep only plain, released species (no shadow / mega duplicates). */
export function baseSpecies(gamemaster) {
  return gamemaster.filter((p) => p.released !== false && !isVariant(p) && p.baseStats);
}

export function buildSpeciesIndex(gamemaster) {
  const index = new Map();
  for (const p of baseSpecies(gamemaster)) {
    const key = speciesKey(p.speciesName);
    if (!index.has(key)) index.set(key, p);
  }
  return index;
}

/** speciesId -> rank (1-based) among non-variant species for each league. */
export function buildPvpRanks(rankingsByLeague) {
  const out = {};
  for (const { key } of LEAGUES) {
    const ranks = new Map();
    let n = 0;
    for (const entry of rankingsByLeague[key] ?? []) {
      if (isVariant(entry)) continue;
      n += 1;
      ranks.set(entry.speciesId, { rank: n, score: entry.score });
    }
    out[key] = { ranks, total: n };
  }
  return out;
}

/** The species plus everything it can evolve into (walks PvPoke's explicit evolution links). */
export function familyMembers(species, gamemaster) {
  const byId = new Map(baseSpecies(gamemaster).map((p) => [p.speciesId, p]));
  const seen = new Map([[species.speciesId, species]]);
  const queue = [species];
  while (queue.length) {
    const cur = queue.shift();
    for (const id of cur.family?.evolutions ?? []) {
      const next = byId.get(id);
      if (next && !seen.has(id)) {
        seen.set(id, next);
        queue.push(next);
      }
    }
  }
  return [...seen.values()];
}

const fullyEvolved = (p) => !(p.family?.evolutions?.length > 0);

/** Base-stat proxies for PvE attackers and gym defenders. */
export function computePveProxies(gamemaster) {
  const finals = baseSpecies(gamemaster).filter(fullyEvolved);
  const byAtk = [...finals].sort((a, b) => b.baseStats.atk - a.baseStats.atk);
  const attackerOverall = new Map(byAtk.map((p, i) => [p.speciesId, i + 1]));

  const attackerType = new Map();
  const perType = new Map();
  for (const p of byAtk) {
    for (const t of p.types ?? []) {
      if (!t || t === "none") continue;
      const arr = perType.get(t) ?? [];
      arr.push(p.speciesId);
      perType.set(t, arr);
    }
  }
  for (const [type, ids] of perType) {
    ids.forEach((id, i) => {
      const prev = attackerType.get(id);
      if (!prev || i + 1 < prev.rank) attackerType.set(id, { type, rank: i + 1 });
    });
  }

  const bulk = (p) => p.baseStats.def * p.baseStats.hp;
  const byBulk = [...finals].sort((a, b) => bulk(b) - bulk(a));
  const defenderRank = new Map(byBulk.map((p, i) => [p.speciesId, i + 1]));
  return { attackerOverall, attackerType, defenderRank, total: finals.length };
}

/**
 * Evaluate one species (and its evolution line). Returns a verdict plus reasons.
 * verdict: KEEP | MAYBE | JUNK
 */
export function evaluateSpecies(species, ctx) {
  const { gamemaster, pvp, pve, thresholds = DEFAULT_THRESHOLDS } = ctx;
  const line = familyMembers(species, gamemaster);
  const keepReasons = [];
  const maybeReasons = [];
  const detail = {};

  for (const { key, label } of LEAGUES) {
    let best = null;
    for (const m of line) {
      const r = pvp[key].ranks.get(m.speciesId);
      if (r && (!best || r.rank < best.rank)) best = { ...r, via: m.speciesName };
    }
    detail[key] = best;
    if (!best) continue;
    const text = `${label} League #${best.rank}${best.via !== species.speciesName ? ` (as ${best.via})` : ""}`;
    if (best.rank <= thresholds.pvpKeep[key]) keepReasons.push(text);
    else if (best.rank <= thresholds.pvpMaybe[key]) maybeReasons.push(text);
  }

  let bestAtk = null;
  let bestType = null;
  let bestDef = null;
  for (const m of line) {
    const a = pve.attackerOverall.get(m.speciesId);
    if (a && (!bestAtk || a < bestAtk.rank)) bestAtk = { rank: a, via: m.speciesName };
    const t = pve.attackerType.get(m.speciesId);
    if (t && (!bestType || t.rank < bestType.rank)) bestType = { ...t, via: m.speciesName };
    const d = pve.defenderRank.get(m.speciesId);
    if (d && (!bestDef || d < bestDef.rank)) bestDef = { rank: d, via: m.speciesName };
  }
  detail.attacker = bestAtk;
  detail.attackerType = bestType;
  detail.defender = bestDef;

  if (bestAtk && bestAtk.rank <= thresholds.attackerOverallTop) {
    keepReasons.push(`Top-${thresholds.attackerOverallTop} base attack (#${bestAtk.rank}, ${bestAtk.via})`);
  } else if (bestType && bestType.rank <= thresholds.attackerTypeTop) {
    keepReasons.push(`Top-${thresholds.attackerTypeTop} ${bestType.type} attacker by base attack (#${bestType.rank}, ${bestType.via})`);
  }
  if (bestDef && bestDef.rank <= thresholds.defenderTop) {
    keepReasons.push(`Top-${thresholds.defenderTop} gym defender by bulk (#${bestDef.rank}, ${bestDef.via})`);
  }

  const verdict = keepReasons.length ? "KEEP" : maybeReasons.length ? "MAYBE" : "JUNK";
  return { name: species.speciesName, speciesId: species.speciesId, verdict, keepReasons, maybeReasons, detail };
}

/** Collect wild-spawn names from a history snapshot's events. */
export function wildNamesFromSnapshot(snapshot, { now = new Date(), includeUpcoming = false } = {}) {
  const names = new Map(); // name -> Set(event names)
  const add = (name, event) => {
    if (!name) return;
    if (!names.has(name)) names.set(name, new Set());
    names.get(name).add(event);
  };
  for (const ev of snapshot?.data?.events ?? []) {
    const start = ev.start ? new Date(ev.start) : null;
    const end = ev.end ? new Date(ev.end) : null;
    const active = (!start || start <= now) && (!end || end >= now);
    const upcoming = start && start > now;
    if (!active && !(includeUpcoming && upcoming)) continue;
    const generic = ev.extraData?.generic;
    for (const s of generic?.spawns ?? []) add(s.name, ev.name);
    for (const s of ev.extraData?.spotlight?.list ?? []) add(s.name, ev.name);
  }
  return names;
}

export function renderReport(results, { date, source }) {
  const order = { KEEP: 0, MAYBE: 1, JUNK: 2 };
  const sorted = [...results].sort((a, b) => order[a.verdict] - order[b.verdict] || a.name.localeCompare(b.name));
  const lines = [`# Keep or junk — ${date}`, "", `Source: ${source}`, ""];
  for (const v of ["KEEP", "MAYBE", "JUNK"]) {
    const group = sorted.filter((r) => r.verdict === v);
    lines.push(`## ${v} (${group.length})`, "");
    if (!group.length) {
      lines.push("_none_", "");
      continue;
    }
    for (const r of group) {
      const why = v === "KEEP" ? r.keepReasons : v === "MAYBE" ? r.maybeReasons : [];
      const events = r.events?.length ? ` — _${r.events.join(", ")}_` : "";
      lines.push(`- **${r.name}**${why.length ? `: ${why.join("; ")}` : ""}${events}`);
    }
    lines.push("");
  }
  lines.push(
    "> KEEP/MAYBE for PvP still depends on IVs: Great/Ultra want low Attack and high Defense/HP, Master wants 15/15/15.",
    "> PvE attacker and gym-defender checks are base-stat proxies, not move-aware simulations.",
    "",
  );
  return lines.join("\n");
}
