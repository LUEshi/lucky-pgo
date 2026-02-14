import fs from "node:fs/promises";
import path from "node:path";

const KEEP_DAYS = 7;
const SNAPSHOT_DIR = path.resolve("public/history");
const INDEX_PATH = path.join(SNAPSHOT_DIR, "index.json");
const BASE_URL = "https://raw.githubusercontent.com/bigfoott/ScrapedDuck/data";

const ENDPOINTS = {
  events: "events.min.json",
  raids: "raids.min.json",
  research: "research.min.json",
  eggs: "eggs.min.json",
  rockets: "rocketLineups.min.json",
};

function dateKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function cutoffDate(date = new Date()) {
  const cutoff = new Date(date);
  cutoff.setUTCDate(cutoff.getUTCDate() - (KEEP_DAYS - 1));
  return cutoff;
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }
  return response.json();
}

async function buildSnapshot() {
  const [events, raids, research, eggs, rockets] = await Promise.all([
    fetchJson(`${BASE_URL}/${ENDPOINTS.events}`),
    fetchJson(`${BASE_URL}/${ENDPOINTS.raids}`),
    fetchJson(`${BASE_URL}/${ENDPOINTS.research}`),
    fetchJson(`${BASE_URL}/${ENDPOINTS.eggs}`),
    fetchJson(`${BASE_URL}/${ENDPOINTS.rockets}`),
  ]);

  const generatedAt = new Date().toISOString();

  return {
    date: dateKey(new Date(generatedAt)),
    generatedAt,
    source: BASE_URL,
    data: { events, raids, research, eggs, rockets },
  };
}

async function pruneOldSnapshots() {
  const files = await fs.readdir(SNAPSHOT_DIR);
  const cutoff = cutoffDate();

  for (const file of files) {
    if (!/^\d{4}-\d{2}-\d{2}\.json$/.test(file)) continue;
    const fileDate = new Date(`${file.slice(0, 10)}T00:00:00Z`);
    if (fileDate < cutoff) {
      await fs.unlink(path.join(SNAPSHOT_DIR, file));
    }
  }
}

async function writeIndex() {
  const files = await fs.readdir(SNAPSHOT_DIR);
  const snapshots = files
    .filter((file) => /^\d{4}-\d{2}-\d{2}\.json$/.test(file))
    .sort()
    .reverse()
    .map((file) => ({
      date: file.slice(0, 10),
      path: `history/${file}`,
    }));

  await fs.writeFile(
    INDEX_PATH,
    `${JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        keepDays: KEEP_DAYS,
        snapshots,
      },
      null,
      2,
    )}\n`,
  );
}

async function main() {
  await fs.mkdir(SNAPSHOT_DIR, { recursive: true });

  const snapshot = await buildSnapshot();
  const outPath = path.join(SNAPSHOT_DIR, `${snapshot.date}.json`);
  await fs.writeFile(outPath, `${JSON.stringify(snapshot, null, 2)}\n`);

  await pruneOldSnapshots();
  await writeIndex();

  console.log(`Updated history snapshot: ${snapshot.date}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
