import { useState, useMemo, useCallback } from "react";
import { useLuckyList } from "./hooks/useLuckyList";
import { useScrapedDuck } from "./hooks/useScrapedDuck";
import { scorePokemon } from "./utils/priorityScorer";
import { CsvUpload } from "./components/CsvUpload";
import { ProgressBar } from "./components/ProgressBar";
import { PriorityList } from "./components/PriorityList";
import { RaidBosses } from "./components/RaidBosses";
import { EventsFeed } from "./components/EventsFeed";
import { PokedexView, type Filter as PokedexFilter } from "./components/PokedexView";
import { encodeLuckyDexBitset, MAX_DEX_NUMBER } from "./utils/luckyShare";

type Tab = "priority" | "raids" | "events" | "pokedex";

const TAB_QUERY_KEY = "tab";
const POKEDEX_SEARCH_QUERY_KEY = "q";
const POKEDEX_FILTER_QUERY_KEY = "pf";
const DEX_QUERY_KEY = "dex";

function isTab(value: string | null): value is Tab {
  return value === "priority" || value === "raids" || value === "events" || value === "pokedex";
}

function isPokedexFilter(value: string | null): value is PokedexFilter {
  return value === "all" || value === "missing" || value === "lucky";
}

function getInitialTab(): Tab {
  const params = new URLSearchParams(window.location.search);
  const tabFromUrl = params.get(TAB_QUERY_KEY);
  if (isTab(tabFromUrl)) return tabFromUrl;
  return "priority";
}

function getInitialPokedexSearch(): string {
  const params = new URLSearchParams(window.location.search);
  return params.get(POKEDEX_SEARCH_QUERY_KEY) ?? "";
}

function getInitialPokedexFilter(): PokedexFilter {
  const params = new URLSearchParams(window.location.search);
  const fromUrl = params.get(POKEDEX_FILTER_QUERY_KEY);
  return isPokedexFilter(fromUrl) ? fromUrl : "all";
}

