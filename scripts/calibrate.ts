/**
 * Calibration: score a spread of NL addresses and print distribution.
 * Run with: npm run calibrate  (requires network)
 */
import { resolveFreeText } from "../src/lib/adapters/locatieserver";
import { buildReport } from "../src/lib/service/report";

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
  "Dam 1, Amsterdam",
  "Prinsengracht 263, Amsterdam",
  "Museumplein 6, Amsterdam",
  "Coolsingel 40, Rotterdam",
  "Witte de Withstraat 50, Rotterdam",
  "Lange Voorhout 74, Den Haag",
  "Domplein 21, Utrecht",
  "Grote Markt 1, Groningen",
  "Stationsplein 1, Eindhoven",
  "Markt 1, Maastricht",
  "Grote Markt 17, Haarlem",
  "Brink 1, Deventer",
  "Neude 11, Utrecht",
  "Vrijthof 15, Maastricht",
  "Oudegracht 99, Utrecht",
  "Kalverstraat 1, Amsterdam",
  "Lijnbaan 50, Rotterdam",
  "Spui 70, Den Haag",
  "Zernikeplein 7, Groningen",
  "Wilhelminaplein 1, Leeuwarden",
  "Parade 18, Den Bosch",
  "Grote Kerkhof 1, Deventer",
  "Havermarkt 1, Breda",
  "Stadhuisplein 10, Eindhoven",
  "Kennemerplein 1, Haarlem",
  "Rodezand 34, Rotterdam",
  "Nieuwezijds Voorburgwal 147, Amsterdam",
  "Janskerkhof 15, Utrecht",
  "Binnenhof 1, Den Haag",
  "Waagplein 1, Alkmaar",
  "Grote Markt 1, Delft",
  "Korenmarkt 1, Arnhem",
  "Grote Markt 1, Zwolle",
  "Markt 1, Tilburg",
  "Grote Markt 1, Nijmegen",
  "Stadhuisstraat 1, Leiden",
  "Grote Markt 1, Amersfoort",
  "Markt 1, Middelburg",
  "Grote Markt 1, Enschede",
  "Markt 1, Apel",
  "Hoofdstraat 1, Apel",
  "Dorpsstraat 1, Laren NH",
  "Hoofdstraat 50, Apel",
  "Kerkstraat 1, Volendam",
  "Strandweg 1, Scheveningen",
  "Boulevard 1, Zandvoort",
  "Havenstraat 1, IJmuiden",
  "Stationsweg 1, Hilversum",
  "Hoofdstraat 1, Apel",
  "Marktplein 1, Apel",
];

async function main() {
  const scores: number[] = [];
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
      const s = report.score.total;
      if (s != null) scores.push(s);
      rows.push({ address: resolved.weergavenaam, score: s, ok: true });
      console.log(`OK    ${s?.toString().padStart(3) ?? "—"}  ${resolved.weergavenaam}`);
    } catch (e) {
      rows.push({ address, score: null, ok: false });
      console.log(`ERR   ${address}: ${e instanceof Error ? e.message : e}`);
    }
  }

  scores.sort((a, b) => a - b);
  const avg = scores.length
    ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
    : null;
  const p50 = scores.length ? scores[Math.floor(scores.length * 0.5)] : null;
  const p10 = scores.length ? scores[Math.floor(scores.length * 0.1)] : null;
  const p90 = scores.length ? scores[Math.floor(scores.length * 0.9)] : null;

  console.log("\n=== Kalibratie ===");
  console.log(`n=${scores.length}/${ADDRESSES.length}  avg=${avg}  p10=${p10}  p50=${p50}  p90=${p90}`);
  console.log(`min=${scores[0] ?? "—"}  max=${scores[scores.length - 1] ?? "—"}`);

  fs.mkdirSync(path.join(process.cwd(), "data"), { recursive: true });
  fs.writeFileSync(
    path.join(process.cwd(), "data", "calibration.json"),
    JSON.stringify({ generatedAt: new Date().toISOString(), avg, p10, p50, p90, rows }, null, 2),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
