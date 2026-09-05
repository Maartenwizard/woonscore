import { describe, expect, it } from "vitest";
import type { PropertyFacts, ResolvedAddress } from "@/lib/types";
import { applyAnchors, type CalibrationData } from "./calibration";
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
    const result = computeScore(richFacts(), "consumer", null);
    expect(result.total).not.toBeNull();
    expect(result.total!).toBeGreaterThanOrEqual(70);
    expect(result.total!).toBeLessThanOrEqual(100);
    expect(result.partials).toHaveLength(7);
    for (const p of result.partials) {
      expect(p.score).not.toBeNull();
    }
  });

  it("geeft null totaal zonder enige data", () => {
    const result = computeScore({ address, sources: [] }, "consumer", null);
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
    const result = computeScore(facts, "consumer", null);
    const veiligheid = result.partials.find((p) => p.key === "veiligheid");
    expect(veiligheid?.score).not.toBeNull();
    expect(result.total).toBe(veiligheid?.score);
  });

  it("bevat risico's alleen bij commercial profiel", () => {
    const facts = richFacts();
    expect(computeScore(facts, "consumer", null).risks).toBeUndefined();
    const commercial = computeScore(facts, "commercial", null);
    expect(commercial.risks?.length).toBeGreaterThanOrEqual(7);
    const energie = commercial.risks!.find((r) => r.id === "energie");
    expect(energie?.level).toBe("green");
  });

  it("markeert slecht energielabel en hoge criminaliteit als negatief", () => {
    const facts = richFacts();
    facts.energy = { labelklasse: "G" };
    facts.crime = { misdrijvenPer1000: 200, landelijkGemiddeldePer1000: 45, pctVsLandelijk: 340 };
    const result = computeScore(facts, "commercial", null);
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
    const result = computeScore(facts, "consumer", null);
    const waarde = result.partials.find((p) => p.key === "waarde");
    expect(waarde?.score).toBe(55);
    expect(waarde?.details.join(" ")).toContain("fallback");
  });

  it("weegt klimaat en buurt zwaarder in het zakelijke profiel", () => {
    const consumer = computeScore(richFacts(), "consumer", null);
    const commercial = computeScore(richFacts(), "commercial", null);
    const w = (r: typeof consumer, key: string) =>
      r.partials.find((p) => p.key === key)!.weight;
    expect(w(commercial, "klimaat")).toBeGreaterThan(w(consumer, "klimaat"));
    expect(w(commercial, "buurt")).toBeGreaterThan(w(consumer, "buurt"));
    expect(w(commercial, "voorzieningen")).toBeLessThan(w(consumer, "voorzieningen"));
    for (const r of [consumer, commercial]) {
      const sum = r.partials.reduce((s, p) => s + p.weight, 0);
      expect(sum).toBeCloseTo(1, 5);
    }
  });

  it("past kalibratie-anchors toe op pijlerscores", () => {
    const calibration: CalibrationData = {
      generatedAt: "test",
      pillars: {
        veiligheid: { p10: 20, p50: 35, p90: 70 },
      },
    };
    const facts = richFacts();
    const raw = computeScore(facts, "consumer", null);
    const calibrated = computeScore(facts, "consumer", calibration);
    const rawVeiligheid = raw.partials.find((p) => p.key === "veiligheid")!;
    const calVeiligheid = calibrated.partials.find((p) => p.key === "veiligheid")!;
    expect(calVeiligheid.raw).toBe(rawVeiligheid.score);
    // gekalibreerde score volgt de anchor-mapping exact
    expect(calVeiligheid.score).toBe(
      applyAnchors(rawVeiligheid.score!, calibration.pillars.veiligheid!),
    );
    // raw ligt boven p50=35 → gekalibreerd boven 55
    expect(calVeiligheid.score!).toBeGreaterThan(55);
    // pijlers zonder anchors blijven ongewijzigd
    const calWoning = calibrated.partials.find((p) => p.key === "woning")!;
    expect(calWoning.score).toBe(raw.partials.find((p) => p.key === "woning")!.score);
    expect(calWoning.raw).toBeUndefined();
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
    const result = computeScore(facts, "consumer", null);
    expect(result.total).not.toBeNull();
    expect(result.total!).toBeLessThan(50);
    expect(result.total!).toBeGreaterThanOrEqual(0);
  });
});

describe("applyAnchors", () => {
  const anchors = { p10: 20, p50: 40, p90: 60 };

  it("mapt percentielen naar doelscores", () => {
    expect(applyAnchors(20, anchors)).toBe(30);
    expect(applyAnchors(40, anchors)).toBe(55);
    expect(applyAnchors(60, anchors)).toBe(80);
    expect(applyAnchors(30, anchors)).toBe(43); // midden p10-p50 → midden 30-55
  });

  it("extrapoleert begrensd buiten de anchors", () => {
    expect(applyAnchors(0, anchors)).toBe(5);
    expect(applyAnchors(100, anchors)).toBe(100); // geclampt
  });

  it("laat scores ongemoeid bij ongeldige spreiding", () => {
    expect(applyAnchors(47, { p10: 50, p50: 50, p90: 50 })).toBe(47);
  });
});
