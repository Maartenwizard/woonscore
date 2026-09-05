/**
 * WMS-healthcheck: controleert of de geconfigureerde RIVM- en
 * Klimaateffectatlas-lagen nog bestaan in de GetCapabilities van de services,
 * en of GetFeatureInfo op een testpunt een plausibele waarde teruggeeft.
 *
 * Run: npm run check:wms
 * Exit code 1 als een primaire laag ontbreekt of geen data geeft.
 */
import { KEA_LAYERS, KEA_WMS, fetchClimateAt } from "../src/lib/adapters/klimaat";
import { RIVM_LAYERS, RIVM_WMS, fetchEnvironment } from "../src/lib/adapters/rivm";
import type { ResolvedAddress } from "../src/lib/types";

// Dam, Amsterdam — punt met bekende waarden voor alle lagen
const TEST_POINT = {
  lat: 52.3731,
  lon: 4.8932,
} as const;

async function layerNames(capabilitiesUrl: string): Promise<Set<string>> {
  const res = await fetch(capabilitiesUrl, {
    headers: { "User-Agent": "Woonscore/0.1 (check-wms)" },
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error(`GetCapabilities ${res.status}`);
  const xml = await res.text();
  const names = new Set<string>();
  for (const m of xml.matchAll(/<Name>([^<]+)<\/Name>/g)) {
    names.add(m[1]);
  }
  return names;
}

function capsUrl(base: string): string {
  return `${base}?SERVICE=WMS&REQUEST=GetCapabilities`;
}

async function main() {
  let failures = 0;

  const services: Array<{ name: string; base: string; layerGroups: Record<string, readonly string[]> }> = [
    {
      name: "RIVM GCN (lucht)",
      base: RIVM_WMS.gcn,
      layerGroups: { no2: RIVM_LAYERS.no2, pm25: RIVM_LAYERS.pm25 },
    },
    {
      name: "RIVM ALO (geluid)",
      base: RIVM_WMS.alo,
      layerGroups: { geluid: RIVM_LAYERS.geluid },
    },
    {
      name: "Klimaateffectatlas",
      base: KEA_WMS,
      layerGroups: {
        overstroming: KEA_LAYERS.overstroming,
        fundering: KEA_LAYERS.fundering,
        bodemdaling: KEA_LAYERS.bodemdaling,
        bodemdalingFallback: KEA_LAYERS.bodemdalingFallback,
      },
    },
  ];

  for (const svc of services) {
    process.stdout.write(`\n== ${svc.name}\n`);
    let names: Set<string>;
    try {
      names = await layerNames(capsUrl(svc.base));
    } catch (e) {
      console.log(`  FAIL capabilities: ${e instanceof Error ? e.message : e}`);
      failures++;
      continue;
    }
    for (const [group, layers] of Object.entries(svc.layerGroups)) {
      const present = layers.filter((l) => names.has(l));
      const missing = layers.filter((l) => !names.has(l));
      if (!present.length) {
        console.log(`  FAIL ${group}: geen van de lagen bestaat nog (${layers.join(", ")})`);
        failures++;
      } else if (missing.length) {
        console.log(`  WARN ${group}: ok (${present[0]}), maar ontbrekend: ${missing.join(", ")}`);
      } else {
        console.log(`  OK   ${group}: ${present.join(", ")}`);
      }
    }
  }

  // Live GetFeatureInfo via de adapters zelf (zonder cache-hit garantie)
  const address = {
    country: "NL",
    weergavenaam: "Testpunt Dam, Amsterdam",
    straatnaam: "Dam",
    huisnummer: "1",
    postcode: "1012JS",
    woonplaatsnaam: "Amsterdam",
    gemeentenaam: "Amsterdam",
    nummeraanduidingId: "check-wms",
    lat: TEST_POINT.lat,
    lon: TEST_POINT.lon,
  } as ResolvedAddress;

  process.stdout.write("\n== GetFeatureInfo testpunt (Dam, Amsterdam)\n");
  const env = await fetchEnvironment(address);
  if (env?.no2 == null || env?.pm25 == null || env?.geluidLden == null) {
    console.log(`  FAIL RIVM: ${JSON.stringify(env)}`);
    failures++;
  } else {
    console.log(
      `  OK   RIVM: NO2=${env.no2} µg/m³, PM2.5=${env.pm25} µg/m³, Lden=${env.geluidLden} dB`,
    );
  }
  const climate = await fetchClimateAt(address);
  if (!climate || (climate.funderingsrisico == null && climate.bodemdalingMmJaar == null)) {
    console.log(`  FAIL Klimaateffectatlas: ${JSON.stringify(climate)}`);
    failures++;
  } else {
    console.log(
      `  OK   Klimaateffectatlas: waterdiepte=${climate.overstromingsdiepteM ?? "—"} m, fundering=${climate.funderingsrisico ?? "—"}, bodemdaling=${climate.bodemdalingMmJaar ?? "—"} mm/j`,
    );
  }

  if (failures) {
    console.error(`\n${failures} WMS-check(s) gefaald`);
    process.exit(1);
  }
  console.log("\nAlle WMS-checks geslaagd");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
