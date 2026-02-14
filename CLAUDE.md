# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev` — start Vite dev server (http://localhost:5173)
- `npm run build` — type-check with `tsc -b` then build with Vite
- `npm run lint` — ESLint
- `npx tsc -b --noEmit` — type-check only (no emit)

No test framework is configured yet.

## Architecture

Client-side-only React app (no backend). Fetches live Pokemon GO data from ScrapedDuck's GitHub raw JSON files and cross-references it against the user's lucky Pokedex (uploaded as a CSV from Google Sheets) to recommend which Pokemon to prioritize trading.

### Data Flow

1. **User uploads CSV** → `csvParser.ts` parses the complex Google Sheet format (large header section, multiple Pokemon per row in 4-column groups across 9+ generations) → stored in localStorage via `useLuckyList` hook
2. **App fetches 5 ScrapedDuck endpoints** on mount via `useScrapedDuck` hook: events, raids, research, eggs, rocketLineups
3. **Priority scorer** (`priorityScorer.ts`) cross-references non-lucky Pokemon against all live data sources, assigns scores, and categorizes into Raids / Wild / Team Rocket / Eggs
4. **PriorityList component** renders a 2x2 category grid with color-coded cards

### Key Design Decisions

- **CSV parser uses `isPokemonName()` heuristic** to distinguish real Pokemon data from header junk (stats rows, generation labels, column headers). The Google Sheet has numbers like `151` in header rows that could be mistaken for dex numbers.
- **Pokemon without TRUE/FALSE in the CSV are skipped** — these are untradable/unreleased (e.g., Victini).
- **Shadow raids score lower (2 pts)** than regular raids because they require purification + a special trade.
- **Upcoming raid events** (type `upcoming-raid`) are categorized under Raids, not Wild — so legendaries like Solgaleo appear in the right column.
- **Rocket lineups** only count encounter-eligible Pokemon (`isEncounter: true`).
- **Egg cards are colored by distance**: 2km=green, 5km=yellow, 7km=pink, 10km=purple, 12km=red.

### ScrapedDuck Data (all from `raw.githubusercontent.com/bigfoott/ScrapedDuck/data/`)

- `events.min.json` — current/upcoming events with featured Pokemon
- `raids.min.json` — raid bosses by tier (1-star, 3-star, 5-star, Mega, Shadow)
- `research.min.json` — field research tasks with Pokemon rewards
- `eggs.min.json` — hatchable Pokemon with distance, rarity
- `rocketLineups.min.json` — grunt/leader/Giovanni lineups with encounter flags

Data is updated every 12 hours. GitHub caches raw files for 5 minutes. Rate limit: 5000 requests/hour.

### Credits

This project uses data from [LeekDuck.com](https://leekduck.com/) via [ScrapedDuck](https://github.com/bigfoott/ScrapedDuck). Per their terms: no paywalls, no ads, and always credit LeekDuck.com.
