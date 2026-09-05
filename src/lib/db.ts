import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "woonscore.db");

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (db) return db;
  fs.mkdirSync(DATA_DIR, { recursive: true });
  db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS cache (
      cache_key TEXT PRIMARY KEY,
      source_id TEXT NOT NULL,
      payload TEXT NOT NULL,
      fetched_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_cache_source ON cache(source_id);
    CREATE INDEX IF NOT EXISTS idx_cache_expires ON cache(expires_at);

    CREATE TABLE IF NOT EXISTS adapter_status (
      source_id TEXT PRIMARY KEY,
      last_ok_at INTEGER,
      last_error_at INTEGER,
      last_error TEXT,
      last_latency_ms INTEGER,
      ok_count INTEGER DEFAULT 0,
      error_count INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS scholen (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      naam TEXT NOT NULL,
      postcode TEXT,
      plaats TEXT,
      lat REAL NOT NULL,
      lon REAL NOT NULL,
      vestigingscode TEXT,
      type TEXT,
      denominatie TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_scholen_latlon ON scholen(lat, lon);

    CREATE TABLE IF NOT EXISTS reports (
      nummeraanduiding_id TEXT PRIMARY KEY,
      weergavenaam TEXT,
      payload TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS rate_limits (
      key TEXT PRIMARY KEY,
      window_start INTEGER NOT NULL,
      count INTEGER NOT NULL
    );
  `);
  migrateScholen(db);
  return db;
}

/** Bestaande databases van vóór de DUO-import missen deze kolommen. */
function migrateScholen(db: Database.Database) {
  const cols = new Set(
    (db.prepare(`PRAGMA table_info(scholen)`).all() as Array<{ name: string }>).map(
      (c) => c.name,
    ),
  );
  if (!cols.has("vestigingscode")) db.exec(`ALTER TABLE scholen ADD COLUMN vestigingscode TEXT`);
  if (!cols.has("type")) db.exec(`ALTER TABLE scholen ADD COLUMN type TEXT`);
  if (!cols.has("denominatie")) db.exec(`ALTER TABLE scholen ADD COLUMN denominatie TEXT`);
  db.exec(
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_scholen_vestigingscode ON scholen(vestigingscode)`,
  );
}
