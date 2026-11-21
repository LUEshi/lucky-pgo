// Resolve Pokemon names from LeekDuck / Pokemon GO Hub into PvPoke species.
// Each site writes forms differently ("Alolan Vulpix" vs "Vulpix (Alolan)",
// "Therian Forme Tornadus" vs "Tornadus (Therian)"), so matching is done on word tokens.

const FILLER = new Set(["forme", "form", "mode", "style", "cloak", "breed", "size", "the", "of"]);
// When a name has no form, these are the form words that mean "the default one".
const DEFAULT_FORM_WORDS = new Set([
  "normal", "standard", "incarnate", "altered", "ordinary", "average", "plant", "overcast",
  "west", "land", "aria", "confined", "baile", "midday", "solo", "red", "hero", "phony",
  "unremarkable", "single", "strike", "amped", "full", "belly", "combat", "spring",
]);

export function tokens(name) {
  return String(name)
    .replace(/♀/g, " female ")
    .replace(/♂/g, " male ")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t && !FILLER.has(t));
}

const REGIONS = new Set(["alolan", "galarian", "hisuian", "paldean"]);
const keyOf = (toks) => [...toks].sort().join(" ");
const isVariantId = (id) => /_shadow$|_mega|_primal/.test(id);

/** Strip prefixes that change the form you catch, returning flags for them. */
export function parseName(raw) {
  let name = String(raw).replace(/\s+/g, " ").trim();
  let shadow = false;
  let mega = false;
  if (/\bshadow\b/i.test(name)) {
    shadow = true;
    name = name.replace(/\bshadow\b/gi, " ");
  }
  if (/^(mega|primal)\b/i.test(name.trim())) {
    mega = true;
    name = name.trim().replace(/^(mega|primal)\s+/i, "").replace(/\s+[XY]$/, "");
  }
  name = name.replace(/^(gigantamax|dynamax)\s+/i, "");
  return { name: name.replace(/\s+/g, " ").trim(), shadow, mega };
}

/** Looks like a real name (LeekDuck research rewards include items like "×500"). */
export function isPokemonLike(raw) {
  const s = String(raw).trim();
  return /^[A-Za-zÀ-ÿ]/.test(s) && !/^Ã/.test(s) && /[a-z]/i.test(s);
}

export function createResolver(gamemaster) {
  const species = gamemaster.filter((p) => p.released !== false && p.baseStats && !isVariantId(p.speciesId));
  const byKey = new Map();
  const entries = species.map((p) => {
    const toks = tokens(p.speciesName);
    const key = keyOf(toks);
    if (!byKey.has(key)) byKey.set(key, p);
    return { p, toks: new Set(toks) };
  });
  const byId = new Map(species.map((p) => [p.speciesId, p]));

  function resolve(raw) {
    const parsed = parseName(raw);
    const q = tokens(parsed.name);
    if (!q.length) return null;
    const exact = byKey.get(keyOf(q));
    if (exact) return { ...parsed, species: exact };

    const qs = new Set(q);
    // 1) Species that has every query word plus default-form words ("Darmanitan" -> "Darmanitan (Standard)").
    const supersets = entries.filter((e) => q.every((t) => e.toks.has(t)));
    const scored = supersets
      .map((e) => {
        const extra = [...e.toks].filter((t) => !qs.has(t));
        return { e, extra: extra.length, nonDefault: extra.filter((t) => !DEFAULT_FORM_WORDS.has(t)).length };
      })
      .sort((a, b) => a.nonDefault - b.nonDefault || a.extra - b.extra || a.e.p.speciesName.localeCompare(b.e.p.speciesName));
    if (scored.length && scored[0].nonDefault === 0) return { ...parsed, species: scored[0].e.p };

    // 2) Species whose words are all in the query ("Paldean Tauros (Blaze Breed)" -> "Tauros (Blaze)").
    // Prefer the candidate with the same region ("Galarian Standard Darmanitan" -> "Darmanitan (Galarian)").
    const regionHits = (e) => [...e.toks].filter((t) => REGIONS.has(t)).length;
    const subsets = entries
      .filter((e) => [...e.toks].every((t) => qs.has(t)))
      .sort((a, b) => regionHits(b) - regionHits(a) || b.toks.size - a.toks.size || a.p.speciesName.localeCompare(b.p.speciesName));
    if (subsets.length) return { ...parsed, species: subsets[0].p };

    if (scored.length) return { ...parsed, species: scored[0].e.p };
    return null;
  }

  return { resolve, byId, species };
}

/** The species plus everything it can evolve into (walks PvPoke's explicit evolution links). */
export function evolutionLine(species, byId) {
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
