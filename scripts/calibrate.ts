/**
 * Kalibratie: scoor een landelijke mix van adressen (stadscentra, wijken,
 * dorpen) en schrijf per pijler percentiel-anchors (p10/p50/p90) naar
 * data/calibration.json. De score-engine gebruikt die anchors om ruwe
 * pijlerscores landelijk vergelijkbaar te maken.
 *
 * Run: npm run calibrate  (vereist netwerk)
 */
import { resolveFreeText } from "../src/lib/adapters/locatieserver";
import { buildReport } from "../src/lib/service/report";
import { computeScore } from "../src/lib/score/engine";
import type { PartialScoreKey } from "../src/lib/types";

// Load env
import fs from "node:fs";
import path from "node:path";

function loadEnv() {
  const p = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, "utf8").split("\n")) {
    const m = /^([^#=]+)=(.*)$/.exec(line.trim());
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}
loadEnv();

const ADDRESSES = [
  // Stadscentra
  "Dam 1, Amsterdam",
  "Prinsengracht 263, Amsterdam",
  "Museumplein 6, Amsterdam",
  "Coolsingel 40, Rotterdam",
  "Witte de Withstraat 50, Rotterdam",
  "Lange Voorhout 74, Den Haag",
  "Domplein 21, Utrecht",
  "Neude 11, Utrecht",
  "Grote Markt 1, Groningen",
  "Vrijthof 15, Maastricht",
  "Grote Markt 17, Haarlem",
  "Parade 18, Den Bosch",
  "Havermarkt 1, Breda",
  "Stadhuisplein 10, Eindhoven",
  "Korenmarkt 1, Arnhem",
  "Grote Markt 1, Zwolle",
  "Grote Markt 1, Nijmegen",
  "Brink 1, Deventer",
  "Grote Markt 1, Delft",
  "Markt 1, Middelburg",
  // Woonwijken (stad, buiten centrum)
  "Rooseveltlaan 100, Amsterdam",
  "Osdorpplein 500, Amsterdam",
  "Molenlaan 50, Rotterdam",
  "Slinge 250, Rotterdam",
  "Loevenhoutsedijk 30, Utrecht",
  "Amsterdamsestraatweg 500, Utrecht",
  "Laan van Meerdervoort 800, Den Haag",
  "Loosduinsekade 100, Den Haag",
  "Tongelresestraat 300, Eindhoven",
  "Aalderinkshoek 10, Almelo",
  "Paterswoldseweg 200, Groningen",
  "Brusselstraat 20, Maastricht",
  "Schalkwijkerstraat 50, Haarlem",
  "Kanaalstraat 100, Leiden",
  "Vondellaan 20, Amersfoort",
  // Kleinere steden en dorpen
  "Hoofdstraat 50, Apeldoorn",
  "Stationsweg 10, Hilversum",
  "Dorpsstraat 20, Laren NH",
  "Kerkstraat 10, Volendam",
  "Boulevard Barnaart 20, Zandvoort",
  "Dorpsstraat 40, Castricum",
  "Hoofdstraat 30, Emmen",
  "Markt 10, Valkenburg",
  "Dorpsstraat 15, Renkum",
  "Hoofdstraat 25, Sassenheim",
  "Rijksstraatweg 100, Haren",
  "Dorpsstraat 10, Twello",
  "Hoofdstraat 60, Hoogeveen",
  "Kerkbuurt 40, Sliedrecht",
  "Voorstraat 30, Franeker",
  "Havenstraat 5, IJmuiden",
  "Middenweg 100, Heerhugowaard",
  "Zuiderzeestraatweg 150, Oldebroek",
  "Dorpsstraat 50, Zoetermeer",
  "Julianastraat 20, Katwijk",
];

const PILLAR_KEYS: PartialScoreKey[] = [
  "woning",
  "waarde",
  "veiligheid",
  "milieu",
  "klimaat",
  "voorzieningen",
  "buurt",
];

function percentile(sorted: number[], p: number): number {
  if (!sorted.length) return NaN;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor(sorted.length * p)));
  return sorted[idx];
}

async function main() {
  const totals: number[] = [];
  const pillarRaw: Record<PartialScoreKey, number[]> = {
    woning: [],
    waarde: [],
    veiligheid: [],
    milieu: [],
    klimaat: [],
    voorzieningen: [],
    buurt: [],
  };
  const rows: Array<{ address: string; score: number | null; ok: boolean }> = [];

  for (const address of ADDRESSES) {
    try {
      const resolved = await resolveFreeText(address);
      if (!resolved) {
        rows.push({ address, score: null, ok: false });
        console.log(`MISS  ${address}`);
        continue;
      }
      const report = await buildReport(resolved, "consumer");
      // Ruwe (ongekalibreerde) scores voor de anchors
      const raw = computeScore(report.facts, "consumer", null);
      for (const p of raw.partials) {
        if (p.score != null) pillarRaw[p.key].push(p.score);
      }
      const s = raw.total;
      if (s != null) totals.push(s);
      rows.push({ address: resolved.weergavenaam, score: s, ok: true });
      console.log(`OK    ${s?.toString().padStart(3) ?? "—"}  ${resolved.weergavenaam}`);
    } catch (e) {
      rows.push({ address, score: null, ok: false });
      console.log(`ERR   ${address}: ${e instanceof Error ? e.message : e}`);
    }
  }

  totals.sort((a, b) => a - b);
  const avg = totals.length
    ? Math.round(totals.reduce((a, b) => a + b, 0) / totals.length)
    : null;

  const pillars: Partial<Record<PartialScoreKey, { p10: number; p50: number; p90: number; n: number }>> = {};
  console.log("\n=== Kalibratie per pijler (ruw) ===");
  for (const key of PILLAR_KEYS) {
    const vals = pillarRaw[key].sort((a, b) => a - b);
    if (vals.length < 10) {
      console.log(`${key.padEnd(14)} n=${vals.length} — te weinig data, geen anchors`);
      continue;
    }
    const anchors = {
      p10: percentile(vals, 0.1),
      p50: percentile(vals, 0.5),
      p90: percentile(vals, 0.9),
      n: vals.length,
    };
    if (!(anchors.p10 < anchors.p50 && anchors.p50 < anchors.p90)) {
      console.log(
        `${key.padEnd(14)} n=${vals.length} p10=${anchors.p10} p50=${anchors.p50} p90=${anchors.p90} — te weinig spreiding, geen anchors`,
      );
      continue;
    }
    pillars[key] = anchors;
    console.log(
      `${key.padEnd(14)} n=${vals.length} p10=${anchors.p10} p50=${anchors.p50} p90=${anchors.p90}`,
    );
  }

  console.log("\n=== Totaal (ruw) ===");
  console.log(
    `n=${totals.length}/${ADDRESSES.length}  avg=${avg}  p10=${percentile(totals, 0.1)}  p50=${percentile(totals, 0.5)}  p90=${percentile(totals, 0.9)}`,
  );

  fs.mkdirSync(path.join(process.cwd(), "data"), { recursive: true });
  fs.writeFileSync(
    path.join(process.cwd(), "data", "calibration.json"),
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        avg,
        p10: percentile(totals, 0.1),
        p50: percentile(totals, 0.5),
        p90: percentile(totals, 0.9),
        pillars,
        rows,
      },
      null,
      2,
    ),
  );
  console.log("\ndata/calibration.json geschreven");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
