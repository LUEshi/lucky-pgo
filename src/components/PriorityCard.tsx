import type { PriorityPokemon, PrioritySource } from "../types";
import type { Category } from "../hooks/useCategorizedPokemon";
import { sourceColors, cardBg, eggCardBg } from "../utils/styleConstants";

interface PriorityCardProps {
  name: string;
  sources: PrioritySource[];
  category: Category;
  neededBy?: PriorityPokemon["neededBy"];
}

export function PriorityCard({
  name,
  sources,
  category,
  neededBy,
}: PriorityCardProps) {
  const bg = category === "eggs" ? eggCardBg(sources) : cardBg(sources);
  const leftBorderClass =
    neededBy === "both"
      ? "border-l-4 border-l-amber-400"
      : neededBy === "partner"
        ? "border-l-4 border-l-blue-200"
        : "";
  const availabilityRows = Array.from(
    new Set(
      sources
        .filter((s) => s.availability)
        .map((s) => `${s.label}: ${s.availability}`),
    ),
  );

  // Group upcoming sources by event name (detail)
  const upcomingSources = sources.filter(
    (s) => s.type === "upcoming" || s.type === "upcoming-raid"
  );
  const otherSources = sources.filter(
    (s) => s.type !== "upcoming" && s.type !== "upcoming-raid"
  );

  // Map of event name to array of sources for that event
  const upcomingByEvent = new Map<string, PrioritySource[]>();
  for (const s of upcomingSources) {
    if (!upcomingByEvent.has(s.detail)) upcomingByEvent.set(s.detail, []);
    upcomingByEvent.get(s.detail)!.push(s);
  }

  return (
    <div className={`border rounded-lg px-3 py-2 ${bg} ${leftBorderClass}`}>
      <div className="flex items-center gap-2">
        <div className="font-medium text-sm text-gray-900">{name}</div>
        {neededBy === "both" && (
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800">Both need</span>
        )}
        {neededBy === "partner" && (
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700">Partner</span>
        )}
      </div>
      {/* Show a subbox per upcoming event */}
      {Array.from(upcomingByEvent.entries()).map(([eventName, eventSources]) => {
        const eventLink = eventSources[0]?.link;
        return (
          <div key={eventName} className="border rounded p-2 mt-2 bg-yellow-50 border-yellow-200">
            <div className="font-semibold text-xs text-yellow-900 mb-1">
              Upcoming: {eventLink ? (
                <a href={eventLink} target="_blank" rel="noopener noreferrer" className="underline hover:text-blue-700">{eventName}</a>
              ) : eventName}
            </div>
            <div className="text-[10px] text-gray-600 mb-1">
              {eventSources[0].availability && (
                <div>Upcoming: {eventSources[0].availability}</div>
              )}
            </div>
          </div>
        );
      })}
      {/* Show other sources as before, but exclude upcoming */}
      {otherSources.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1">
          {otherSources.map((s, i) => (
            <span
              key={i}
              className={`text-[10px] px-1.5 py-0.5 rounded-full ${sourceColors[s.type] ?? "bg-gray-100 text-gray-700"}`}
              title={s.detail}
            >
              {s.label}
            </span>
          ))}
        </div>
      )}
      {/* Show other availability rows as before, but exclude upcoming */}
      {otherSources.length > 0 && availabilityRows.length > 0 && (
        <div className="mt-1 text-[10px] text-gray-600">
          {availabilityRows.map((row) => (
            <div key={row}>{row}</div>
          ))}
        </div>
      )}
    </div>
  );
}
