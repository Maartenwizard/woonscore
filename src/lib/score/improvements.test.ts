import { describe, expect, it } from "vitest";
import type { PropertyFacts, ResolvedAddress } from "@/lib/types";
import { buildImprovements } from "./improvements";
import { DEFAULT_WEIGHTS, reweightTotal } from "./reweight";

const address: ResolvedAddress = {
  country: "NL",
  weergavenaam: "Test",
  straatnaam: "T",
  huisnummer: "1",
  postcode: "1234AB",
  woonplaatsnaam: "X",
  gemeentenaam: "X",
  nummeraanduidingId: "1",
  lat: 52,
  lon: 5,
};

describe("buildImprovements", () => {
  it("signaleert isolatie bij label G en monumentvergunning", () => {
    const facts: PropertyFacts = {
      address,
      energy: { labelklasse: "G" },
      monument: { isRijksmonument: true, aantalBinnen75m: 3, rijksmonumentNummer: 1 },
      sources: [],
    };
    const items = buildImprovements(facts);
    expect(items.some((i) => i.id === "isolatie")).toBe(true);
    expect(items.some((i) => i.id === "monument-vergunning")).toBe(true);
  });
});

describe("reweightTotal", () => {
  it("herweegt beschikbare pijlers", () => {
    const partials = [
      { key: "woning" as const, label: "Woning", score: 80, weight: 0.2, details: [] },
      { key: "veiligheid" as const, label: "V", score: 20, weight: 0.15, details: [] },
    ];
    const equal = reweightTotal(partials, { ...DEFAULT_WEIGHTS, woning: 0.5, veiligheid: 0.5 });
    expect(equal).toBe(50);
    const woningZwaar = reweightTotal(partials, {
      ...DEFAULT_WEIGHTS,
      woning: 0.9,
      veiligheid: 0.1,
    });
    expect(woningZwaar).toBeGreaterThan(equal!);
  });
});
