# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev` — start Vite dev server (http://localhost:5173)
- `npm run build` — type-check with `tsc -b` then build with Vite
- `npm run lint` — ESLint
- `npx tsc -b --noEmit` — type-check only (no emit)
- `npm test` — compile tests with tsc then run with Node's built-in test runner
- `node --test dist-tests/tests/csvParser.test.js` — run a single test file (must compile first with `npx tsc -b tsconfig.tests.json`)

## Architecture

Client-side-only React app (no backend). Fetches live Pokemon GO data from ScrapedDuck's GitHub raw JSON files and cross-references it against the user's lucky Pokedex (uploaded as a CSV from Google Sheets) to recommend which Pokemon to prioritize trading.

### Data Flow

1. **User uploads CSV** → `csvParser.ts` parses the complex Google Sheet format (large header section, multiple Pokemon per row in 4-column groups across 9+ generations) → stored in localStorage via `useLuckyList` hook
2. **App fetches 5 ScrapedDuck endpoints** on mount via `useScrapedDuck` hook: events, raids, research, eggs, rocketLineups
3. **Priority scorer** (`priorityScorer.ts`) cross-references non-lucky Pokemon against all live data sources, assigns scores, and categorizes into Raids / Wild / Team Rocket / Eggs
4. **Pokedex canonicalization** — dex numbers are resolved to canonical names via PokéAPI v2, cached in localStorage (`lucky-pgo-pokedex-names-v1`)
5. **PriorityList component** renders a 2x2 category grid with color-coded cards

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

### Share Links & URL State

The app uses query parameters for deep linking and sharing lucky dex state:
- `tab` — current tab (`priority`|`raids`|`events`|`pokedex`)
- `search` / `filter` — Pokedex search query and filter (`all`|`missing`|`lucky`)
- `dex` — base64url-encoded bitset of lucky dex numbers (up to MAX_DEX_NUMBER=1025)
- `dex-hash` — FNV-1a 32-bit checksum for corruption detection

Share link encoding/decoding lives in `luckyShare.ts`. Trade rules (special trade, mythical untradable) are in `tradeRules.ts`.

### History Snapshots

Daily ScrapedDuck data snapshots are stored in `public/history/` by the `snapshot-history.yml` GitHub Actions workflow (7-day rolling window). Used for future diff features.

### Credits

This project uses data from [LeekDuck.com](https://leekduck.com/) via [ScrapedDuck](https://github.com/bigfoott/ScrapedDuck). Per their terms: no paywalls, no ads, and always credit LeekDuck.com.
