import type {
  DecisionMemo,
  MemoKostenpost,
  MemoOordeel,
  PropertyFacts,
  RiskItem,
  ScoreResult,
} from "@/lib/types";
import { buildRisks } from "./engine";

/**
 * Indicatieve extra energiekosten per jaar t.o.v. label B voor een woning
 * van ~100 m² (bandbreedte, afgeleid van openbare RVO/Milieu Centraal
 * kentallen). Geschaald op oppervlakte, begrensd op 0.6-1.6x.
 */
const ENERGIE_EXTRA_PER_LABEL: Record<string, [number, number]> = {
  G: [1300, 2100],
  F: [1050, 1750],
  E: [800, 1400],
  D: [550, 1000],
  C: [300, 650],
};

function euro(n: number): string {
  return `€${Math.round(n / 50) * 50}`;
}

function labelklasse(facts: PropertyFacts): string {
  return facts.energy?.labelklasse?.toUpperCase().replace(/\s|\+/g, "") ?? "";
}

function energieKosten(facts: PropertyFacts): MemoKostenpost | null {
  const label = labelklasse(facts);
  const range = ENERGIE_EXTRA_PER_LABEL[label];
  if (!range) return null;
  const factor = Math.min(1.6, Math.max(0.6, (facts.bag?.oppervlakte ?? 100) / 100));
  return {
    post: `Extra energiekosten (label ${facts.energy!.labelklasse})`,
    bandbreedte: `${euro(range[0] * factor)} – ${euro(range[1] * factor)} / jaar`,
    toelichting:
      "Indicatief t.o.v. label B, op basis van openbare kentallen en de oppervlakte. Werkelijk verbruik hangt af van bewoning en installaties.",
  };
}

function bouwkosten(facts: PropertyFacts): MemoKostenpost[] {
  const out: MemoKostenpost[] = [];
  const year = facts.bag?.bouwjaar;
  const fund = facts.climate?.funderingsrisico?.toLowerCase() ?? "";

  if ((year && year < 1975) || fund.includes("hoog") || fund.includes("middel")) {
    out.push({
      post: "Funderingsonderzoek",
      bandbreedte: "€500 – €1.500",
      toelichting:
        "Quickscan tot uitgebreid onderzoek. Funderingsherstel zelf loopt van €30.000 tot ruim €100.000 — dat wil je vóór het bod weten.",
    });
  }
  if (facts.monument?.isRijksmonument) {
    out.push({
      post: "Verbouwen als rijksmonument",
      bandbreedte: "+20% – +40% op bouwkosten",
      toelichting:
        "Vergunningplicht en eisen aan materialen maken onderhoud en verbouwing structureel duurder dan bij een vergelijkbare woning.",
    });
  }
  const geluid = facts.environment?.geluidLden;
  if (geluid != null && geluid >= 60) {
    out.push({
      post: "Geluidwerend glas (gevel geluidzijde)",
      bandbreedte: "€3.000 – €10.000",
      toelichting: `Lden ca. ${Math.round(geluid)} dB. HR++/triple glas met kierdichting per gevel, afhankelijk van aantal ramen.`,
    });
  }
  return out;
}

function bepaalOordeel(risks: RiskItem[]): {
  oordeel: MemoOordeel;
  oordeelLabel: string;
} {
  const red = risks.filter((r) => r.level === "red").length;
  const amber = risks.filter((r) => r.level === "amber").length;

  if (red >= 2) {
    return {
      oordeel: "rood",
      oordeelLabel: "Meerdere zware signalen — onderzoek vóór ieder bod",
    };
  }
  if (red === 1 || amber >= 3) {
    return {
      oordeel: "oranje",
      oordeelLabel: "Nader onderzoek aanbevolen op de punten hieronder",
    };
  }
  return {
    oordeel: "groen",
    oordeelLabel: "Geen grote signalen in de openbare data",
  };
}

function kernpunten(
  facts: PropertyFacts,
  score: ScoreResult,
  risks: RiskItem[],
): string[] {
  const out: string[] = [];

  for (const r of risks) {
    if (r.level === "red") out.push(`${r.label}: ${r.detail}`);
  }
  for (const r of risks) {
    if (out.length >= 3) break;
    if (r.level === "amber") out.push(`${r.label}: ${r.detail}`);
  }
  if (out.length < 3 && score.positives[0]) out.push(score.positives[0].text);
  if (out.length < 2 && score.positives[1]) out.push(score.positives[1].text);
  if (!out.length && facts.bag?.bouwjaar) {
    out.push(`Bouwjaar ${facts.bag.bouwjaar}, geen opvallende risico's in de bronnen`);
  }
  return out.slice(0, 4);
}

