import type { ScrapedDuckEvent } from "../types";

function hasGenericEnrichment(event: ScrapedDuckEvent): boolean {
  const g = event.extraData?.generic;
  return (
    (g?.spawns?.length ?? 0) > 0 ||
    (g?.eventEggs?.length ?? 0) > 0 ||
    (g?.eventResearch?.length ?? 0) > 0
  );
}

function hasRaidBossEnrichment(event: ScrapedDuckEvent): boolean {
  return (event.extraData?.raidbattles?.bosses?.length ?? 0) > 0;
}

export function shouldIncludeOverlayEvent(event: ScrapedDuckEvent): boolean {
  return hasGenericEnrichment(event) || hasRaidBossEnrichment(event);
}

export function mergeEventEnrichment(
  events: ScrapedDuckEvent[],
  overlay: Map<string, ScrapedDuckEvent["extraData"]> | null,
): ScrapedDuckEvent[] {
  if (!overlay) return events;
  return events.map((event) => {
    const enriched = overlay.get(event.eventID);
    if (!enriched) return event;
    return {
      ...event,
      extraData: {
        ...event.extraData,
        generic: {
          ...event.extraData?.generic,
          ...enriched.generic,
        },
        ...(enriched.raidbattles && !(event.extraData?.raidbattles?.bosses?.length)
          ? { raidbattles: enriched.raidbattles }
          : {}),
      },
    };
  });
}
