import type { ScrapedDuckEvent } from "../types";

export function isActiveEvent(event: ScrapedDuckEvent, now: Date): boolean {
  const start = new Date(event.start);
  const end = new Date(event.end);
  return start <= now && end >= now;
}

export function isUpcomingEvent(
  event: ScrapedDuckEvent,
  now: Date,
  until?: Date,
): boolean {
  const start = new Date(event.start);
  return start > now && (!until || start <= until);
}

export function partitionEventsByTime(
  events: ScrapedDuckEvent[],
  now: Date,
  until?: Date,
): { active: ScrapedDuckEvent[]; upcoming: ScrapedDuckEvent[] } {
  return {
    active: events.filter((event) => isActiveEvent(event, now)),
    upcoming: events.filter((event) => isUpcomingEvent(event, now, until)),
  };
}
