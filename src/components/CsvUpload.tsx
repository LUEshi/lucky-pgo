import { useCallback, useState } from "react";
import type { Pokemon } from "../types";
import { parseCsv } from "../utils/csvParser";

interface CsvUploadProps {
  onImport: (pokemon: Pokemon[]) => void;
  hasExistingData: boolean;
  onClear: () => void;
  showClear?: boolean;
}

export function CsvUpload({
  onImport,
  hasExistingData,
  onClear,
  showClear = true,
}: CsvUploadProps) {
  const [error, setError] = useState<string | null>(null);

  const handleFile = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setError(null);
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        if (!text || text.trim().length === 0) {
          setError("File is empty");
          return;
        }
        const pokemon = parseCsv(text);
        if (pokemon.length > 0) {
          onImport(pokemon);
          setError(null);
        } else {
          setError(
            `No Pokemon found. Make sure to download as "Comma-separated values (.csv)" from Google Sheets.`,
          );
        }
      };
      reader.onerror = () => {
        setError("Failed to read file");
      };
      reader.readAsText(file);
      e.target.value = "";
    },
    [onImport],
  );

  return (
    <div>
      <div className="flex items-center gap-3 flex-wrap">
        <label className="cursor-pointer bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
          {hasExistingData ? "Re-upload CSV" : "Upload CSV"}
          <input
            type="file"
            accept=".csv,.txt"
            onChange={handleFile}
            className="hidden"
          />
        </label>
        {hasExistingData && showClear && (
          <button
            onClick={onClear}
            className="text-sm text-red-500 hover:text-red-700 transition-colors"
          >
            Clear data
          </button>
        )}
      </div>
      {error && (
        <div className="mt-2 text-xs text-red-600 bg-red-50 rounded px-3 py-2 max-w-md">
          {error}
        </div>
      )}
    </div>
  );
}
