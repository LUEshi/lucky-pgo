/** Deduplicate an array by a string key extracted from each item. Last occurrence wins. */
export function dedupeByKey<T>(list: T[], keyFn: (item: T) => string): T[] {
  return Array.from(new Map(list.map((item) => [keyFn(item), item])).values());
}
