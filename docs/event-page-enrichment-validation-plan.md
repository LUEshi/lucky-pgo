# Event Page Enrichment Validation Plan

## Why these tests exist
- Prevent silent scoring regressions when switching from boolean event flags to scraped enriched content.
- Prove scraper behavior is deterministic on real-world-ish HTML structure changes.
- Ensure graceful fallback behavior when enrichment is missing or partially present.
- Keep the path clear for a future ScrapedDuck PR by validating pure extraction logic independently.

## What must be validated

### 1) Scraper extraction (`tests/eventPageScraper.test.mjs`)
Required test cases:
- Extracts `spawns` names and `canBeShiny` from a synthetic `#spawns` section.
- Extracts `eventEggs` with `eggDistance` parsed from class names like `egg2km` / `egg7km`.
- Extracts `eventResearch` tasks and reward Pokemon with shiny flags.
- Extracts raid bosses by tier from a synthetic `#raids` section.
- Returns empty arrays when section anchors (`#spawns`, `#eggs`, `#research`, `#raids`) are absent.
- Handles malformed or partial HTML without throwing.

Quality checks for scraper tests:
- Uses only local/synthetic HTML fixtures (no network).
- Asserts exact payload shape, not just array length.
- Includes at least one dedupe/normalization assertion if parser performs dedupe.

### 2) Priority scoring enrichment (`tests/priorityScorer.test.ts`)
Required test cases:
- Active event `generic.spawns` contributes event points (4 per match).
- Active event `generic.eventResearch` rewards contribute research points (2 per match).
- Active event `generic.eventEggs` contributes egg points (1 per match).
- Fallback to `extraData.raidbattles.bosses` still works when enriched `spawns` are absent.
- Dedup prevents double-counting within the same `(eventID, pokemon, sourceType)`.
- Upcoming events use upcoming scoring path and do not inflate active scores.
- Regression: no partner context keeps `neededBy` undefined.

Quality checks for scorer tests:
- Uses minimal fixtures with explicit start/end timestamps for active/upcoming windows.
- Asserts both `score` and source metadata (`type`, `detail`/`label`) where relevant.
- Includes at least one negative assertion (Pokemon not present in results).

### 3) Snapshot overlay behavior (`useScrapedDuck`)
Minimum validation (unit-like or light integration):
- If snapshot index fetch fails, hook still returns live data.
- If snapshot exists, enriched `extraData.generic` overlays matching `eventID`.
- Overlay does not clobber unrelated live fields.

## Acceptance criteria (Definition of Done)
- `npx tsc -b --noEmit` passes.
- `npm test` passes and includes both TS tests and scraper ESM tests.
- `npm run build` passes.
- New tests fail against a deliberately broken enrichment branch (at least one demonstrated failure mode).

## How I will validate the other agent's tests
1. Requirement traceability: every required case above maps to at least one concrete test.
2. Failure sensitivity: verify tests fail if key logic is removed (spot-check by temporary local mutation).
3. Determinism: no time/network flakiness; fixtures are explicit and static.
4. Coverage depth: checks output shape and semantics, not only presence.
5. Regression safety: baseline non-partner scoring behavior remains covered.

## Fast review checklist
- [ ] Scraper tests cover all four sections (spawns, eggs, research, raids).
- [ ] Scraper tests include malformed/missing-section behavior.
- [ ] Scorer tests cover active + upcoming + fallback + dedupe.
- [ ] Scorer tests include non-partner regression.
- [ ] Test scripts run both compiled TS tests and ESM scraper tests.
- [ ] Type-check and build commands pass.
