// Collect every Pokemon obtainable now or within the look-ahead window from a history snapshot.
// Returns raw names with a "shadow" flag and human-readable "how to get it" labels.
import { isPokemonLike } from "./species-resolver.mjs";
import { RULES } from "./keeper-rules.mjs";

export const LOOKAHEAD_DAYS = 7;

function inWindow(ev, now, lookaheadDays) {
  const start = ev.start ? new Date(ev.start) : null;
  const end = ev.end ? new Date(ev.end) : null;
  const horizon = new Date(now.getTime() + lookaheadDays * 86_400_000);
  if (end && end < now) return false;
  if (start && start > horizon) return false;
  return true;
}

export function collectWeeklyPokemon(snapshot, { now = new Date(), lookaheadDays = LOOKAHEAD_DAYS, sources = RULES.sources } = {}) {
  const want = new Set(sources);
  const found = []; // { name, shadow, source }
  const add = (category, name, source, shadow = false) => {
    if (!want.has(category) || !name || !isPokemonLike(name)) return;
    found.push({ name: name.trim(), source, shadow: shadow || /\bshadow\b/i.test(name) });
  };
  const data = snapshot?.data ?? {};

  for (const raid of data.raids ?? []) add("raids", raid.name, `Raid: ${raid.tier}`, /shadow/i.test(raid.tier ?? ""));
  for (const egg of data.eggs ?? []) add("eggs", egg.name, `Egg: ${egg.eggType}`);
  for (const task of data.research ?? []) for (const r of task.rewards ?? []) add("research", r.name, "Field Research");
  for (const grunt of data.rockets ?? []) {
    for (const slot of ["firstPokemon", "secondPokemon", "thirdPokemon"]) {
      for (const p of grunt[slot] ?? []) if (p.isEncounter) add("rocket", p.name, `Team Rocket: ${grunt.name}`, true);
    }
  }

  for (const ev of data.events ?? []) {
    if (!inWindow(ev, now, lookaheadDays)) continue;
    const x = ev.extraData ?? {};
    const upcoming = ev.start && new Date(ev.start) > now;
    const label = (kind) => `${kind}: ${ev.name}${upcoming ? ` (starts ${ev.start.slice(0, 10)})` : ""}`;
    // Spotlight/CD events list the same Pokemon in several sections; one label per event keeps them merged.
    const wildKind = ev.eventType === "pokemon-spotlight-hour" ? "Spotlight Hour" : ev.eventType === "community-day" ? "Community Day" : "Wild";
    for (const s of x.generic?.spawns ?? []) add("wild", s.name, label(wildKind));
    for (const s of x.communityday?.spawns ?? []) add("wild", s.name, label("Community Day"));
    for (const s of x.spotlight?.list ?? []) add("wild", s.name, label("Spotlight Hour"));
    for (const e of x.generic?.eventEggs ?? []) add("eggs", e.name, label(`Event egg ${e.eggDistance ?? ""}`.trim()));
    for (const t of x.generic?.eventResearch ?? []) for (const r of t.rewards ?? []) add("research", r.name, label("Event research"));
    const bossKind = ev.eventType?.startsWith("max-") ? "Max Battle" : "Raid";
    for (const b of x.raidbattles?.bosses ?? []) add("raids", b.name, label(bossKind), /shadow/i.test(ev.name ?? ""));
  }
  return found;
}
