/**
 * Smoke test: a few distinctive addresses via the score pipeline + API shape checks.
 */
import fs from "node:fs";
import path from "node:path";
import { resolveFreeText } from "../src/lib/adapters/locatieserver";
import { buildReport } from "../src/lib/service/report";

function loadEnv() {
  const p = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, "utf8").split("\n")) {
    const m = /^([^#=]+)=(.*)$/.exec(line.trim());
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}
loadEnv();

const CASES = [
  "Prinsengracht 263, Amsterdam",
  "Coolsingel 40, Rotterdam",
  "Domplein 21, Utrecht",
  "Lange Voorhout 74, Den Haag",
  "Stationsplein 22, Eindhoven",
];

async function main() {
  let failed = 0;
  for (const address of CASES) {
    process.stdout.write(`→ ${address} … `);
    try {
      const resolved = await resolveFreeText(address);
      if (!resolved) throw new Error("geocode miss");
      const consumer = await buildReport(resolved, "consumer");
      const commercial = await buildReport(resolved, "commercial");
      if (consumer.score.total == null) throw new Error("no consumer score");
      if (!commercial.score.risks?.length) throw new Error("no commercial risks");
      if (!consumer.facts.sources.length) throw new Error("no sources");
      console.log(
        `OK score=${consumer.score.total} sources=${consumer.facts.sources.filter((s) => s.status === "ok").length} ok`,
      );
    } catch (e) {
      failed++;
      console.log(`FAIL ${e instanceof Error ? e.message : e}`);
    }
  }
  if (failed) {
    console.error(`\n${failed} smoke case(s) failed`);
    process.exit(1);
  }
  console.log("\nAll smoke tests passed");
}

main();
