import type { Pokemon, ScrapedDuckEvent } from "../types";
import { partitionEventsByTime } from "../utils/eventFilters";
import { baseName, normalizeName, pokemonMatches } from "../utils/pokemonMatcher";

interface EventsFeedProps {
  events: ScrapedDuckEvent[];
  luckyList?: Pokemon[];
}

function dedupeNames(names: string[]): string[] {
  const deduped = new Map<string, string>();
  for (const name of names) {
    const key = normalizeName(baseName(name));
    if (!deduped.has(key)) deduped.set(key, baseName(name));
  }
  return Array.from(deduped.values());
}

function getNeededLuckyForEvent(event: ScrapedDuckEvent, luckyList?: Pokemon[]): string[] {
  if (!luckyList) return [];
  const missing = luckyList.filter((pokemon) => !pokemon.isLucky);
  if (missing.length === 0) return [];

  const featured = event.extraData?.raidbattles?.bosses ?? [];
  const needed = featured
    .map((boss) => {
      const base = baseName(boss.name);
      return missing.find((pokemon) => pokemonMatches(pokemon.name, base));
    })
    .filter((pokemon): pokemon is Pokemon => Boolean(pokemon))
    .map((pokemon) => pokemon.name);

  return dedupeNames(needed);
}

function getShinyFeaturedForEvent(event: ScrapedDuckEvent): string[] {
  const shinies = event.extraData?.raidbattles?.shinies?.map((s) => s.name) ?? [];
  return dedupeNames(shinies);
}

export function EventsFeed({ events, luckyList }: EventsFeedProps) {
  const now = new Date();
  const { active, upcoming } = partitionEventsByTime(events, now);
  const upcomingSorted = upcoming
    .sort(
      (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime(),
    )
    .slice(0, 10);

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }

  function EventCard({ event }: { event: ScrapedDuckEvent }) {
    const neededLucky = getNeededLuckyForEvent(event, luckyList);
    const shinyFeatured = getShinyFeaturedForEvent(event);

    return (
      <a
        href={event.link}
        target="_blank"
        rel="noopener noreferrer"
        className="block border border-gray-200 rounded-lg p-3 bg-white hover:border-blue-300 transition-colors"
      >
        <div className="flex gap-3 items-start">
          {event.image && (
            <img
              src={event.image}
              alt=""
              className="w-16 h-16 rounded object-cover shrink-0"
            />
          )}
          <div className="min-w-0">
            <div className="font-semibold text-gray-900 text-sm truncate">
              {event.name}
            </div>
            <div className="text-xs text-gray-500 mt-0.5">
              {event.heading}
            </div>
            <div className="text-xs text-gray-400 mt-1">
              {formatDate(event.start)} — {formatDate(event.end)}
            </div>
            {neededLucky.length > 0 && (
              <div className="text-xs text-red-700 mt-1 line-clamp-2">
                Need lucky (featured): {neededLucky.join(", ")}
              </div>
            )}
            {shinyFeatured.length > 0 && (
              <div className="text-xs text-purple-700 mt-1 line-clamp-2">
                Shiny available: {shinyFeatured.join(", ")}
              </div>
            )}
          </div>
        </div>
      </a>
    );
  }

  return (
    <div className="space-y-6">
      {active.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-green-700 mb-2">
            Happening Now ({active.length})
          </h3>
          <div className="space-y-2">
            {active.map((e) => (
              <EventCard key={e.eventID} event={e} />
            ))}
          </div>
        </div>
      )}
      {upcoming.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-blue-700 mb-2">
            Upcoming
          </h3>
          <div className="space-y-2">
            {upcomingSorted.map((e) => (
              <EventCard key={e.eventID} event={e} />
            ))}
          </div>
        </div>
      )}
      {active.length === 0 && upcomingSorted.length === 0 && (
        <p className="text-gray-500 text-sm">No events found.</p>
      )}
    </div>
  );
}
