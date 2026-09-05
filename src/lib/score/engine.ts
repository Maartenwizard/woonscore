import type {
  Bullet,
  PartialScore,
  PartialScoreKey,
  PropertyFacts,
  RiskItem,
  ScoreProfile,
  ScoreResult,
} from "@/lib/types";
import { applyAnchors, loadCalibration, type CalibrationData } from "./calibration";

export const DISCLAIMER =
  "Indicatief op basis van openbare data met peildatum per bron. Geen taxatie, bouwkundig advies of juridisch advies.";

const CONSUMER_WEIGHTS: Record<PartialScoreKey, number> = {
  woning: 0.2,
  waarde: 0.15,
  veiligheid: 0.15,
  milieu: 0.15,
  klimaat: 0.15,
  voorzieningen: 0.1,
  buurt: 0.1,
};

/**
 * Zakelijk profiel: zwaarder op waardeontwikkeling, klimaat-/funderingsrisico
 * en buurtdynamiek (vergunningen); lichter op voorzieningen en dagelijkse
 * leefkwaliteit.
 */
const COMMERCIAL_WEIGHTS: Record<PartialScoreKey, number> = {
  woning: 0.15,
  waarde: 0.2,
  veiligheid: 0.1,
  milieu: 0.1,
  klimaat: 0.2,
  voorzieningen: 0.05,
  buurt: 0.2,
};

const WEIGHTS: Record<ScoreProfile, Record<PartialScoreKey, number>> = {
  consumer: CONSUMER_WEIGHTS,
  commercial: COMMERCIAL_WEIGHTS,
};

const LABELS: Record<PartialScoreKey, string> = {
  woning: "Woning",
  waarde: "Waardeontwikkeling",
  veiligheid: "Veiligheid",
  milieu: "Milieu & geluid",
  klimaat: "Klimaatrisico",
  voorzieningen: "Voorzieningen",
  buurt: "Buurtdynamiek",
};

function clamp(n: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(n)));
}

function scoreWoning(facts: PropertyFacts): PartialScore {
  const details: string[] = [];
  const parts: number[] = [];

  if (facts.bag?.bouwjaar) {
    const age = new Date().getFullYear() - facts.bag.bouwjaar;
    // Older can still score decently (monumentaal); nieuwbouw scoort hoger
    const s = clamp(92 - Math.sqrt(Math.max(age, 0)) * 3.2, 35, 95);
    parts.push(s);
    details.push(`Bouwjaar ${facts.bag.bouwjaar}`);
  }
  if (facts.bag?.oppervlakte) {
    const opp = facts.bag.oppervlakte;
    // Typical home 60-150 m²; huge utiliteit shouldn't dominate
    const residential = opp <= 400;
    const s = residential
      ? clamp(35 + Math.min(opp, 180) * 0.35, 40, 95)
      : 55;
    parts.push(s);
    details.push(`${opp} m²`);
  }
  if (facts.energy?.labelklasse) {
    const map: Record<string, number> = {
      "A++++": 100,
      "A+++": 98,
      "A++": 96,
      "A+": 94,
      A: 90,
      B: 78,
      C: 62,
      D: 48,
      E: 34,
      F: 22,
      G: 12,
    };
    const key = facts.energy.labelklasse.toUpperCase().replace(/\s/g, "");
    const s = map[key] ?? 50;
    parts.push(s * 1.15); // energielabel weegt zwaarder binnen woning
    details.push(`Energielabel ${facts.energy.labelklasse}`);
  }
  if (facts.bag?.gebruiksdoel?.some((g) => g.includes("woon"))) {
    parts.push(70);
  }

  return {
    key: "woning",
    label: LABELS.woning,
    score: parts.length ? clamp(avg(parts)) : null,
    weight: CONSUMER_WEIGHTS.woning,
    details,
  };
}

