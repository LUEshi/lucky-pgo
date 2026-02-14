interface ProgressBarProps {
  luckyCount: number;
  totalCount: number;
}

export function ProgressBar({ luckyCount, totalCount }: ProgressBarProps) {
  const pct = totalCount > 0 ? Math.round((luckyCount / totalCount) * 100) : 0;

  return (
    <div className="mb-6">
      <div className="flex justify-between text-sm mb-1">
        <span className="font-semibold text-gray-700">Lucky Pokedex</span>
        <span className="text-gray-500">
          {luckyCount} / {totalCount} ({pct}%)
        </span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
        <div
          className="bg-yellow-400 h-3 rounded-full transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
