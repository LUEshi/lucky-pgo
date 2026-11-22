import { useMemo, useState } from "react";
import type { KeeperPokemon, KeeperReason, KeeperReport, KeeperVerdict, Pokemon } from "../types";

interface KeepersViewProps {
  report: KeeperReport | null;
  loading: boolean;
  error: string | null;
  luckyList: Pokemon[];
}

type VerdictFilter = KeeperVerdict | "ALL";

const VERDICT_STYLE: Record<KeeperVerdict, { label: string; card: string; badge: string }> = {
  KEEP: { label: "Keep", card: "bg-green-50 border-green-200", badge: "bg-green-600 text-white" },
  KEEP_ONE: { label: "Keep one", card: "bg-amber-50 border-amber-200", badge: "bg-amber-500 text-gray-900" },
  TRASH: { label: "Trash", card: "bg-white border-gray-200", badge: "bg-gray-200 text-gray-700" },
};

const FILTERS: { key: VerdictFilter; label: string }[] = [
  { key: "KEEP", label: "Keep" },
  { key: "KEEP_ONE", label: "Keep one (Mega)" },
  { key: "TRASH", label: "Trash" },
  { key: "ALL", label: "All" },
];

// Mirrors SECTIONS in scripts/lib/keeper-rules.mjs.
const SECTIONS: { key: string; label: string }[] = [
  { key: "wild", label: "Wild" },
  { key: "dynamax", label: "Dynamax" },
  { key: "raids", label: "Raids" },
  { key: "eggs", label: "Eggs" },
  { key: "research", label: "Research" },
  { key: "rocket", label: "Team Rocket" },
];
const ALL_SECTIONS = "all";

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function reasonText(r: KeeperReason): string {
  const where = r.kind === "pvp" ? `${r.league} #${r.rank}` : `${capitalize(r.type ?? "")} attacker · ${r.tier} tier #${r.rank}`;
  return `${where} as ${r.via}${r.mega ? " (Mega)" : ""}`;
}

function bestText(p: KeeperPokemon): string {
  const pvp = p.best.pvp ? `best PvP ${p.best.pvp.league} #${p.best.pvp.rank}` : "no PvP ranking";
  const pve = p.best.pve ? `best PvE ${capitalize(p.best.pve.type)} ${p.best.pve.tier} tier` : "not a top-50 attacker";
  return `${pvp} · ${pve}`;
}