function scoreWaarde(facts: PropertyFacts): PartialScore {
  const details: string[] = [];
  let score: number | null = null;
  const trend = facts.woz?.trendPctPerJaar;
  if (facts.woz?.actueleWaarde) {
    details.push(`WOZ €${facts.woz.actueleWaarde.toLocaleString("nl-NL")}`);
  } else if (facts.cbs?.gemiddeldeWoz) {
    details.push(
      `Gem. WOZ buurt €${facts.cbs.gemiddeldeWoz.toLocaleString("nl-NL")} (fallback: CBS-buurtgemiddelde, geen WOZ-data voor dit object)`,
    );
    // Buurtgemiddelde alleen: neutrale score zonder trend
    score = 55;
  }
  if (trend != null) {
    // 0%/yr → 50, +8% → ~90, -5% → ~25
    score = clamp(50 + trend * 5);
    details.push(`Trend ca. ${trend}% per jaar`);
  }
  return {
    key: "waarde",
    label: LABELS.waarde,
    score,
    weight: CONSUMER_WEIGHTS.waarde,
    details,
  };
}

function scoreVeiligheid(facts: PropertyFacts): PartialScore {
  const details: string[] = [];
  let score: number | null = null;
  const c = facts.crime;
  if (c?.misdrijvenPer1000 != null) {
    const land = c.landelijkGemiddeldePer1000 ?? 45;
    // Soft curve: landelijk → ~62; half → ~78; 2x → ~45; 4x → ~32; floor 20
    const ratio = c.misdrijvenPer1000 / land;
    score = clamp(100 - Math.log2(1 + ratio) * 28, 20, 95);
    details.push(`${c.misdrijvenPer1000} misdrijven/1.000 inwoners (${c.peiljaar ?? ""})`);
    if (c.pctVsLandelijk != null) {
      details.push(
        c.pctVsLandelijk <= 0
          ? `${Math.abs(c.pctVsLandelijk)}% onder landelijk gemiddelde`
          : `${c.pctVsLandelijk}% boven landelijk gemiddelde`,
      );
    }
  } else if (c?.misdrijvenTotaal != null) {
    details.push(`${c.misdrijvenTotaal} geregistreerde misdrijven (buurt)`);
    score = 55;
  }
  return {
    key: "veiligheid",
    label: LABELS.veiligheid,
    score,
    weight: CONSUMER_WEIGHTS.veiligheid,
    benchmark: 50,
    details,
  };
}

function scoreMilieu(facts: PropertyFacts): PartialScore {
  const details: string[] = [];
  const parts: number[] = [];
  const e = facts.environment;
  if (e?.no2 != null) {
    // EU limit ~40 µg/m3
    parts.push(clamp(100 - (e.no2 / 40) * 70));
    details.push(`NO₂ ${Math.round(e.no2)} µg/m³`);
  }
  if (e?.pm25 != null) {
    parts.push(clamp(100 - (e.pm25 / 25) * 70));
    details.push(`PM2.5 ${Math.round(e.pm25 * 10) / 10} µg/m³`);
  }
  if (e?.geluidLden != null) {
    // 50 dB good, 70+ bad
    parts.push(clamp(100 - (e.geluidLden - 45) * 4));
    details.push(`Geluid Lden ${Math.round(e.geluidLden)} dB`);
  }
  return {
    key: "milieu",
    label: LABELS.milieu,
    score: parts.length ? clamp(avg(parts)) : null,
    weight: CONSUMER_WEIGHTS.milieu,
    details,
  };
}

function scoreKlimaat(facts: PropertyFacts): PartialScore {
  const details: string[] = [];
  const parts: number[] = [];
  const c = facts.climate;
  if (c?.overstromingsdiepteM != null) {
    const d = c.overstromingsdiepteM;
    parts.push(d <= 0 ? 95 : clamp(90 - d * 25));
    details.push(
      d <= 0
        ? "Geen overstromingsdiepte bekend"
        : `Overstromingsdiepte ca. ${d} m`,
    );
  }
  if (c?.funderingsrisico) {
    const t = c.funderingsrisico.toLowerCase();
    const s = t.includes("hoog") || t.includes("high")
      ? 25
      : t.includes("middel") || t.includes("medium")
        ? 55
        : t.includes("laag") || t.includes("low")
          ? 85
          : 60;
    parts.push(s);
    details.push(`Funderingsrisico: ${c.funderingsrisico}`);
  }
  if (c?.bodemdalingMmJaar != null) {
    parts.push(clamp(90 - Math.abs(c.bodemdalingMmJaar) * 8));
    details.push(`Bodemdaling ca. ${c.bodemdalingMmJaar} mm/jaar`);
  }
  return {
    key: "klimaat",
    label: LABELS.klimaat,
    score: parts.length ? clamp(avg(parts)) : null,
    weight: CONSUMER_WEIGHTS.klimaat,
    details,
  };
}

