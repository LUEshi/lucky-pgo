// Deterministic keep-or-trash engine. Pure functions: no network or filesystem access.
// Rules live in keeper-rules.mjs; data comes from PvPoke (PvP) and Pokemon GO Hub (PvE).
import { LEAGUES, RULES, IV_GUIDANCE } from "./keeper-rules.mjs";
import { createResolver, evolutionLine } from "./species-resolver.mjs";

/** league key -> Map(speciesId -> { rank, score, moveset }) using PvPoke's own rank order. */
export function buildPvpRanks(rankingsByLeague) {
  const out = {};
  for (const { key } of LEAGUES) {
    const ranks = new Map();
    (rankingsByLeague[key] ?? []).forEach((entry, i) => {
      if (!ranks.has(entry.speciesId)) ranks.set(entry.speciesId, { rank: i + 1, score: entry.score, moveset: entry.moveset ?? [] });
    });
    out[key] = ranks;
  }
  return out;
}

/** speciesId -> [{ ...goHubEntry, shadow, mega }] */
export function buildPveIndex(goHubEntries, resolver) {
  const index = new Map();
  const unmatched = new Set();
  for (const e of goHubEntries) {
    const r = resolver.resolve(e.name);
    if (!r) {
      unmatched.add(e.name);
      continue;
    }
    const list = index.get(r.species.speciesId) ?? [];
    list.push({ ...e, shadow: r.shadow, mega: r.mega });
    index.set(r.species.speciesId, list);
  }
  return { index, unmatched: [...unmatched] };
}

const TIER_ORDER = ["SS", "S", "A", "B", "C", "D"];
const tierRank = (t) => {
  const i = TIER_ORDER.indexOf(t);
  return i < 0 ? 99 : i;
};
const titleMove = (id) => id.toLowerCase().split("_").map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");

export function createEvaluator({ gamemaster, rankingsByLeague, goHubEntries, rules = RULES }) {
  const resolver = createResolver(gamemaster);
  const pvp = buildPvpRanks(rankingsByLeague);
  const pve = buildPveIndex(goHubEntries, resolver);
  const gmById = new Map(gamemaster.map((p) => [p.speciesId, p]));

  function evaluate(species, shadow) {
    const line = evolutionLine(species, resolver.byId);
    const reasons = [];
    const best = { pvp: null, pve: null };

    for (const league of LEAGUES) {
      let top = null;
      for (const m of line) {
        const id = shadow ? `${m.speciesId}_shadow` : m.speciesId;
        const r = pvp[league.key].get(id);
        if (r && (!top || r.rank < top.rank)) top = { ...r, via: m, id };
      }
      if (!top) continue;
      if (!best.pvp || top.rank < best.pvp.rank) best.pvp = { league: league.label, rank: top.rank };
      if (top.rank <= rules.pvpTopRank) {
        const gm = gmById.get(top.via.speciesId) ?? {};
        const special = new Set([...(gm.eliteMoves ?? []), ...(gm.legacyMoves ?? [])]);
        reasons.push({
          kind: "pvp",
          league: league.label,
          rank: top.rank,
          via: top.via.speciesName,
          moveset: top.moveset.map(titleMove),
          specialMoves: top.moveset.filter((m) => special.has(m)).map(titleMove),
          ivs: IV_GUIDANCE[league.key],
        });
      }
    }

    const byType = new Map();
    for (const m of line) {
      for (const e of pve.index.get(m.speciesId) ?? []) {
        if (e.shadow !== shadow) continue;
        if (e.mega && (!rules.countMegas || shadow)) continue;
        if (!best.pve || tierRank(e.tier) < tierRank(best.pve.tier) || (e.tier === best.pve.tier && e.rank < best.pve.rank)) {
          best.pve = { type: e.type, tier: e.tier, rank: e.rank };
        }
        if (!rules.pveKeepTiers.includes(e.tier)) continue;
        const prev = byType.get(e.type);
        if (!prev || e.rank < prev.rank) byType.set(e.type, { ...e, via: m.speciesName });
      }
    }
    for (const e of [...byType.values()].sort((a, b) => tierRank(a.tier) - tierRank(b.tier) || a.rank - b.rank)) {
      reasons.push({
        kind: "pve",
        type: e.type,
        tier: e.tier,
        rank: e.rank,
        via: e.name,
        viaSpecies: e.via,
        mega: e.mega,
        moveset: [e.fast, e.charged],
        specialMoves: e.legacy,
        ivs: IV_GUIDANCE.pve,
      });
    }

    return {
      name: species.speciesName,
      speciesId: species.speciesId,
      dex: species.dex,
      shadow,
      // KEEP_ONE: the only reason is a Mega/Primal, and one Pokemon covers the Mega Evolution.
      verdict: !reasons.length ? "TRASH" : reasons.every((r) => r.kind === "pve" && r.mega) ? "KEEP_ONE" : "KEEP",
      reasons,
      best,
    };
  }

  /** Resolve a raw name and evaluate it. Returns null if the name is unknown. */
  function evaluateName(rawName, { shadow } = {}) {
    const r = resolver.resolve(rawName);
    if (!r) return null;
    return evaluate(r.species, shadow ?? r.shadow);
  }

  return { evaluate, evaluateName, resolver, unmatchedGoHub: pve.unmatched };
}

