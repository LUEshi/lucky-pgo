import type { PvpLeagueResult, PvpIVResult } from "../../types/pvp";

interface Props {
  result: PvpLeagueResult;
}

function formatMoveName(id: string): string {
  return id
    .split("_")
    .map((w) => w[0] + w.slice(1).toLowerCase())
    .join(" ");
}

function getRankColor(rank: number): string {
  if (rank <= 10) return "text-green-700";
  if (rank <= 100) return "text-yellow-700";
  if (rank <= 500) return "text-orange-600";
  return "text-red-600";
}

function getLeagueStyles(league: PvpLeagueResult["league"]): {
  border: string;
  title: string;
  label: string;
} {
  switch (league) {
    case "great":
      return { border: "border-l-blue-500", title: "Great League", label: "bg-blue-100 text-blue-800" };
    case "ultra":
      return { border: "border-l-amber-500", title: "Ultra League", label: "bg-amber-100 text-amber-800" };
    case "master":
      return { border: "border-l-purple-500", title: "Master League", label: "bg-purple-100 text-purple-800" };
  }
}

function IVResultBlock({ result, label }: { result: PvpIVResult; label: string }) {
  return (
    <div className="text-xs space-y-0.5">
      <div className="font-medium text-gray-500 uppercase tracking-wide text-[10px]">{label}</div>
      <div className="font-medium text-gray-800">
        {result.ivs.atk}/{result.ivs.def}/{result.ivs.sta} — Lv {result.level} — {result.cp} CP
      </div>
      <div className="text-gray-600">
        Atk {result.effectiveAtk.toFixed(1)} / Def {result.effectiveDef.toFixed(1)} / HP {result.effectiveHP.toFixed(1)}
      </div>
      <div className="text-gray-600">
        Stat product: {result.statProduct.toFixed(0)} ({result.statProductPct.toFixed(2)}%)
      </div>
    </div>
  );
}

export function LeagueCard({ result }: Props) {
  const styles = getLeagueStyles(result.league);

  return (
    <div className={`bg-white border border-gray-200 border-l-4 ${styles.border} rounded-lg p-4 shadow-sm`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-gray-900 text-sm">{styles.title}</h3>
        {result.metaRank !== null && (
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${styles.label}`}>
            Meta #{result.metaRank}
            {result.metaScore !== null && ` (${result.metaScore.toFixed(0)})`}
          </span>
        )}
        {result.metaRank === null && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">Unranked</span>
        )}
      </div>

      {result.queriedIV === null ? (
        <div className="text-sm text-gray-500 italic">No valid level found</div>
      ) : (
        <div className="space-y-3">
          {/* Rank badge */}
          <div className="flex items-baseline gap-2">
            <span className={`text-xl font-bold ${getRankColor(result.queriedIV.rank)}`}>
              #{result.queriedIV.rank}
            </span>
            <span className="text-xs text-gray-500">/ {result.queriedIV.total}</span>
          </div>

          {/* Queried IV */}
          <IVResultBlock result={result.queriedIV} label="Your IVs" />

          {/* Rank 1 (if different) */}
          {result.rank1 !== null &&
            (result.rank1.ivs.atk !== result.queriedIV.ivs.atk ||
              result.rank1.ivs.def !== result.queriedIV.ivs.def ||
              result.rank1.ivs.sta !== result.queriedIV.ivs.sta) && (
              <>
                <div className="border-t border-gray-100" />
                <IVResultBlock result={result.rank1} label="Rank 1" />
              </>
            )}

          {/* Moveset */}
          {result.moveset !== null && result.moveset.length > 0 && (
            <div className="text-xs text-gray-600">
              <span className="font-medium text-gray-700">Moveset: </span>
              {result.moveset.map(formatMoveName).join(" / ")}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
