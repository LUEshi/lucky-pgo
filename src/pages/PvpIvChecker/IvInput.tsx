interface Props {
  ivs: { atk: number; def: number; sta: number };
  onChange: (ivs: { atk: number; def: number; sta: number }) => void;
  ivFloor: number;
  onIvFloorChange: (floor: number) => void;
  maxLevel: number;
  onMaxLevelChange: (level: number) => void;
}

const IV_FLOOR_OPTIONS = [
  { value: 0, label: "Wild (0)" },
  { value: 4, label: "Weather (4)" },
  { value: 10, label: "Raid/Egg (10)" },
  { value: 12, label: "Lucky (12)" },
];

const MAX_LEVEL_OPTIONS = [
  { value: 50, label: "50" },
  { value: 51, label: "51 (Best Buddy)" },
];

export function IvInput({ ivs, onChange, ivFloor, onIvFloorChange, maxLevel, onMaxLevelChange }: Props) {
  const ivOptions = Array.from({ length: 16 }, (_, i) => i);

  function handleIvChange(stat: "atk" | "def" | "sta", value: number) {
    onChange({ ...ivs, [stat]: value });
  }

  return (
    <div className="space-y-3">
      {/* Row 1: IV dropdowns */}
      <div className="flex gap-3">
        {(["atk", "def", "sta"] as const).map((stat) => (
          <div key={stat} className="flex-1">
            <label className="block text-xs font-medium text-gray-600 mb-1 capitalize">
              {stat === "sta" ? "Sta" : stat.charAt(0).toUpperCase() + stat.slice(1)}
            </label>
            <select
              value={ivs[stat]}
              onChange={(e) => handleIvChange(stat, parseInt(e.target.value, 10))}
              className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              {ivOptions.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>

      {/* Row 2: IV Floor + Max Level */}
      <div className="flex gap-3">
        <div className="flex-1">
          <label className="block text-xs font-medium text-gray-600 mb-1">IV Floor</label>
          <select
            value={ivFloor}
            onChange={(e) => onIvFloorChange(parseInt(e.target.value, 10))}
            className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            {IV_FLOOR_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex-1">
          <label className="block text-xs font-medium text-gray-600 mb-1">Max Level</label>
          <select
            value={maxLevel}
            onChange={(e) => onMaxLevelChange(parseInt(e.target.value, 10))}
            className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            {MAX_LEVEL_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
