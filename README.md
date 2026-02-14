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

## Data Sources & Credits

All Pokemon GO game data is provided by [LeekDuck.com](https://leekduck.com/) via the [ScrapedDuck](https://github.com/bigfoott/ScrapedDuck) project. Thank you to LeekDuck for making this data available.

- [LeekDuck.com](https://leekduck.com/) — original source for events, raids, research, eggs, and rocket lineup data
- [ScrapedDuck](https://github.com/bigfoott/ScrapedDuck) — JSON API that scrapes LeekDuck data
- Your Google Sheet CSV — lucky Pokedex tracking

This project is free, non-commercial, and not monetized, in accordance with ScrapedDuck's terms of use.