/** Group raw weekly finds by species+form and evaluate each once. */
export function evaluateWeekly(found, evaluator) {
  const groups = new Map();
  const unmatched = new Set();
  for (const f of found) {
    const r = evaluator.resolver.resolve(f.name);
    if (!r) {
      unmatched.add(f.name);
      continue;
    }
    const shadow = f.shadow || r.shadow;
    const key = `${r.species.speciesId}|${shadow}`;
    const g = groups.get(key) ?? { species: r.species, shadow, sources: new Set() };
    g.sources.add(f.source);
    groups.set(key, g);
  }
  const order = { KEEP: 0, KEEP_ONE: 1, TRASH: 2 };
  const pokemon = [...groups.values()]
    .map((g) => ({ ...evaluator.evaluate(g.species, g.shadow), obtainedFrom: [...g.sources].sort() }))
    .sort((a, b) => order[a.verdict] - order[b.verdict] || a.dex - b.dex || Number(a.shadow) - Number(b.shadow));
  return { pokemon, unmatched: [...unmatched].sort() };
}

/** Compare against hand-curated expectations so rule changes can't silently flip known cases. */
export function checkKnownAnswers(knownAnswers, evaluator) {
  const mismatches = [];
  for (const k of knownAnswers) {
    const res = evaluator.evaluateName(k.name, { shadow: !!k.shadow });
    const got = res?.verdict ?? "UNKNOWN";
    if (got !== k.expect) mismatches.push({ ...k, got, reasons: res?.reasons ?? [] });
  }
  return mismatches;
}

export function describeReason(r) {
  const special = r.specialMoves?.length ? ` — needs ${r.specialMoves.join(" + ")} (Elite TM/legacy)` : "";
  if (r.kind === "pvp") return `${r.league} #${r.rank}${r.via ? ` as ${r.via}` : ""}${special}`;
  const cap = r.type[0].toUpperCase() + r.type.slice(1);
  return `${cap} attacker, ${r.tier} tier #${r.rank} as ${r.via}${r.mega ? " (Mega)" : ""}${special}`;
}

export function describeBest(best) {
  const parts = [];
  parts.push(best.pvp ? `best PvP: ${best.pvp.league} #${best.pvp.rank}` : "no PvP ranking");
  parts.push(best.pve ? `best PvE: ${best.pve.type} ${best.pve.tier} tier #${best.pve.rank}` : "not a top-50 attacker of any type");
  return parts.join("; ");
}

export function renderMarkdown(report) {
  const label = (p) => `${p.shadow ? "Shadow " : ""}${p.name}`;
  const keep = report.pokemon.filter((p) => p.verdict === "KEEP");
  const keepOne = report.pokemon.filter((p) => p.verdict === "KEEP_ONE");
  const trash = report.pokemon.filter((p) => p.verdict === "TRASH");
  const lines = [
    `# Keep or Trash — week of ${report.weekOf}`,
    "",
    `Rules v${report.rules.version}: keep if top ${report.rules.pvpTopRank} in any PvPoke league, or ${report.rules.pveKeepTiers.join("/")} tier in any Pokemon GO Hub attacker type list. Otherwise trash.`,
    `Data: snapshot ${report.data.snapshotDate}, PvPoke rankings fetched ${report.data.pvpokeFetchedAt.slice(0, 10)}, GO Hub built ${report.data.goHubBuiltAt?.slice(0, 10) ?? "unknown"}.`,
    "",
  ];
  if (report.changes) {
    const { newKeeps, droppedKeeps } = report.changes;
    if (newKeeps.length || droppedKeeps.length) {
      lines.push("## Changes since last week", "");
      for (const n of newKeeps) lines.push(`- 🆕 keep: ${n}`);
      for (const n of droppedKeeps) lines.push(`- no longer a keep / not available: ${n}`);
      lines.push("");
    }
  }
  lines.push(`## KEEP (${keep.length})`, "");
  for (const p of keep) {
    lines.push(`- **${label(p)}** — ${p.reasons.map(describeReason).join("; ")}`);
    lines.push(`  - Get it from: ${p.obtainedFrom.join(", ")}`);
  }
  lines.push("", `## KEEP ONE — for Mega Evolution only (${keepOne.length})`, "", "Keep your single best one (high Attack IV); trash the rest.", "");
  for (const p of keepOne) lines.push(`- **${label(p)}** — ${p.reasons.map(describeReason).join("; ")}`);
  lines.push("", `## TRASH (${trash.length})`, "");
  for (const p of trash) lines.push(`- ${label(p)} — ${describeBest(p.best)}`);
  if (report.unmatched.length) lines.push("", `## Couldn't identify (${report.unmatched.length})`, "", ...report.unmatched.map((n) => `- ${n}`));
  if (report.knownAnswerMismatches.length) {
    lines.push("", "## ⚠️ Known-answer mismatches", "", "These disagree with `scripts/keeper-known-answers.json` — review the rules or the expectation.", "");
    for (const m of report.knownAnswerMismatches) lines.push(`- ${m.shadow ? "Shadow " : ""}${m.name}: expected ${m.expect}, got ${m.got}${m.why ? ` (${m.why})` : ""}`);
  }
  lines.push(
    "",
    "> Verdicts are per species. Your individual Pokemon still need the right IVs: Great/Ultra want low Attack and high Defense/HP, Master and raids want high Attack (ideally 15/15/15).",
    "",
  );
  return lines.join("\n");
}
