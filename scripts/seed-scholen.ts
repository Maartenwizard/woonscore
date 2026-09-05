/**
 * Importeer alle school-vestigingen (basisonderwijs + voortgezet onderwijs)
 * uit de officiële DUO open-databestanden en geocodeer ze via PDOK
 * Locatieserver (postcode + huisnummer).
 *
 * Bron (CC-BY 4.0): https://onderwijsdata.duo.nl
 * Run: npm run seed:scholen          (hervat waar hij was gebleven)
 *      npm run seed:scholen -- --fresh   (verwijder bestaande scholen en importeer opnieuw)
 */
import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "woonscore.db");

const DUO_SOURCES: Array<{ type: "bo" | "vo"; url: string }> = [
  {
    type: "bo",
    url: "https://onderwijsdata.duo.nl/dataset/786f12ea-6224-42fd-ab72-de4d7d879535/resource/dcc9c9a5-6d01-410b-967f-810557588ba4/download/vestigingenbo.csv",
  },
  {
    type: "vo",
    url: "https://onderwijsdata.duo.nl/dataset/c8e6ffdd-cc2b-44ee-880f-0ff03f72e868/resource/5187f8d5-ff9c-4284-8e06-4311f0354956/download/vestigingenvo.csv",
  },
];

const PDOK_FREE = "https://api.pdok.nl/bzk/locatieserver/search/v3_1/free";
const GEOCODE_CONCURRENCY = 8;

interface Vestiging {
  vestigingscode: string;
  naam: string;
  postcode: string;
  huisnummer: string;
  plaats: string;
  denominatie: string;
  type: "bo" | "vo";
}

/** Minimale CSV-parser met quote-ondersteuning (DUO gebruikt komma + quotes). */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.length > 1 || row[0] !== "") rows.push(row);
      row = [];
    } else {
      field += c;
    }
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

async function downloadVestigingen(): Promise<Vestiging[]> {
  const all: Vestiging[] = [];
  for (const src of DUO_SOURCES) {
    process.stdout.write(`Downloaden ${src.type.toUpperCase()} … `);
    const res = await fetch(src.url, {
      headers: { "User-Agent": "Woonscore/0.1 (seed-scholen)" },
      signal: AbortSignal.timeout(120000),
    });
    if (!res.ok) throw new Error(`DUO ${src.type} download: HTTP ${res.status}`);
    const rows = parseCsv(await res.text());
    const header = rows[0].map((h) => h.trim().toUpperCase());
    const idx = (name: string) => header.indexOf(name);
    const iCode = idx("VESTIGINGSCODE");
    const iNaam = idx("VESTIGINGSNAAM");
    const iPostcode = idx("POSTCODE");
    const iHuisnr = idx("HUISNUMMER-TOEVOEGING");
    const iPlaats = idx("PLAATSNAAM");
    const iDenominatie = idx("DENOMINATIE");
    if ([iCode, iNaam, iPostcode, iHuisnr].some((i) => i < 0)) {
      throw new Error(`DUO ${src.type}: onverwachte CSV-kolommen: ${header.join(", ")}`);
    }
    let count = 0;
    for (const row of rows.slice(1)) {
      const postcode = (row[iPostcode] ?? "").replace(/\s/g, "").toUpperCase();
      const huisnummer = /^\d+/.exec((row[iHuisnr] ?? "").trim())?.[0] ?? "";
      const naam = (row[iNaam] ?? "").trim();
      const code = (row[iCode] ?? "").trim();
      if (!postcode || !huisnummer || !naam || !code) continue;
      all.push({
        vestigingscode: code,
        naam,
        postcode,
        huisnummer,
        plaats: (row[iPlaats] ?? "").trim(),
        denominatie: (row[iDenominatie] ?? "").trim(),
        type: src.type,
      });
      count++;
    }
    console.log(`${count} vestigingen`);
  }
  return all;
}

async function geocode(
  postcode: string,
  huisnummer: string,
): Promise<{ lat: number; lon: number } | null> {
  const q = `postcode:${postcode} and huisnummer:${huisnummer}`;
  const url = `${PDOK_FREE}?q=${encodeURIComponent(q)}&fq=type:adres&rows=1&fl=centroide_ll`;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "Woonscore/0.1 (seed-scholen)" },
        signal: AbortSignal.timeout(10000),
      });
      if (res.status === 429) {
        await sleep(2000 * (attempt + 1));
        continue;
      }
      if (!res.ok) return null;
      const json = (await res.json()) as {
        response?: { docs?: Array<{ centroide_ll?: string }> };
      };
      const point = json.response?.docs?.[0]?.centroide_ll;
      const m = point ? /POINT\(([\d.-]+) ([\d.-]+)\)/.exec(point) : null;
      if (!m) return null;
      return { lon: Number(m[1]), lat: Number(m[2]) };
    } catch {
      await sleep(500 * (attempt + 1));
    }
  }
  return null;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function openDb(): Database.Database {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS scholen (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      naam TEXT NOT NULL,
      postcode TEXT,
      plaats TEXT,
      lat REAL NOT NULL,
      lon REAL NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_scholen_latlon ON scholen(lat, lon);
  `);
  // Migratie: kolommen voor DUO-import
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
  return db;
}

async function main() {
  const fresh = process.argv.includes("--fresh");
  const db = openDb();

  if (fresh) {
    db.exec(`DELETE FROM scholen`);
    console.log("Bestaande scholen verwijderd (--fresh)");
  } else {
    // Sample-rijen van de oude seed (zonder vestigingscode) opruimen
    db.exec(`DELETE FROM scholen WHERE vestigingscode IS NULL`);
  }

  const existing = new Set(
    (
      db.prepare(`SELECT vestigingscode FROM scholen WHERE vestigingscode IS NOT NULL`).all() as Array<{
        vestigingscode: string;
      }>
    ).map((r) => r.vestigingscode),
  );

  const vestigingen = (await downloadVestigingen()).filter(
    (v) => !existing.has(v.vestigingscode),
  );
  if (!vestigingen.length) {
    console.log(`Niets te doen — ${existing.size} scholen al aanwezig.`);
    return;
  }
  console.log(
    `Te geocoderen: ${vestigingen.length} vestigingen (al aanwezig: ${existing.size}) …`,
  );

  const insert = db.prepare(
    `INSERT INTO scholen (naam, postcode, plaats, lat, lon, vestigingscode, type, denominatie)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(vestigingscode) DO UPDATE SET
       naam = excluded.naam, postcode = excluded.postcode, plaats = excluded.plaats,
       lat = excluded.lat, lon = excluded.lon, type = excluded.type,
       denominatie = excluded.denominatie`,
  );

  let done = 0;
  let missed = 0;
  let cursor = 0;

  async function worker() {
    while (cursor < vestigingen.length) {
      const v = vestigingen[cursor++];
      const point = await geocode(v.postcode, v.huisnummer);
      if (point) {
        insert.run(
          v.naam,
          v.postcode,
          v.plaats,
          point.lat,
          point.lon,
          v.vestigingscode,
          v.type,
          v.denominatie,
        );
      } else {
        missed++;
      }
      done++;
      if (done % 250 === 0) {
        console.log(`  ${done}/${vestigingen.length} (geocode-miss: ${missed})`);
      }
    }
  }

  await Promise.all(Array.from({ length: GEOCODE_CONCURRENCY }, () => worker()));

  const total = (db.prepare(`SELECT COUNT(*) as c FROM scholen`).get() as { c: number }).c;
  console.log(
    `Klaar: ${done - missed} geïmporteerd, ${missed} zonder geocode. Totaal in database: ${total} scholen.`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
