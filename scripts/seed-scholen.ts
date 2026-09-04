/**
 * Seed a sample of Dutch schools into SQLite for "scholen binnen 1 km".
 * For production, replace with a full DUO CSV import.
 */
import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "woonscore.db");

const SAMPLE: Array<{ naam: string; postcode: string; plaats: string; lat: number; lon: number }> = [
  { naam: "OBS De 9 Straatjes", postcode: "1016GJ", plaats: "Amsterdam", lat: 52.3708, lon: 4.8855 },
  { naam: "Basisschool Annie M.G. Schmidt", postcode: "1018VN", plaats: "Amsterdam", lat: 52.3652, lon: 4.9147 },
  { naam: "Montessori School Amsterdam", postcode: "1075AV", plaats: "Amsterdam", lat: 52.3515, lon: 4.859 },
  { naam: "Daltonschool Neptunus", postcode: "1056LN", plaats: "Amsterdam", lat: 52.372, lon: 4.847 },
  { naam: "OBS De Pijler", postcode: "3021HB", plaats: "Rotterdam", lat: 51.923, lon: 4.462 },
  { naam: "CBS De Regenboog", postcode: "3011TA", plaats: "Rotterdam", lat: 51.9225, lon: 4.4793 },
  { naam: "OBS Coolhaven", postcode: "3024EA", plaats: "Rotterdam", lat: 51.9105, lon: 4.453 },
  { naam: "Basisschool De Fontein", postcode: "2511CB", plaats: "Den Haag", lat: 52.0786, lon: 4.3113 },
  { naam: "OBS De Vlieger", postcode: "2517KK", plaats: "Den Haag", lat: 52.084, lon: 4.285 },
  { naam: "Jenaplanschool Utrecht", postcode: "3512JE", plaats: "Utrecht", lat: 52.0935, lon: 5.119 },
  { naam: "OBS De Klimop", postcode: "3532AD", plaats: "Utrecht", lat: 52.089, lon: 5.095 },
  { naam: "Basisschool Sint Jan", postcode: "5611ZW", plaats: "Eindhoven", lat: 51.4416, lon: 5.4697 },
  { naam: "OBS De Horizon", postcode: "9712CN", plaats: "Groningen", lat: 53.2194, lon: 6.5665 },
  { naam: "Basisschool De Brug", postcode: "6211AA", plaats: "Maastricht", lat: 50.8514, lon: 5.691 },
  { naam: "OBS Het Anker", postcode: "6811KG", plaats: "Arnhem", lat: 51.9851, lon: 5.8987 },
  { naam: "CBS De Regenboog Haarlem", postcode: "2011AA", plaats: "Haarlem", lat: 52.3874, lon: 4.6462 },
  { naam: "OBS De Notenkraker", postcode: "3511AA", plaats: "Utrecht", lat: 52.0907, lon: 5.1214 },
  { naam: "Basisschool Westerpark", postcode: "1051AA", plaats: "Amsterdam", lat: 52.386, lon: 4.872 },
  { naam: "OBS Oostpoort", postcode: "1093AA", plaats: "Amsterdam", lat: 52.358, lon: 4.928 },
  { naam: "Dalton De Rank", postcode: "3031AA", plaats: "Rotterdam", lat: 51.93, lon: 4.49 },
];

fs.mkdirSync(DATA_DIR, { recursive: true });
const db = new Database(DB_PATH);
db.exec(`
  CREATE TABLE IF NOT EXISTS scholen (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    naam TEXT NOT NULL,
    postcode TEXT,
    plaats TEXT,
    lat REAL NOT NULL,
    lon REAL NOT NULL
  );
`);

const count = (db.prepare(`SELECT COUNT(*) as c FROM scholen`).get() as { c: number }).c;
if (count > 0) {
  console.log(`scholen tabel heeft al ${count} rijen — skip seed (verwijder data/woonscore.db om opnieuw te seeden)`);
  process.exit(0);
}

const insert = db.prepare(
  `INSERT INTO scholen (naam, postcode, plaats, lat, lon) VALUES (?, ?, ?, ?, ?)`,
);
const tx = db.transaction(() => {
  for (const s of SAMPLE) {
    insert.run(s.naam, s.postcode, s.plaats, s.lat, s.lon);
  }
});
tx();
console.log(`Geïmporteerd: ${SAMPLE.length} scholen (sample). Vervang later door DUO CSV.`);