function scoreVoorzieningen(facts: PropertyFacts): PartialScore {
  const details: string[] = [];
  const parts: number[] = [];
  if (facts.schools) {
    const n = facts.schools.binnen1km;
    // Met de volledige DUO-set zijn 3+ scholen binnen 1 km normaal; vlakkere curve
    parts.push(clamp(30 + Math.min(n, 12) * 5, 30, 90));
    details.push(`${n} scholen binnen 1 km`);
  }
  const cbs = facts.cbs;
  if (cbs?.afstandSupermarktKm != null) {
    parts.push(clamp(100 - cbs.afstandSupermarktKm * 25));
    details.push(`Supermarkt op ${cbs.afstandSupermarktKm} km`);
  }
  if (cbs?.afstandHuisartsKm != null) {
    parts.push(clamp(100 - cbs.afstandHuisartsKm * 20));
    details.push(`Huisarts op ${cbs.afstandHuisartsKm} km`);
  }
  if (cbs?.afstandStationKm != null) {
    parts.push(clamp(95 - cbs.afstandStationKm * 8));
    details.push(`Station op ${cbs.afstandStationKm} km`);
  }
  return {
    key: "voorzieningen",
    label: LABELS.voorzieningen,
    score: parts.length ? clamp(avg(parts)) : null,
    weight: CONSUMER_WEIGHTS.voorzieningen,
    details,
  };
}

function scoreBuurt(facts: PropertyFacts): PartialScore {
  const details: string[] = [];
  let score: number | null = null;
  const count = facts.bekendmakingen?.count12m;
  if (count != null) {
    // Some activity is fine; very high may mean construction noise
    score = count <= 5 ? 80 : count <= 20 ? 65 : count <= 50 ? 50 : 35;
    details.push(`${count} bekendmakingen/vergunningen (12 mnd, buurt/postcode)`);
  }
  if (facts.cbs?.gemiddeldInkomen) {
    details.push(
      `Gem. inkomen buurt €${Math.round(facts.cbs.gemiddeldInkomen).toLocaleString("nl-NL")}`,
    );
    if (score == null) score = 60;
  }
  return {
    key: "buurt",
    label: LABELS.buurt,
    score,
    weight: CONSUMER_WEIGHTS.buurt,
    details,
  };
}

