# Event Page Enrichment Plan

## Context
ScrapedDuck's `events.json` only has boolean flags (`hasSpawns`, `hasFieldResearchTasks`) — not the actual lists of featured Pokemon. LeekDuck event pages have detailed spawn lists, event eggs, and event research tasks. We'll scrape these pages in our daily snapshot script, store enriched data in `extraData.generic`, and overlay it onto live data in the app. The scraper is structured for a future ScrapedDuck PR contribution.

## Architecture

```
Daily GitHub Action → fetch each event page once via JSDOM
  → extract raids + spawns + eggs + research in single pass
  → enriched extraData stored in public/history/YYYY-MM-DD.json
  → app loads newest snapshot via index.json, overlays enriched fields onto live data
  → priorityScorer uses enriched spawns/eggs/research for scoring
```

## New extraData Schema

Under `extraData.generic` (matches ScrapedDuck's `generic.js` convention):

```typescript
generic?: {
  hasSpawns?: boolean;            // existing
  hasFieldResearchTasks?: boolean; // existing
  spawns?: Array<{ name: string; canBeShiny: boolean }>;
  eventEggs?: Array<{ name: string; eggDistance: string; canBeShiny: boolean }>;
  eventResearch?: Array<{ task: string; rewards: Array<{ name: string; canBeShiny: boolean }> }>;
}
```

## Implementation Steps

### 1. Add JSDOM devDependency
`npm install --save-dev jsdom @types/jsdom`

### 2. Create `scripts/scrapers/event-page.mjs` — JSDOM scraper module

Standalone module structured for ScrapedDuck PR portability.

**Exports:**
- `scrapeEventPageHtml(html)` → `{ spawns, eventEggs, eventResearch, raidBosses }` — pure DOM extraction, testable without network
- `fetchAndScrapeEventPage(url, options?)` → fetches HTML via JSDOM, calls `scrapeEventPageHtml`

**DOM selectors:**
- **Spawns**: `#spawns` anchor → next `ul.pkmn-list-flex` → `li.pkmn-list-item .pkmn-name`
- **Eggs**: `#eggs` anchor → next `ul.pkmn-list-flex` → `.pkmn-list-img` class for distance (e.g., `egg7km`)
- **Research**: `#research` anchor → `ul.event-field-research-list` → `.task` text + `.reward-label span`
- **Raid bosses**: `#raids` anchor → tier sub-headers + `ul.pkmn-list-flex` per tier
- **Shiny**: presence of `img.shiny-icon` sibling

Helper `findNextList(header, selector)` walks up to 5 siblings to find the list container after a section header.

**Key**: raid boss extraction and generic enrichment happen in the **same page fetch** — no double-fetching.

Scrape scope: **all events with a LeekDuck link**. The page itself tells us what sections exist via anchor IDs.

### 3. Update `scripts/update-scrapedduck-history.mjs`

**Merge raid enrichment and page content into a single pass.**

Replace the separate `enrichEventsWithRaidBosses()` + new `enrichEventsWithPageContent()` with a unified `enrichEventsFromPages(events)`:
- For each event with a `link`, fetch the page HTML once
- Call `scrapeEventPageHtml(html)` to get spawns, eggs, research, AND raid bosses
- Merge all results into `event.extraData` in one shot
- Sequential fetching with 1s delay between requests (polite to LeekDuck)
- Cache HTML by URL to avoid re-fetching if multiple events share a page
- Graceful: if scraping fails for any event, that event is unchanged

Wire into `buildSnapshot()` replacing the current `enrichEventsWithRaidBosses()` call.

### 4. Update `src/types/index.ts`

Add new interfaces and extend `ScrapedDuckEvent.extraData.generic`:
```typescript
export interface EventSpawn { name: string; canBeShiny: boolean }
export interface EventEgg { name: string; eggDistance: string; canBeShiny: boolean }
export interface EventResearchTask { task: string; rewards: Array<{ name: string; canBeShiny: boolean }> }
```

### 5. Update `src/hooks/useScrapedDuck.ts` — snapshot overlay

**Load newest snapshot via `index.json`, not by guessing today's date.**

```typescript
async function loadSnapshotOverlay() {
  const base = import.meta.env.BASE_URL;  // from vite.config.ts, not hardcoded
  const indexRes = await fetch(`${base}history/index.json`);
  const index = await indexRes.json();
  const newest = index.snapshots?.[0];  // sorted descending by date
  if (!newest) return null;
  const snapshotRes = await fetch(`${base}${newest.path}`);
  // ... extract enriched extraData by eventID
}
```

Merge enriched `extraData.generic` fields (spawns, eventEggs, eventResearch) from snapshot onto matching live events by `eventID`. If any fetch fails, gracefully continue with live-only data.

### 6. Update `src/utils/priorityScorer.ts` — consume enriched data

In the active events scoring loop, check for enriched fields with **deduplication per event + source type**:

```typescript
// Dedupe: track seen (eventID, pokemonName, sourceType) to avoid overcounting
const seenEventSource = new Set<string>();
function dedupKey(eventId: string, name: string, type: string) {
  return `${eventId}:${name}:${type}`;
}
```

- `generic.spawns` → score each as `event` source (4 pts), deduped
- `generic.eventResearch` → score each reward as `research` source (2 pts), deduped
- `generic.eventEggs` → score each as `egg` source (1 pt), deduped by name + distance
- Fallback: if no enriched spawns, use existing `raidbattles.bosses` logic

Same pattern for upcoming events (1 pt each).

### 7. Test strategy

**Scraper extraction** (`tests/eventPageScraper.test.mjs`) — runs as ESM with `node --test` directly (not through tsc/dist-tests), since JSDOM is a devDependency and the scraper is `.mjs`:
- Extracts spawn names and shiny status from synthetic HTML
- Extracts egg distance from CSS class
- Extracts research tasks with reward Pokemon
- Extracts raid bosses by tier
- Returns empty arrays for missing sections
- Handles malformed HTML gracefully

**Scorer enrichment** (`tests/priorityScorer.test.ts`) — compiled via tsconfig.tests.json:
- Event spawns score correctly (4 pts each)
- Event eggs score correctly (1 pt each)
- Event research rewards score correctly (2 pts each)
- Fallback to raidbattles.bosses when no enriched spawns
- No duplicate scoring when same Pokemon appears in multiple enriched fields
- No partner = no neededBy field (baseline regression)

Update `tsconfig.tests.json` to include `src/utils/priorityScorer.ts`, `src/utils/pokemonMatcher.ts`, `src/utils/eventFilters.ts`.

Add to `package.json` scripts: `"test:scraper": "node --test tests/eventPageScraper.test.mjs"`
Update `"test"` script to run both: `"test": "tsc -p tsconfig.tests.json && node --test dist-tests/tests/**/*.test.js && node --test tests/eventPageScraper.test.mjs"`

## Files Modified
- `scripts/scrapers/event-page.mjs` — **NEW** JSDOM scraper (pure extraction + fetch wrapper)
- `scripts/update-scrapedduck-history.mjs` — replace raid-only enrichment with unified page enrichment
- `src/types/index.ts` — add EventSpawn, EventEgg, EventResearchTask types
- `src/hooks/useScrapedDuck.ts` — snapshot overlay via index.json + `import.meta.env.BASE_URL`
- `src/utils/priorityScorer.ts` — consume enriched spawns/eggs/research with dedup
- `tsconfig.tests.json` — include scorer dependencies
- `tests/eventPageScraper.test.mjs` — **NEW** scraper tests (ESM, runs directly)
- `tests/priorityScorer.test.ts` — **NEW** scorer tests (compiled via tsc)
- `package.json` — add jsdom devDependency, update test scripts

## ScrapedDuck PR Strategy
The `scripts/scrapers/event-page.mjs` module mirrors ScrapedDuck's `pages/detailed/generic.js` pattern. For the PR:
1. Adapt the extraction functions into their `generic.js` (which currently only sets boolean flags)
2. Add the spawns/eventEggs/eventResearch fields to the generic extraData
3. No schema-breaking changes — new optional fields only
4. Their `detailedscrape.js` already fetches each event page — our extraction functions slot in

## Verification
1. `node scripts/update-scrapedduck-history.mjs` — generates snapshot with enriched events
2. Inspect `public/history/YYYY-MM-DD.json` — verify Valentine's Day event has spawns + eggs
3. `npx tsc -b --noEmit` — type-check passes
4. `npm test` — all tests pass (both compiled TS and ESM scraper tests)
5. `npm run dev` — Trade Next tab shows event spawn Pokemon that weren't visible before
6. `npm run build` — production build succeeds