function App() {
  const {
    luckyList,
    importPokemon,
    toggleLucky,
    clearList,
    luckyCount,
    totalCount,
    linkImportError,
    linkImportMessage,
    pendingDexImport,
    importingFromLink,
    applyPendingDexImport,
    dismissPendingDexImport,
  } = useLuckyList();
  const { data, loading, error } = useScrapedDuck();
  const [tab, setTab] = useState<Tab>(getInitialTab);
  const [pokedexSearch, setPokedexSearch] = useState<string>(
    getInitialPokedexSearch,
  );
  const [pokedexFilter, setPokedexFilter] = useState<PokedexFilter>(
    getInitialPokedexFilter,
  );
  const [shareStatus, setShareStatus] = useState<string | null>(null);

  const setUrlQueryParam = useCallback((key: string, value: string) => {
    const url = new URL(window.location.href);
    if (value) {
      url.searchParams.set(key, value);
    } else {
      url.searchParams.delete(key);
    }
    window.history.replaceState(null, "", url.toString());
  }, []);

  function setTabAndSyncUrl(nextTab: Tab) {
    setTab(nextTab);
    setUrlQueryParam(TAB_QUERY_KEY, nextTab);
  }

  function setPokedexSearchAndSyncUrl(nextSearch: string) {
    setPokedexSearch(nextSearch);
    setUrlQueryParam(POKEDEX_SEARCH_QUERY_KEY, nextSearch);
  }

  function setPokedexFilterAndSyncUrl(nextFilter: PokedexFilter) {
    setPokedexFilter(nextFilter);
    setUrlQueryParam(POKEDEX_FILTER_QUERY_KEY, nextFilter);
  }

  async function copyShareLink() {
    if (!luckyList) return;

    const url = new URL(window.location.href);
    url.searchParams.set(TAB_QUERY_KEY, tab);
    if (pokedexSearch) {
      url.searchParams.set(POKEDEX_SEARCH_QUERY_KEY, pokedexSearch);
    } else {
      url.searchParams.delete(POKEDEX_SEARCH_QUERY_KEY);
    }
    url.searchParams.set(POKEDEX_FILTER_QUERY_KEY, pokedexFilter);
    url.searchParams.set(
      DEX_QUERY_KEY,
      encodeLuckyDexBitset(luckyList.pokemon, MAX_DEX_NUMBER),
    );

    try {
      await navigator.clipboard.writeText(url.toString());
      setShareStatus("Share link copied to clipboard.");
    } catch {
      setShareStatus("Could not access clipboard. Copy the URL from your browser bar.");
    }
  }

  const exportBackupCsv = useCallback(() => {
    if (!luckyList) return;

    const escapeCsv = (value: string) => {
      if (/[",\n]/.test(value)) {
        return `"${value.replace(/"/g, "\"\"")}"`;
      }
      return value;
    };

    const rows = ["No,Name,Lucky"];
    const sorted = [...luckyList.pokemon].sort((a, b) => a.dexNumber - b.dexNumber);
    for (const pokemon of sorted) {
      rows.push(
        `${pokemon.dexNumber},${escapeCsv(pokemon.name)},${pokemon.isLucky ? "TRUE" : "FALSE"}`,
      );
    }

    const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const date = new Date().toISOString().slice(0, 10);
    a.download = `lucky-pgo-backup-${date}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setShareStatus("Backup CSV downloaded.");
  }, [luckyList]);

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
          <div className="flex items-center justify-between gap-2">
            <h1 className="text-xl font-bold text-gray-900">Lucky PGO</h1>
            <div className="flex items-center gap-2">
              {luckyList && (
                <>
                  <button
                    onClick={exportBackupCsv}
                    className="bg-white text-gray-900 px-3 py-2 rounded-lg text-sm font-medium border border-gray-300 hover:bg-gray-100 transition-colors"
                  >
                    Export Backup CSV
                  </button>
                  <button
                    onClick={copyShareLink}
                    className="bg-gray-900 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-gray-700 transition-colors"
                  >
                    Share Link
                  </button>
                </>
              )}
              <CsvUpload
                onImport={importPokemon}
                hasExistingData={!!luckyList}
                onClear={clearList}
              />
            </div>
          </div>
          {shareStatus && (
            <div className="mt-2 text-xs text-gray-700 bg-white/80 rounded px-3 py-2">
              {shareStatus}
            </div>
          )}
          {linkImportMessage && (
            <div className="mt-2 text-xs text-green-700 bg-green-50 rounded px-3 py-2">
              {linkImportMessage}
            </div>
          )}
          {linkImportError && (
            <div className="mt-2 text-xs text-red-700 bg-red-50 rounded px-3 py-2">
              {linkImportError}
            </div>
          )}
          {pendingDexImport && (
            <div className="mt-2 text-xs text-gray-800 bg-white/90 border border-yellow-300 rounded px-3 py-2">
              <div>
                Shared link detected with <strong>{pendingDexImport.luckyCount}</strong> lucky entries.
                Importing will replace your local list.
              </div>
              <div className="mt-2 flex gap-2">
                <button
                  onClick={applyPendingDexImport}
                  disabled={importingFromLink}
                  className="px-2.5 py-1 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
                >
                  {importingFromLink ? "Importing..." : "Import Shared Dex"}
                </button>
                <button
                  onClick={dismissPendingDexImport}
                  disabled={importingFromLink}
                  className="px-2.5 py-1 rounded bg-gray-200 text-gray-800 hover:bg-gray-300 disabled:opacity-60"
                >
                  Keep My Dex
                </button>
              </div>
            </div>
          )}
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
              Export your Google Sheet as a CSV file and upload it to get
              started.
            </p>
            <p className="text-xs mt-4 text-gray-400">
              Expected format: dex number, name, (blank), TRUE/FALSE — comma
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
                  onClick={() => setTabAndSyncUrl(t.key)}
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
                  <EventsFeed
                    events={data?.events ?? []}
                    luckyList={luckyList.pokemon}
                  />
                )}
                {tab === "pokedex" && (
                  <PokedexView
                    pokemon={luckyList.pokemon}
                    onToggleLucky={toggleLucky}
                    search={pokedexSearch}
                    filter={pokedexFilter}
                    onSearchChange={setPokedexSearchAndSyncUrl}
                    onFilterChange={setPokedexFilterAndSyncUrl}
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
