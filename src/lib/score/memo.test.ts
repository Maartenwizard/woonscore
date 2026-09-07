import { describe, expect, it } from "vitest";
import type { PropertyFacts, ResolvedAddress, ScoreResult } from "@/lib/types";
import { recommendDiensten } from "@/lib/diensten";
import { buildMemo } from "./memo";

const address: ResolvedAddress = {
  country: "NL",
  weergavenaam: "Teststraat 1, 1234AB Teststad",
  straatnaam: "Teststraat",
  huisnummer: "1",
  postcode: "1234AB",
  woonplaatsnaam: "Teststad",
  gemeentenaam: "Teststad",
  nummeraanduidingId: "0000000000000001",
  lat: 52,
  lon: 5,
};

function baseScore(): ScoreResult {
  return {
    profile: "consumer",
    total: 60,
    partials: [],
    positives: [{ text: "Rustige buurt", kind: "positive" }],
    negatives: [],
    disclaimer: "test",
  };
}

function riskyFacts(): PropertyFacts {
  return {
    address,
    bag: { bouwjaar: 1935, oppervlakte: 120 },
    energy: { labelklasse: "F" },
    environment: { geluidLden: 66 },
    climate: {
      overstromingsdiepteM: 0.6,
      funderingsrisico: "hoog",
      wateroverlastHoosbuiM: 0.25,
    },
    sources: [],
  };
}

function quietFacts(): PropertyFacts {
  return {
    address,
    bag: { bouwjaar: 2019, oppervlakte: 100 },
    energy: { labelklasse: "A" },
    environment: { geluidLden: 48 },
    climate: {
      overstromingsdiepteM: 0,
      wateroverlastHoosbuiM: 0,
      funderingsrisico: "laag",
    },
    woz: { actueleWaarde: 400000, historie: [], trendPctPerJaar: 4 },
    bekendmakingen: { count12m: 3, items: [] },
    sources: [],
  };
}

describe("buildMemo", () => {
  it("geeft rood oordeel met kernpunten en kosten bij zware signalen", () => {
    const memo = buildMemo(riskyFacts(), baseScore());
    expect(memo.oordeel).toBe("rood");
    expect(memo.kernpunten.length).toBeGreaterThanOrEqual(2);
    expect(memo.kosten.some((k) => k.post.includes("energie"))).toBe(true);
    expect(memo.kosten.some((k) => k.post.includes("Fundering"))).toBe(true);
    expect(memo.vragen.some((v) => v.toLowerCase().includes("fundering"))).toBe(true);
    expect(memo.documenten.some((d) => d.includes("Funderingsrapport"))).toBe(true);
    expect(memo.vragen.length).toBeLessThanOrEqual(8);
  });

  it("geeft groen oordeel bij nieuwbouw zonder signalen", () => {
    const memo = buildMemo(quietFacts(), baseScore());
    expect(memo.oordeel).toBe("groen");
    expect(memo.kosten.some((k) => k.post.includes("energie"))).toBe(false);
    expect(memo.vragen.length).toBeGreaterThanOrEqual(2);
    expect(memo.documenten.length).toBeGreaterThanOrEqual(3);
  });

  it("schaalt energiekosten met oppervlakte", () => {
    const klein = buildMemo(
      { ...riskyFacts(), bag: { bouwjaar: 1935, oppervlakte: 60 } },
      baseScore(),
    );
    const groot = buildMemo(
      { ...riskyFacts(), bag: { bouwjaar: 1935, oppervlakte: 200 } },
      baseScore(),
    );
    const eerste = (m: typeof klein) => Number(m.kosten[0].bandbreedte.match(/\d+/)?.[0]);
    expect(eerste(groot)).toBeGreaterThan(eerste(klein));
  });
});

describe("recommendDiensten", () => {
  it("adviseert fundering, keuring, EPA, geluid en water bij een risicopand", () => {
    const ids = recommendDiensten(riskyFacts()).map((d) => d.id);
    expect(ids).toContain("funderingsonderzoek");
    expect(ids).toContain("bouwkundige-keuring");
    expect(ids).toContain("epa-maatwerkadvies");
    expect(ids).toContain("geluidsmeting");
    expect(ids).toContain("vocht-wateradvies");
  });

  it("houdt het bij nieuwbouw bij alleen de bouwkundige keuring", () => {
    const diensten = recommendDiensten(quietFacts());
    expect(diensten.map((d) => d.id)).toEqual(["bouwkundige-keuring"]);
    expect(diensten[0].reden).toBeTruthy();
  });
});
