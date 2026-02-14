import type { RaidBoss, Pokemon } from "../types";
import { findLuckyStatus } from "../utils/pokemonMatcher";
import { raidCardStyle } from "../utils/styleConstants";

interface RaidBossesProps {
  raids: RaidBoss[];
  luckyList: Pokemon[] | undefined;
}

export function RaidBosses({ raids, luckyList }: RaidBossesProps) {
  if (raids.length === 0) {
    return <p className="text-gray-500 text-sm">No raid data available.</p>;
  }

  // Group by tier
  const tiers = new Map<string, RaidBoss[]>();
  for (const raid of raids) {
    const group = tiers.get(raid.tier) ?? [];
    group.push(raid);
    tiers.set(raid.tier, group);
  }

  return (
    <div className="space-y-4">
      {Array.from(tiers.entries()).map(([tier, bosses]) => (
        <div key={tier}>
          <h3 className="text-sm font-semibold text-gray-600 mb-2">{tier}</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {bosses.map((boss) => {
              const lucky = findLuckyStatus(boss.name, luckyList);
              const isShadow = tier.toLowerCase().includes("shadow");
              return (
                <div
                  key={boss.name}
                  className={`border rounded-lg p-3 text-center text-sm relative ${raidCardStyle(lucky, isShadow)}`}
                >
                  {isShadow && (
                    <span className="absolute top-1 right-1 bg-gray-800 text-purple-300 text-[10px] px-1.5 py-0.5 rounded-full font-medium">
                      Shadow
                    </span>
                  )}
                  {boss.image && (
                    <img
                      src={boss.image}
                      alt={boss.name}
                      className="w-12 h-12 mx-auto mb-1 object-contain"
                    />
                  )}
                  <div className="font-medium">{boss.name}</div>
                  {lucky === true && (
                    <span className="text-xs text-yellow-600">Lucky!</span>
                  )}
                  {lucky === false && (
                    <span className="text-xs text-red-500 font-semibold">
                      NEED
                    </span>
                  )}
                  {lucky === false && isShadow && (
                    <div className="text-[10px] text-gray-400 mt-0.5">
                      Purify + Special Trade
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
