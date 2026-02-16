import { useState, useMemo, useCallback, useEffect } from "react";
import { useLuckyList, type PendingDexPayload } from "./hooks/useLuckyList";
import { useScrapedDuck } from "./hooks/useScrapedDuck";
import { scorePokemon } from "./utils/priorityScorer";
import { CsvUpload } from "./components/CsvUpload";
import { ProgressBar } from "./components/ProgressBar";
import { PriorityList } from "./components/PriorityList";
import { RaidBosses } from "./components/RaidBosses";
import { EventsFeed } from "./components/EventsFeed";
import { PokedexView, type Filter as PokedexFilter } from "./components/PokedexView";
import {
  encodeLuckyDexBitset,
  MAX_DEX_NUMBER,
  collectLuckyDexNumbers,
  decodeLuckyDexBitset,
  checksumDexPayload,
} from "./utils/luckyShare";
import { usePartnerDex } from "./hooks/usePartnerDex";
import { isLegendaryDex, isMythicalDex } from "./utils/legendaryDex";

type Tab = "priority" | "raids" | "events" | "pokedex";

const TAB_QUERY_KEY = "tab";
const POKEDEX_SEARCH_QUERY_KEY = "search";
const POKEDEX_FILTER_QUERY_KEY = "filter";
const DEX_QUERY_KEY = "dex";
const DEX_HASH_QUERY_KEY = "dex-hash";
const PARTNER_CONFIRM_DIFF_THRESHOLD = 0.05;
const OWN_IMPORT_CONFIRM_DIFF_THRESHOLD = 0.2;

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