function avg(nums: number[]) {
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function weightedTotal(partials: PartialScore[]): number | null {
  const available = partials.filter((p) => p.score != null);
  if (!available.length) return null;
  const weightSum = available.reduce((s, p) => s + p.weight, 0);
  const total = available.reduce((s, p) => s + (p.score as number) * (p.weight / weightSum), 0);
  return clamp(total);
}

function bullets(facts: PropertyFacts, partials: PartialScore[]): {
  positives: Bullet[];
  negatives: Bullet[];
} {
  const positives: Bullet[] = [];
  const negatives: Bullet[] = [];

  if (facts.energy?.labelklasse) {
    const L = facts.energy.labelklasse.toUpperCase();
    if (L.startsWith("A") || L === "B") {
      positives.push({ kind: "positive", text: `Energielabel ${facts.energy.labelklasse}` });
    } else if (["E", "F", "G"].includes(L)) {
      negatives.push({ kind: "negative", text: `Energielabel ${facts.energy.labelklasse}` });
    }
  }

  const fund = facts.climate?.funderingsrisico?.toLowerCase() ?? "";
  if (fund.includes("laag") || fund.includes("low") || fund.includes("geen")) {
    positives.push({ kind: "positive", text: "Geen of laag funderingsrisico bekend" });
  } else if (fund.includes("hoog") || fund.includes("high")) {
    negatives.push({ kind: "negative", text: `Funderingsrisico: ${facts.climate?.funderingsrisico}` });
  }

  if (facts.environment?.geluidLden != null) {
    if (facts.environment.geluidLden < 55) {
      positives.push({ kind: "positive", text: "Weinig geluidsoverlast (Lden)" });
    } else if (facts.environment.geluidLden >= 65) {
      negatives.push({
        kind: "negative",
        text: `Hoge geluidsbelasting (${Math.round(facts.environment.geluidLden)} dB Lden)`,
      });
    }
  }

  if (facts.schools && facts.schools.binnen1km >= 3) {
    positives.push({
      kind: "positive",
      text: `${facts.schools.binnen1km} scholen binnen 1 km`,
    });
  } else if (facts.schools && facts.schools.binnen1km === 0) {
    negatives.push({ kind: "negative", text: "Geen scholen binnen 1 km" });
  }

  if (facts.woz?.trendPctPerJaar != null && facts.woz.trendPctPerJaar >= 4) {
    positives.push({
      kind: "positive",
      text: `WOZ stijgt ca. ${facts.woz.trendPctPerJaar}% per jaar`,
    });
  } else if (facts.woz?.trendPctPerJaar != null && facts.woz.trendPctPerJaar < 0) {
    negatives.push({
      kind: "negative",
      text: `WOZ daalt ca. ${Math.abs(facts.woz.trendPctPerJaar)}% per jaar`,
    });
  }

  if (facts.crime?.pctVsLandelijk != null) {
    if (facts.crime.pctVsLandelijk <= -20) {
      positives.push({
        kind: "positive",
        text: `Criminaliteit ${Math.abs(facts.crime.pctVsLandelijk)}% onder landelijk gemiddelde`,
      });
    } else if (facts.crime.pctVsLandelijk >= 30) {
      negatives.push({
        kind: "negative",
        text: `Criminaliteit ${facts.crime.pctVsLandelijk}% boven landelijk gemiddelde`,
      });
    }
  }

  if (facts.climate?.bodemdalingMmJaar != null && Math.abs(facts.climate.bodemdalingMmJaar) >= 5) {
    negatives.push({
      kind: "negative",
      text: `Bodemdaling in dit gebied (~${facts.climate.bodemdalingMmJaar} mm/jaar)`,
    });
  }

  if (facts.bekendmakingen && facts.bekendmakingen.count12m >= 15) {
    negatives.push({
      kind: "negative",
      text: `${facts.bekendmakingen.count12m} vergunningen/bekendmakingen rondom dit adres (12 mnd)`,
    });
  }

  // Fill from partial details if sparse
  for (const p of partials) {
    if (p.score != null && p.score >= 80 && positives.length < 5 && p.details[0]) {
      positives.push({ kind: "positive", text: p.details[0] });
    }
    if (p.score != null && p.score <= 35 && negatives.length < 5 && p.details[0]) {
      negatives.push({ kind: "negative", text: p.details[0] });
    }
  }

  return {
    positives: uniqBullets(positives).slice(0, 6),
    negatives: uniqBullets(negatives).slice(0, 6),
  };
}

function uniqBullets(items: Bullet[]): Bullet[] {
  const seen = new Set<string>();
  return items.filter((b) => {
    if (seen.has(b.text)) return false;
    seen.add(b.text);
    return true;
  });
}

function buildRisks(facts: PropertyFacts): RiskItem[] {
  const risks: RiskItem[] = [];

  const flood = facts.climate?.overstromingsdiepteM;
  risks.push({
    id: "overstroming",
    label: "Overstromingsrisico",
    level:
      flood == null
        ? "unknown"
        : flood <= 0
          ? "green"
          : flood < 0.5
            ? "amber"
            : "red",
    detail:
      flood == null
        ? "Geen data"
        : flood <= 0
          ? "Geen diepte bekend"
          : `Diepte ca. ${flood} m`,
    sourceId: "klimaat",
  });

  const fund = facts.climate?.funderingsrisico?.toLowerCase() ?? "";
  risks.push({
    id: "fundering",
    label: "Fundering / bodemdaling",
    level: !facts.climate
      ? "unknown"
      : fund.includes("hoog")
        ? "red"
        : fund.includes("middel")
          ? "amber"
          : "green",
    detail: facts.climate?.funderingsrisico
      ? String(facts.climate.funderingsrisico)
      : facts.climate?.bodemdalingMmJaar != null
        ? `Bodemdaling ${facts.climate.bodemdalingMmJaar} mm/j`
        : "Geen data",
    sourceId: "klimaat",
  });

  const geluid = facts.environment?.geluidLden;
  risks.push({
    id: "geluid",
    label: "Geluid / lucht",
    level:
      geluid == null && facts.environment?.no2 == null
        ? "unknown"
        : (geluid ?? 0) >= 65 || (facts.environment?.no2 ?? 0) > 40
          ? "red"
          : (geluid ?? 0) >= 55
            ? "amber"
            : "green",
    detail:
      geluid != null
        ? `Lden ${Math.round(geluid)} dB`
        : facts.environment?.no2 != null
          ? `NO₂ ${Math.round(facts.environment.no2)}`
          : "Geen data",
    sourceId: "rivm",
  });

  const bek = facts.bekendmakingen?.count12m;
  risks.push({
    id: "vergunningen",
    label: "Vergunningen in de buurt",
    level: bek == null ? "unknown" : bek > 30 ? "amber" : "green",
    detail: bek == null ? "Geen data" : `${bek} in 12 maanden`,
    sourceId: "bekendmakingen",
  });

  const label = facts.energy?.labelklasse?.toUpperCase();
  risks.push({
    id: "energie",
    label: "Energielabel",
    level: !label
      ? "unknown"
      : label.startsWith("A") || label === "B"
        ? "green"
        : ["C", "D"].includes(label)
          ? "amber"
          : "red",
    detail: label ?? "Onbekend",
    sourceId: "energy",
  });

  const trend = facts.woz?.trendPctPerJaar;
  risks.push({
    id: "woz",
    label: "WOZ-trend",
    level: trend == null ? "unknown" : trend >= 2 ? "green" : trend >= 0 ? "amber" : "red",
    detail:
      trend == null
        ? "Geen data"
        : `${trend}% / jaar (WOZ €${facts.woz?.actueleWaarde?.toLocaleString("nl-NL") ?? "—"})`,
    sourceId: "woz",
  });

  const crime = facts.crime?.pctVsLandelijk;
  risks.push({
    id: "criminaliteit",
    label: "Criminaliteit buurt",
    level:
      crime == null ? "unknown" : crime <= 0 ? "green" : crime < 40 ? "amber" : "red",
    detail:
      crime == null
        ? "Geen data"
        : `${crime <= 0 ? Math.abs(crime) + "% onder" : crime + "% boven"} landelijk`,
    sourceId: "politie",
  });

  return risks;
}

export function computeScore(
  facts: PropertyFacts,
  profile: ScoreProfile,
  calibration: CalibrationData | null | undefined = undefined,
): ScoreResult {
  const partials: PartialScore[] = [
    scoreWoning(facts),
    scoreWaarde(facts),
    scoreVeiligheid(facts),
    scoreMilieu(facts),
    scoreKlimaat(facts),
    scoreVoorzieningen(facts),
    scoreBuurt(facts),
  ];

  // Gewichten per profiel (pijlerfuncties rekenen profielonafhankelijk)
  for (const p of partials) {
    p.weight = WEIGHTS[profile][p.key];
  }

  // Kalibratie: map ruwe pijlerscores door landelijke percentiel-anchors
  const cal = calibration === undefined ? loadCalibration() : calibration;
  if (cal?.pillars) {
    for (const p of partials) {
      const anchors = cal.pillars[p.key];
      if (p.score != null && anchors) {
        p.raw = p.score;
        p.score = applyAnchors(p.score, anchors);
      }
    }
  }

  const { positives, negatives } = bullets(facts, partials);
  const total = weightedTotal(partials);

  return {
    profile,
    total,
    partials,
    positives,
    negatives,
    risks: profile === "commercial" ? buildRisks(facts) : undefined,
    disclaimer: DISCLAIMER,
  };
}