function vragen(facts: PropertyFacts): string[] {
  const out: string[] = [];
  const label = labelklasse(facts);
  const year = facts.bag?.bouwjaar;
  const geluid = facts.environment?.geluidLden;
  const flood = facts.climate?.overstromingsdiepteM ?? 0;
  const hoos = facts.climate?.wateroverlastHoosbuiM ?? 0;
  const fund = facts.climate?.funderingsrisico?.toLowerCase() ?? "";

  if (["E", "F", "G"].includes(label)) {
    out.push(
      "Welke isolatiemaatregelen zijn al genomen en is er een maatwerkadvies of offerte voor verduurzaming?",
    );
  } else if (["C", "D"].includes(label)) {
    out.push("Wanneer is het energielabel geregistreerd en wat is er sindsdien verbeterd?");
  }
  if (year && year < 1975) {
    out.push(
      "Is de fundering ooit geïnspecteerd of hersteld? Vraag naar rapporten, scheuren en klemmende deuren.",
    );
  }
  if (fund.includes("hoog") || fund.includes("middel")) {
    out.push("Zijn er in de straat funderingsproblemen of herstelde panden bekend?");
  }
  if (geluid != null && geluid >= 60) {
    out.push("Zit er geluidwerend glas in en aan welke zijde liggen de slaapkamers?");
  }
  if (flood > 0 || hoos > 0.1) {
    out.push(
      "Is er ooit water in kruipruimte, kelder of tuin gestaan? Vraag naar terugslagkleppen en drempels.",
    );
  }
  if (facts.monument?.isRijksmonument || facts.surroundings?.beschermdGezicht) {
    out.push("Welke vergunningen zijn er voor eerdere verbouwingen afgegeven?");
  }
  if ((facts.bekendmakingen?.count12m ?? 0) > 15) {
    out.push(
      "Er zijn veel vergunningaanvragen in de buurt — weet u of er bouwplannen naast of achter het pand spelen?",
    );
  }
  if (facts.woz?.trendPctPerJaar != null && facts.woz.trendPctPerJaar < 0) {
    out.push("De WOZ-waarde daalt hier — is er bezwaar gemaakt of speelt er iets met het pand?");
  }

  out.push("Wat is de reden van verkoop en hoe lang staat de woning te koop?");
  out.push("Zijn er gebreken die de verkoper moet melden (mededelingsplicht)?");
  return out.slice(0, 8);
}

function documenten(facts: PropertyFacts): string[] {
  const out: string[] = [
    "Lijst van zaken en vragenlijst deel B van de verkoper",
    "Eigendomsinformatie en erfdienstbaarheden (Kadaster)",
    "WOZ-beschikking en aanslag gemeentelijke belastingen",
  ];
  if (facts.energy?.labelklasse) {
    out.push("Afschrift energielabel met opnamedetails (EP-Online)");
  }
  if (facts.bag?.bouwjaar && facts.bag.bouwjaar < 1975) {
    out.push("Funderingsrapport of sonderingsgegevens, indien aanwezig");
  }
  if (facts.monument?.isRijksmonument) {
    out.push("Monumentenvergunningen en subsidiebeschikkingen van eerdere renovaties");
  }
  if ((facts.bekendmakingen?.count12m ?? 0) > 0) {
    out.push("Lopende vergunningaanvragen rond het adres (officielebekendmakingen.nl)");
  }
  return out.slice(0, 6);
}

/** Deterministisch memo; geen LLM nodig. */
export function buildMemo(facts: PropertyFacts, score: ScoreResult): DecisionMemo {
  const risks = score.risks ?? buildRisks(facts);
  const { oordeel, oordeelLabel } = bepaalOordeel(risks);
  const kosten: MemoKostenpost[] = [];
  const energie = energieKosten(facts);
  if (energie) kosten.push(energie);
  kosten.push(...bouwkosten(facts));

  return {
    oordeel,
    oordeelLabel,
    kernpunten: kernpunten(facts, score, risks),
    vragen: vragen(facts),
    documenten: documenten(facts),
    kosten,
  };
}