function formatPartnerUpdatedAt(value: string | null): string {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function toPokemonFromDex(dex: Set<number>) {
  return Array.from(dex).map((dexNumber) => ({
    dexNumber,
    name: `Pokemon ${dexNumber}`,
    isLucky: true,
  }));
}

function formatForClipboard(pokemonList: number[]): string {
  return pokemonList.map((dexNumber) => `${dexNumber}`).join(",");
}

function symmetricDiffRatio(a: Set<number>, b: Set<number>): number {
  let diff = 0;
  for (const value of a) {
    if (!b.has(value)) diff += 1;
  }
  for (const value of b) {
    if (!a.has(value)) diff += 1;
  }
  return diff / Math.max(a.size, 1);
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
    consumePendingDexImport,
    dismissPendingDexImport,
  } = useLuckyList();
  const {
    partnerDex,
    partnerName,
    partnerUpdatedAt,
    partnerLuckyCount,
    setPartnerDex,
    clearPartnerDex,
    hasPartner,
  } = usePartnerDex();
  const { data, loading, error } = useScrapedDuck();
  const [tab, setTab] = useState<Tab>(getInitialTab);
  const [pokedexSearch, setPokedexSearch] = useState<string>(
    getInitialPokedexSearch,
  );
  const [pokedexFilter, setPokedexFilter] = useState<PokedexFilter>(
    getInitialPokedexFilter,
  );
  const [includeUpcoming, setIncludeUpcoming] = useState(true);
  const [shareStatus, setShareStatus] = useState<string | null>(null);
  const [partnerToast, setPartnerToast] = useState<string | null>(null);

  useEffect(() => {
    if (!partnerToast) return;
    const timeout = window.setTimeout(() => {
      setPartnerToast(null);
    }, 5000);
    return () => window.clearTimeout(timeout);
  }, [partnerToast]);

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

    const luckyDex = collectLuckyDexNumbers(luckyList.pokemon, MAX_DEX_NUMBER);
    const encodedDex = encodeLuckyDexBitset(luckyList.pokemon, MAX_DEX_NUMBER);
    const decodedRoundTrip = decodeLuckyDexBitset(encodedDex, MAX_DEX_NUMBER);
    const payloadHash = checksumDexPayload(encodedDex);

    if (!decodedRoundTrip || decodedRoundTrip.size !== luckyDex.size) {
      setShareStatus("Could not generate a valid share link. Try again.");
      return;
    }

    if (import.meta.env.DEV) {
      console.info("[shared-dex] generated", {
        luckyCount: luckyDex.size,
        noibatLucky: luckyDex.has(714),
        hash: payloadHash,
      });
    }

    const url = new URL(window.location.href);
    url.searchParams.set(TAB_QUERY_KEY, tab);
    if (pokedexSearch) {
      url.searchParams.set(POKEDEX_SEARCH_QUERY_KEY, pokedexSearch);
    } else {
      url.searchParams.delete(POKEDEX_SEARCH_QUERY_KEY);
    }
    url.searchParams.set(POKEDEX_FILTER_QUERY_KEY, pokedexFilter);
    url.searchParams.set(DEX_QUERY_KEY, encodedDex);
    url.searchParams.set(DEX_HASH_QUERY_KEY, payloadHash);

    try {
      await navigator.clipboard.writeText(url.toString());
      setShareStatus(`Share link copied (${luckyDex.size} lucky entries).`);
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
    return scorePokemon(luckyList.pokemon, data, { includeUpcoming, partnerDex });
  }, [luckyList, data, includeUpcoming, partnerDex]);
  const sharedMissingByTier = useMemo(() => {
    if (!luckyList || !partnerDex) return null;
    const tradeableMissing = luckyList.pokemon
      .filter((pokemon) => !pokemon.isLucky && !partnerDex.has(pokemon.dexNumber))
      .filter((pokemon) => !isMythicalDex(pokemon.dexNumber))
      .sort((a, b) => a.dexNumber - b.dexNumber);

    const nonLegendary = tradeableMissing.filter(
      (pokemon) => !isLegendaryDex(pokemon.dexNumber),
    );
    const legendary = tradeableMissing.filter((pokemon) =>
      isLegendaryDex(pokemon.dexNumber),
    );

    return {
      total: tradeableMissing.length,
      nonLegendary,
      legendary,
    };
  }, [luckyList, partnerDex]);

  const tabs: { key: Tab; label: string }[] = [
    { key: "priority", label: "Trade Next" },
    { key: "raids", label: "Raids" },
    { key: "events", label: "Events" },
    { key: "pokedex", label: "Pokedex" },
  ];

  function getPendingPayloadPreview(): PendingDexPayload | null {
    if (!pendingDexImport) return null;
    const dex = decodeLuckyDexBitset(pendingDexImport.encoded, MAX_DEX_NUMBER);
    if (!dex) return null;
    return {
      dex,
      luckyCount: dex.size,
      hash: checksumDexPayload(pendingDexImport.encoded),
    };
  }

  function shouldConfirmOwnImport(incomingDex: Set<number>): string | null {
    if (!luckyList) return null;
    const currentDex = collectLuckyDexNumbers(luckyList.pokemon, MAX_DEX_NUMBER);
    const diffRatio = symmetricDiffRatio(currentDex, incomingDex);
    if (hasPartner && diffRatio > PARTNER_CONFIRM_DIFF_THRESHOLD) {
      return "Did you mean to set this as Partner instead?";
    }
    if (diffRatio > OWN_IMPORT_CONFIRM_DIFF_THRESHOLD) {
      return `You already have a list with ${currentDex.size} entries. Replace it?`;
    }
    return null;
  }

  function handleImportPendingAsMine() {
    const preview = getPendingPayloadPreview();
    if (!preview) {
      dismissPendingDexImport();
      return;
    }

    const confirmCopy = shouldConfirmOwnImport(preview.dex);
    if (confirmCopy && !window.confirm(confirmCopy)) return;

    const payload = consumePendingDexImport();
    if (!payload) return;

    importPokemon(toPokemonFromDex(payload.dex));
    setShareStatus("Imported shared dex as your list.");
  }

  function handleSetPendingAsPartner() {
    if (!luckyList) return;
    const payload = consumePendingDexImport();
    if (!payload) return;

    setPartnerDex(payload.dex);
    setTabAndSyncUrl("priority");

    const liveBothNeedCount =
      data
        ? scorePokemon(luckyList.pokemon, data, {
            includeUpcoming,
            partnerDex: payload.dex,
          }).filter((p) => p.neededBy === "both").length
        : 0;
    setPartnerToast(
      `Partner dex saved! ${liveBothNeedCount} Pokemon you both need are available right now.`,
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-yellow-400 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between gap-3">
            <h1 className="text-xl font-bold text-gray-900">Lucky PGO</h1>
            <div className="flex items-center gap-2">
              <CsvUpload
                onImport={importPokemon}
                hasExistingData={!!luckyList}
                onClear={clearList}
                showClear={false}
              />
              {luckyList && (
                <details className="relative">
                  <summary className="list-none cursor-pointer bg-white/90 text-gray-800 px-3 py-2 rounded-lg text-sm font-medium border border-yellow-300 hover:bg-white transition-colors">
                    Tools
                  </summary>
                  <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-10 p-1.5">
                    <button
                      onClick={exportBackupCsv}
                      className="w-full text-left px-2.5 py-2 text-sm rounded hover:bg-gray-100"
                    >
                      Export Backup CSV
                    </button>
                    <button
                      onClick={copyShareLink}
                      className="w-full text-left px-2.5 py-2 text-sm rounded hover:bg-gray-100"
                    >
                      Share Link
                    </button>
                    {hasPartner && (
                      <button
                        onClick={() => {
                          clearPartnerDex();
                          setShareStatus("Cleared partner dex.");
                        }}
                        className="w-full text-left px-2.5 py-2 text-sm rounded hover:bg-gray-100"
                      >
                        Clear Partner
                      </button>
                    )}
                    <button
                      onClick={clearList}
                      className="w-full text-left px-2.5 py-2 text-sm rounded text-red-600 hover:bg-red-50"
                    >
                      Clear data
                    </button>
                  </div>
                </details>
              )}
            </div>
          </div>
          {shareStatus && (
            <div className="mt-2 text-xs text-gray-700 bg-white/80 rounded px-3 py-2">
              {shareStatus}
            </div>
          )}
          {partnerToast && (
            <div className="mt-2 text-xs text-emerald-800 bg-emerald-50 rounded px-3 py-2">
              {partnerToast}
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
                <span className="text-[10px] uppercase tracking-wide text-gray-500">Step 1</span>{" "}
                Shared link detected with <strong>{pendingDexImport.luckyCount}</strong> lucky entries.
                Whose list is this?
              </div>
              {!luckyList && (
                <div className="mt-1 text-amber-700">
                  You don't have your own list yet - import this as yours first.
                </div>
              )}
              <div className="mt-2 flex gap-2">
                <button
                  onClick={handleImportPendingAsMine}
                  className="px-2.5 py-1 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
                >
                  Mine
                </button>
                {luckyList && (
                  <button
                    onClick={handleSetPendingAsPartner}
                    className="px-2.5 py-1 rounded bg-amber-500 text-white hover:bg-amber-600"
                  >
                    {hasPartner ? "Update Partner" : "My partner's"}
                  </button>
                )}
              </div>
              <div className="mt-1">
                <button
                  onClick={dismissPendingDexImport}
                  className="text-xs text-gray-500 hover:text-gray-700"
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}
          {luckyList && (
            <div className="mt-4">
              <ProgressBar luckyCount={luckyCount} totalCount={totalCount} />
              {hasPartner && (
                <div className="mt-1 text-xs text-gray-700">
                  You: {luckyCount}/{totalCount} lucky · {partnerName ?? "Partner"}: {partnerLuckyCount}/{totalCount} · Updated {formatPartnerUpdatedAt(partnerUpdatedAt)}
                </div>
              )}
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

            {tab === "priority" && (
              <>
                <label className="mb-3 inline-flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={includeUpcoming}
                    onChange={(e) => setIncludeUpcoming(e.target.checked)}
                    className="h-4 w-4 accent-yellow-500"
                  />
                  Include upcoming
                </label>
                {hasPartner && sharedMissingByTier && (
                  <details className="mb-4 bg-white border border-gray-200 rounded-lg p-3">
                    <summary className="cursor-pointer text-sm font-medium text-gray-800">
                      Shared Missing Lucky Dex ({sharedMissingByTier.total})
                    </summary>
                    <div className="mt-2 text-xs text-gray-700 space-y-3">
                      <div>
                        <div className="mb-1 flex items-center justify-between">
                          <div className="font-semibold text-gray-800">
                            Non-Legendary ({sharedMissingByTier.nonLegendary.length})
                          </div>
                          <button
                            onClick={() => navigator.clipboard.writeText(formatForClipboard(sharedMissingByTier.nonLegendary.map((pokemon) => (pokemon.dexNumber))))}
                            className="text-xs text-gray-500 hover:text-gray-700 active:text-green-600 flex items-center gap-1 transition-colors"
                          >
                            ⧉ Copy list
                          </button>
                        </div>
                        <div className="max-h-40 overflow-y-auto space-y-0.5 pr-1">
                          {sharedMissingByTier.nonLegendary.length === 0 ? (
                            <div className="text-gray-500">None</div>
                          ) : (
                            sharedMissingByTier.nonLegendary.map((pokemon) => (
                              <div key={pokemon.dexNumber}>
                                #{pokemon.dexNumber} {pokemon.name}
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                      <div>
                        <div className="mb-1 flex items-center justify-between">
                          <div className="font-semibold text-gray-800">
                            Legendary ({sharedMissingByTier.legendary.length})
                          </div>
                          <button
                            onClick={() => navigator.clipboard.writeText(formatForClipboard(sharedMissingByTier.legendary.map((pokemon) => (pokemon.dexNumber))))}
                            className="text-xs text-gray-500 hover:text-gray-700 active:text-green-600 flex items-center gap-1 transition-colors"
                          >
                            ⧉ Copy list
                          </button>
                        </div>
                        <div className="max-h-40 overflow-y-auto space-y-0.5 pr-1">
                          {sharedMissingByTier.legendary.length === 0 ? (
                            <div className="text-gray-500">None</div>
                          ) : (
                            sharedMissingByTier.legendary.map((pokemon) => (
                              <div key={pokemon.dexNumber}>
                                #{pokemon.dexNumber} {pokemon.name}
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </div>
                  </details>
                )}
              </>
            )}

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
                {tab === "priority" && (
                  <PriorityList
                    priorities={priorities}
                    hasPartner={hasPartner}
                    partnerName={partnerName ?? "Partner"}
                  />
                )}
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
