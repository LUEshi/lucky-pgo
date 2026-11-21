import { useEffect, useState } from "react";
import type { KeeperReport } from "../types";

// The weekly workflow commits the report to main. Reading it from the repo's raw file means the
// app shows the newest report without waiting for a Pages redeploy.
const RAW_URL = "https://raw.githubusercontent.com/LUEshi/lucky-pgo/main/public/reports/keepers-latest.json";
const LOCAL_URL = `${import.meta.env.BASE_URL}reports/keepers-latest.json`;

async function fetchReport(url: string): Promise<KeeperReport> {
  const res = await fetch(url, { cache: "no-cache" });
  if (!res.ok) throw new Error(`${res.status} from ${url}`);
  return (await res.json()) as KeeperReport;
}

export function useKeeperReport(enabled: boolean) {
  const [report, setReport] = useState<KeeperReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || report) return;
    let cancelled = false;
    // In dev, the locally generated report is the freshest; in production, the repo copy is.
    const [first, second] = import.meta.env.DEV ? [LOCAL_URL, RAW_URL] : [RAW_URL, LOCAL_URL];
    fetchReport(first)
      .catch(() => fetchReport(second))
      .then((r) => {
        if (!cancelled) setReport(r);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, report]);

  return { report, error, loading: enabled && !report && !error };
}
