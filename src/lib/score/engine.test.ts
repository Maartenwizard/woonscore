import { describe, expect, it } from "vitest";
import type { PropertyFacts, ResolvedAddress } from "@/lib/types";
import { computeScore } from "./engine";

const address: ResolvedAddress = {
  country: "NL",
  weergavenaam: "Teststraat 1, 1234AB Teststad",
  straatnaam: "Teststraat",
  huisnummer: "1",
  postcode: "1234AB",
  woonplaatsnaam: "Teststad",
  gemeentenaam: "Teststad",
  nummeraanduidingId: "0000000000000001",
  lat: 52.0,
  lon: 5.0,
};

function richFacts(): PropertyFacts {
  return {
    address,
    bag: { bouwjaar: 2015, oppervlakte: 110, gebruiksdoel: ["woonfunctie"] },
    energy: { labelklasse: "A" },
    woz: {
      actueleWaarde: 450000,
      peildatum: "2025-01-01",
      historie: [
        { peildatum: "2021-01-01", waarde: 350000 },
        { peildatum: "2025-01-01", waarde: 450000 },
      ],
      trendPctPerJaar: 6.4,
    },
    cbs: {
      inwoners: 5000,
      gemiddeldeWoz: 400000,
      afstandSupermarktKm: 0.4,
      afstandHuisartsKm: 0.8,
      afstandStationKm: 1.5,
    },
    crime: {
      misdrijvenPer1000: 30,
      landelijkGemiddeldePer1000: 45,
      pctVsLandelijk: -33,
      peiljaar: "2025",
    },
    bekendmakingen: { count12m: 3, items: [] },
    environment: { no2: 18, pm25: 9, geluidLden: 52 },
    climate: {
      overstromingsdiepteM: 0,
      funderingsrisico: "laag (2% panden met paalrot-risico in buurt)",
      bodemdalingMmJaar: 0.5,
    },
    schools: { binnen1km: 4, scholen: [] },
    sources: [],
  };
}

describe("computeScore", () => {
  it("geeft een hoge totaalscore voor gunstige feiten", () => {
    const result = computeScore(richFacts(), "consumer");
    expect(result.total).not.toBeNull();
    expect(result.total!).toBeGreaterThanOrEqual(70);
    expect(result.total!).toBeLessThanOrEqual(100);
    expect(result.partials).toHaveLength(7);
    for (const p of result.partials) {
      expect(p.score).not.toBeNull();
    }
  });

  it("geeft null totaal zonder enige data", () => {
    const result = computeScore({ address, sources: [] }, "consumer");
    expect(result.total).toBeNull();
    for (const p of result.partials) {
      expect(p.score).toBeNull();
    }
  });

  it("hernormaliseert gewichten over beschikbare pijlers", () => {
    // Alleen veiligheid beschikbaar → totaal == veiligheidsscore
    const facts: PropertyFacts = {
      address,
      crime: { misdrijvenPer1000: 45, landelijkGemiddeldePer1000: 45 },
      sources: [],
    };
    const result = computeScore(facts, "consumer");
    const veiligheid = result.partials.find((p) => p.key === "veiligheid");
    expect(veiligheid?.score).not.toBeNull();
    expect(result.total).toBe(veiligheid?.score);
  });

  it("bevat risico's alleen bij commercial profiel", () => {
    const facts = richFacts();
    expect(computeScore(facts, "consumer").risks).toBeUndefined();
    const commercial = computeScore(facts, "commercial");
    expect(commercial.risks?.length).toBeGreaterThanOrEqual(7);
    const energie = commercial.risks!.find((r) => r.id === "energie");
    expect(energie?.level).toBe("green");
  });

  it("markeert slecht energielabel en hoge criminaliteit als negatief", () => {
    const facts = richFacts();
    facts.energy = { labelklasse: "G" };
    facts.crime = { misdrijvenPer1000: 200, landelijkGemiddeldePer1000: 45, pctVsLandelijk: 340 };
    const result = computeScore(facts, "commercial");
    const texts = result.negatives.map((n) => n.text).join(" | ");
    expect(texts).toContain("Energielabel G");
    expect(texts).toContain("boven landelijk gemiddelde");
    const energie = result.risks!.find((r) => r.id === "energie");
    expect(energie?.level).toBe("red");
    const crim = result.risks!.find((r) => r.id === "criminaliteit");
    expect(crim?.level).toBe("red");
  });

  it("gebruikt CBS-buurtgemiddelde als WOZ-fallback", () => {
    const facts = richFacts();
    facts.woz = undefined;
    const result = computeScore(facts, "consumer");
    const waarde = result.partials.find((p) => p.key === "waarde");
    expect(waarde?.score).toBe(55);
    expect(waarde?.details.join(" ")).toContain("fallback");
  });

  it("scoort een score tussen 0 en 100 voor ongunstige feiten", () => {
    const facts: PropertyFacts = {
      address,
      bag: { bouwjaar: 1920, oppervlakte: 45 },
      energy: { labelklasse: "G" },
      crime: { misdrijvenPer1000: 250, landelijkGemiddeldePer1000: 45, pctVsLandelijk: 455 },
      environment: { no2: 38, pm25: 22, geluidLden: 72 },
      climate: {
        overstromingsdiepteM: 1.5,
        funderingsrisico: "hoog (35% panden met paalrot-risico in buurt)",
        bodemdalingMmJaar: 8,
      },
      bekendmakingen: { count12m: 60, items: [] },
      sources: [],
    };
    const result = computeScore(facts, "consumer");
    expect(result.total).not.toBeNull();
    expect(result.total!).toBeLessThan(50);
    expect(result.total!).toBeGreaterThanOrEqual(0);
  });
});
