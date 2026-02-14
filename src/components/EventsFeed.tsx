import type { Pokemon, ScrapedDuckEvent } from "../types";
import { partitionEventsByTime } from "../utils/eventFilters";
import { baseName, normalizeName, pokemonMatches } from "../utils/pokemonMatcher";

interface EventsFeedProps {
  events: ScrapedDuckEvent[];
  luckyList?: Pokemon[];
}

function toTitleCase(value: string): string {
  return value
    .split(" ")
    .filter(Boolean)
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(" ");
}

function dedupeNames(names: string[]): string[] {
  const deduped = new Map<string, string>();
  for (const name of names) {
    const key = normalizeName(baseName(name));
    if (!deduped.has(key)) deduped.set(key, baseName(name));
  }
  return Array.from(deduped.values());
}

function splitCompositeNames(value: string): string[] {
  return value
    .split(/\s*(?:,|&| and )\s*/i)
    .map((part) => part.trim())
    .filter(Boolean);
}

function inferFeaturedFromName(name: string): string[] {
  const direct = name.match(/^(.+?)\s+(?:Raid Day|Max Battle Day|Elite Raid Day)$/i);
  if (direct) return splitCompositeNames(direct[1]);

  const inRaids = name.match(/^(.+?)\s+in\s+.+\s+Raid Battles$/i);
  if (inRaids) return splitCompositeNames(inRaids[1]);

  return [];
}

function inferFeaturedFromEventId(eventID: string): string[] {
  const slug = eventID.match(/^(.+?)-(?:raid-day|max-battle-day)(?:-\d{4})?$/i);
  if (!slug) return [];
  return [toTitleCase(slug[1].replace(/-/g, " "))];
}

function getFeaturedNamesForEvent(event: ScrapedDuckEvent): string[] {
  const explicit =
    event.extraData?.raidbattles?.bosses?.map((boss) => boss.name) ?? [];
  if (explicit.length > 0) return dedupeNames(explicit);

  return dedupeNames([
    ...inferFeaturedFromName(event.name),
    ...inferFeaturedFromEventId(event.eventID),
  ]);
}

function getNeededLuckyForEvent(event: ScrapedDuckEvent, luckyList?: Pokemon[]): string[] {
  if (!luckyList) return [];
  const missing = luckyList.filter((pokemon) => !pokemon.isLucky);
  if (missing.length === 0) return [];

  const featured = getFeaturedNamesForEvent(event);
  const needed = featured
    .map((name) => {
      const base = baseName(name);
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
