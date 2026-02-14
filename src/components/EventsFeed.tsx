import type { ScrapedDuckEvent } from "../types";

interface EventsFeedProps {
  events: ScrapedDuckEvent[];
}

export function EventsFeed({ events }: EventsFeedProps) {
  const now = new Date();

  const active = events.filter((e) => {
    const start = new Date(e.start);
    const end = new Date(e.end);
    return start <= now && end >= now;
  });

  const upcoming = events
    .filter((e) => new Date(e.start) > now)
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
              {event.eventType}
            </div>
            <div className="text-xs text-gray-400 mt-1">
              {formatDate(event.start)} — {formatDate(event.end)}
            </div>
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
            {upcoming.map((e) => (
              <EventCard key={e.eventID} event={e} />
            ))}
          </div>
        </div>
      )}
      {active.length === 0 && upcoming.length === 0 && (
        <p className="text-gray-500 text-sm">No events found.</p>
      )}
    </div>
  );
}
