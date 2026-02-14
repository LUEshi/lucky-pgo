import { useState, useMemo } from "react";
import { useLuckyList } from "./hooks/useLuckyList";
import { useScrapedDuck } from "./hooks/useScrapedDuck";
import { scorePokemon } from "./utils/priorityScorer";
import { CsvUpload } from "./components/CsvUpload";
import { ProgressBar } from "./components/ProgressBar";
import { PriorityList } from "./components/PriorityList";
import { RaidBosses } from "./components/RaidBosses";
import { EventsFeed } from "./components/EventsFeed";
import { PokedexView } from "./components/PokedexView";

type Tab = "priority" | "raids" | "events" | "pokedex";

function App() {
  const {
    luckyList,
    importPokemon,
    toggleLucky,
    clearList,
    luckyCount,
    totalCount,
  } = useLuckyList();
  const { data, loading, error } = useScrapedDuck();
  const [tab, setTab] = useState<Tab>("priority");

  const priorities = useMemo(() => {
    if (!luckyList || !data) return [];
    return scorePokemon(luckyList.pokemon, data);
  }, [luckyList, data]);

  const tabs: { key: Tab; label: string }[] = [
    { key: "priority", label: "Trade Next" },
    { key: "raids", label: "Raids" },
    { key: "events", label: "Events" },
    { key: "pokedex", label: "Pokedex" },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-yellow-400 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold text-gray-900">Lucky PGO</h1>
            <CsvUpload
              onImport={importPokemon}
              hasExistingData={!!luckyList}
              onClear={clearList}
            />
          </div>
          {luckyList && (
            <div className="mt-3">
              <ProgressBar luckyCount={luckyCount} totalCount={totalCount} />
            </div>
          )}
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-4">
        {!luckyList && (
          <div className="text-center py-16 text-gray-500">
            <p className="text-lg font-medium mb-2">Welcome to Lucky PGO!</p>
            <p className="text-sm">
              Export your Google Sheet as a TSV/CSV file and upload it to get
              started.
            </p>
            <p className="text-xs mt-4 text-gray-400">
              Expected format: dex number, name, (blank), TRUE/FALSE — tab
              separated
            </p>
          </div>
        )}

        {luckyList && (
          <>
            <div className="flex gap-1 mb-4 border-b border-gray-200 pb-2 overflow-x-auto">
              {tabs.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={`px-4 py-2 text-sm font-medium rounded-lg whitespace-nowrap transition-colors ${
                    tab === t.key
                      ? "bg-yellow-400 text-gray-900"
                      : "text-gray-500 hover:text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  {t.label}
                  {t.key === "priority" && priorities.length > 0 && (
                    <span className="ml-1.5 bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                      {priorities.length}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {loading && (
              <div className="text-center py-8 text-gray-500">
                Loading event data...
              </div>
            )}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm mb-4">
                Failed to load event data: {error}
              </div>
            )}

            {!loading && (
              <>
                {tab === "priority" && <PriorityList priorities={priorities} />}
                {tab === "raids" && (
                  <RaidBosses
                    raids={data?.raids ?? []}
                    luckyList={luckyList.pokemon}
                  />
                )}
                {tab === "events" && (
                  <EventsFeed events={data?.events ?? []} />
                )}
                {tab === "pokedex" && (
                  <PokedexView
                    pokemon={luckyList.pokemon}
                    onToggleLucky={toggleLucky}
                  />
                )}
              </>
            )}
          </>
        )}
      </main>
    </div>
  );
}

export default App;