function KeeperCard({ p, needsLucky, section }: { p: KeeperPokemon; needsLucky: boolean; section: string }) {
  const from = section !== ALL_SECTIONS && p.sections?.[section] ? p.sections[section] : p.obtainedFrom;
  const style = VERDICT_STYLE[p.verdict];
  const ivs = [...new Set(p.reasons.map((r) => r.ivs))];
  return (
    <div className={`border rounded-lg p-3 text-sm ${style.card}`}>
      <div className="flex items-center gap-2 flex-wrap">
        <span className={`text-[11px] font-semibold px-1.5 py-0.5 rounded ${style.badge}`}>{style.label}</span>
        <span className="font-medium text-gray-900">{p.name}</span>
        {p.shadow && (
          <span className="bg-gray-800 text-purple-300 text-[10px] px-1.5 py-0.5 rounded-full font-medium">Shadow</span>
        )}
        {needsLucky && (
          <span className="bg-yellow-100 text-yellow-800 text-[10px] px-1.5 py-0.5 rounded-full font-medium">
            Not lucky yet — keep one to trade
          </span>
        )}
      </div>

      {p.reasons.length > 0 ? (
        <ul className="mt-1.5 space-y-0.5 text-gray-700">
          {p.reasons.map((r, i) => (
            <li key={i}>
              • {reasonText(r)}
              <span className="text-gray-500"> — {r.moveset.join(" / ")}</span>
              {r.specialMoves.length > 0 && (
                <span className="text-red-700 font-medium"> · needs {r.specialMoves.join(" + ")} (Elite TM/legacy)</span>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-1 text-gray-600">{bestText(p)}</p>
      )}

      {ivs.length > 0 && <p className="mt-1 text-xs text-gray-600">IVs: {ivs.join(" · ")}</p>}
      <p className="mt-1 text-xs text-gray-500">Get it from: {from.join(", ")}</p>
    </div>
  );
}

export function KeepersView({ report, loading, error, luckyList }: KeepersViewProps) {
  const [section, setSection] = useState<string>("wild");
  const [filter, setFilter] = useState<VerdictFilter>("KEEP");
  const [search, setSearch] = useState("");

  const luckyByDex = useMemo(() => {
    const map = new Map<number, boolean>();
    for (const p of luckyList) map.set(p.dexNumber, (map.get(p.dexNumber) ?? false) || p.isLucky);
    return map;
  }, [luckyList]);

  const sectionCounts = useMemo(() => {
    const c = new Map<string, number>();
    for (const p of report?.pokemon ?? []) for (const k of Object.keys(p.sections ?? {})) c.set(k, (c.get(k) ?? 0) + 1);
    return c;
  }, [report]);

  // Reports from before sections existed have none; show everything then.
  const hasSections = sectionCounts.size > 0;
  const inSection = useMemo(
    () => (report?.pokemon ?? []).filter((p) => !hasSections || section === ALL_SECTIONS || p.sections?.[section]),
    [report, section, hasSections],
  );

  const counts = useMemo(() => {
    const c: Record<VerdictFilter, number> = { KEEP: 0, KEEP_ONE: 0, TRASH: 0, ALL: 0 };
    for (const p of inSection) {
      c[p.verdict] += 1;
      c.ALL += 1;
    }
    return c;
  }, [inSection]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return inSection.filter(
      (p) => (filter === "ALL" || p.verdict === filter) && (!q || `${p.shadow ? "shadow " : ""}${p.name}`.toLowerCase().includes(q)),
    );
  }, [inSection, filter, search]);

  if (loading) return <p className="text-gray-500 text-sm">Loading this week's report…</p>;
  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">
        Couldn't load the keep-or-trash report: {error}
      </div>
    );
  }
  if (!report) return <p className="text-gray-500 text-sm">No report yet. The weekly job publishes one every Monday.</p>;

  return (
    <div className="space-y-3">
      <div className="text-xs text-gray-600 space-y-0.5">
        <p>
          Week of <span className="font-medium text-gray-800">{report.weekOf}</span> ·{" "}
          Pokemon you can get in the next {report.rules.lookaheadDays} days, by where you get them (LeekDuck via ScrapedDuck).
        </p>
        <p>
          Keep = top {report.rules.pvpTopRank} in Great/Ultra/Master League (PvPoke) or {report.rules.pveKeepTiers.join("/")} tier
          in any type's attacker list (Pokemon GO Hub). Everything else is trash.
        </p>
      </div>

      {report.changes && (report.changes.newKeeps.length > 0 || report.changes.droppedKeeps.length > 0) && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-900">
          <span className="font-semibold">Since {report.changes.since}:</span>{" "}
          {report.changes.newKeeps.length > 0 && <>new keeps: {report.changes.newKeeps.join(", ")}. </>}
          {report.changes.droppedKeeps.length > 0 && <>no longer keeps or not available: {report.changes.droppedKeeps.join(", ")}.</>}
        </div>
      )}

      {hasSections && (
        <div className="flex gap-1 overflow-x-auto border-b border-gray-200 pb-1.5">
          {[{ key: ALL_SECTIONS, label: "All" }, ...SECTIONS]
            .filter((s) => s.key === ALL_SECTIONS || sectionCounts.has(s.key))
            .map((s) => (
              <button
                key={s.key}
                onClick={() => setSection(s.key)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md whitespace-nowrap transition-colors ${
                  section === s.key ? "bg-yellow-400 text-gray-900" : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                {s.label} ({s.key === ALL_SECTIONS ? report.pokemon.length : sectionCounts.get(s.key)})
              </button>
            ))}
        </div>
      )}

      <div className="flex flex-wrap gap-1.5 items-center">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-3 py-1 text-xs font-medium rounded-full border transition-colors ${
              filter === f.key ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-700 border-gray-300 hover:bg-gray-100"
            }`}
          >
            {f.label} ({counts[f.key]})
          </button>
        ))}
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search…"
          className="ml-auto w-36 px-2 py-1 text-xs border border-gray-300 rounded-md bg-white text-gray-900"
        />
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {visible.map((p) => (
          <KeeperCard key={`${p.speciesId}-${p.shadow}`} p={p} section={section} needsLucky={p.verdict === "TRASH" && luckyByDex.get(p.dex) === false} />
        ))}
      </div>
      {visible.length === 0 && <p className="text-gray-500 text-sm">Nothing matches.</p>}

      <p className="text-[11px] text-gray-400">
        Verdicts are per species. Great/Ultra League want low Attack and high Defense/HP IVs; Master League and raids want high
        Attack. Data: PvPoke, Pokemon GO Hub, LeekDuck via ScrapedDuck.
      </p>
    </div>
  );
}
