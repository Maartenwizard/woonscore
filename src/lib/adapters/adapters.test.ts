import { describe, expect, it } from "vitest";
import { mapCbsRow } from "./cbs";
import { parseBodemdaling, parseHitte, parseHoosbui, parsePaalrot, parseWaterdiepte } from "./klimaat";
import { computeTrend } from "./woz";

describe("woz computeTrend", () => {
  it("berekent trend per jaar", () => {
    const trend = computeTrend([
      { peildatum: "2020-01-01", waarde: 300000 },
      { peildatum: "2024-01-01", waarde: 360000 },
    ]);
    // +20% over 4 jaar ≈ 5%/jaar
    expect(trend).toBe(5);
  });

  it("geeft undefined bij te weinig of te korte historie", () => {
    expect(computeTrend([{ peildatum: "2024-01-01", waarde: 100 }])).toBeUndefined();
    expect(
      computeTrend([
        { peildatum: "2024-01-01", waarde: 100 },
        { peildatum: "2024-03-01", waarde: 110 },
      ]),
    ).toBeUndefined();
  });
});

describe("cbs mapCbsRow", () => {
  it("mapt StatLine-velden en schaalt WOZ naar euro's", () => {
    const facts = mapCbsRow({
      AantalInwoners_5: 8210,
      HuishoudensTotaal_28: 4400,
      GemiddeldeWOZWaardeVanWoningen_39: 512,
      AfstandTotGroteSupermarkt_105: 0.4,
      AfstandTotHuisartsenpraktijk_98: 0.6,
      AfstandTotTreinstationsTotaal_111: 1.2,
    });
    expect(facts.inwoners).toBe(8210);
    expect(facts.gemiddeldeWoz).toBe(512000);
    expect(facts.afstandSupermarktKm).toBe(0.4);
    expect(facts.afstandStationKm).toBe(1.2);
  });

  it("leest nieuwe nabijheidsvelden (kinderopvang)", () => {
    const facts = mapCbsRow({
      AfstandTotGroteSupermarkt_111: 0.3,
      AfstandTotHuisartsenpraktijk_110: 0.5,
      AfstandTotKinderdagverblijf_112: 0.2,
      AfstandTotSchool_113: 0.4,
      GemiddeldInkomenPerInwoner_78: 32000,
    });
    expect(facts.afstandKinderopvangKm).toBe(0.2);
    expect(facts.afstandBasisschoolKm).toBe(0.4);
    expect(facts.gemiddeldInkomen).toBe(32000);
  });

  it("laat ontbrekende velden undefined", () => {
    const facts = mapCbsRow({ GemiddeldeWOZWaardeVanWoningen_39: "." });
    expect(facts.gemiddeldeWoz).toBeUndefined();
    expect(facts.inwoners).toBeUndefined();
  });
});

describe("klimaat parsers", () => {
  it("behandelt -9999 sentinel als geen overstroming", () => {
    expect(parseWaterdiepte({ GRAY_INDEX: -9999 })).toBe(0);
    expect(parseWaterdiepte({ GRAY_INDEX: 1.234 })).toBe(1.23);
    expect(parseWaterdiepte(null)).toBeNull();
    expect(parseWaterdiepte({})).toBeNull();
  });

  it("categoriseert paalrot-percentage", () => {
    expect(parsePaalrot({ no_cc_risi: 2.1 })).toContain("laag");
    expect(parsePaalrot({ no_cc_risi: 8.3 })).toContain("middel");
    expect(parsePaalrot({ no_cc_risi: 35 })).toContain("hoog");
    expect(parsePaalrot({ no_cc_risi: -1 })).toBeNull();
    expect(parsePaalrot(null)).toBeNull();
  });

  it("negeert hoosbui-nodata (255) en leest hitte-eiland", () => {
    expect(parseHoosbui({ GRAY_INDEX: 255 })).toBeNull();
    expect(parseHoosbui({ GRAY_INDEX: 0.2 })).toBe(0.2);
    expect(parseHitte({ GRAY_INDEX: 2.45 })).toBe(2.5);
    expect(parseHitte({ GRAY_INDEX: 99 })).toBeNull();
  });

  it("gebruikt snelheid (mm/jaar) en valt terug op 2050-raster", () => {
    expect(parseBodemdaling({ snelheid: -0.285543 }, null)).toBe(0.29);
    // 0.03 m over 30 jaar = 1 mm/jaar
    expect(parseBodemdaling(null, { GRAY_INDEX: 0.03 })).toBe(1);
    expect(parseBodemdaling(null, { GRAY_INDEX: -9999 })).toBeNull();
    expect(parseBodemdaling(null, null)).toBeNull();
  });
});
