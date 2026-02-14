# Lucky PGO

Pokemon GO Lucky Pokedex assistant. Helps prioritize which Pokemon to trade for lucky by cross-referencing your lucky list with current in-game events, raids, research, eggs, and Team Rocket lineups.

## Setup

```bash
npm install
npm run dev
```

## Usage

1. Export your Google Sheet lucky tracker as a TSV file (File > Download > Tab-separated values)
2. Open the app and click "Upload CSV"
3. Check the "Trade Next" tab for prioritized recommendations

## Data Sources

- [ScrapedDuck](https://github.com/bigfoott/ScrapedDuck) — events, raids, research, eggs, rocket lineups from LeekDuck
- Your Google Sheet CSV — lucky Pokedex tracking
