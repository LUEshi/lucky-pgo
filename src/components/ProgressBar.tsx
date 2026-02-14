interface ProgressBarProps {
  luckyCount: number;
  totalCount: number;
}

export function ProgressBar({ luckyCount, totalCount }: ProgressBarProps) {
  const pct = totalCount > 0 ? Math.round((luckyCount / totalCount) * 100) : 0;

  return (
    <div className="bg-white/95 border border-yellow-200 rounded-xl px-3 py-2 shadow-sm">
      <div className="flex justify-between text-sm mb-1.5">
        <span className="font-semibold text-gray-800">Lucky Pokedex</span>
        <span className="text-gray-600">
          {luckyCount} / {totalCount} ({pct}%)
        </span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
        <div
          className="bg-gradient-to-r from-amber-400 to-yellow-500 h-2.5 rounded-full transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
