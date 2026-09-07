import type { PropertyFacts } from "@/lib/types";

/**
 * Betaalde vervolgdiensten: de scan is gratis, een echte check op locatie
 * niet. Prijzen zijn richtprijzen incl. btw; uitvoering via een partner.
 */
export interface Dienst {
  id: string;
  naam: string;
  prijsCent: number;
  omschrijving: string;
  /** Waarom deze check bij dit adres past (gezet door recommendDiensten) */
  reden?: string;
}

export const DIENSTEN: Record<string, Dienst> = {
  "bouwkundige-keuring": {
    id: "bouwkundige-keuring",
    naam: "Bouwkundige keuring",
    prijsCent: 34900,
    omschrijving:
      "Inspectie op locatie: dak, gevels, vocht, installaties en directe kosten. Rapport binnen 3 werkdagen.",
  },
  funderingsonderzoek: {
    id: "funderingsonderzoek",
    naam: "Funderingscheck",
    prijsCent: 56500,
    omschrijving:
      "Quickscan van fundering en casco door een specialist, inclusief inschatting of vervolgonderzoek nodig is.",
  },
  "epa-maatwerkadvies": {
    id: "epa-maatwerkadvies",
    naam: "EPA-maatwerkadvies",
    prijsCent: 39500,
    omschrijving:
      "Gecertificeerd energieadviseur maakt een stappenplan met kosten, besparing en subsidies per maatregel.",
  },
  geluidsmeting: {
    id: "geluidsmeting",
    naam: "Geluidsmeting binnen",
    prijsCent: 24900,
    omschrijving:
      "Meting van het werkelijke binnenniveau op de gevel- en slaapkamerzijde, met advies over beglazing en kieren.",
  },
  "vocht-wateradvies": {
    id: "vocht-wateradvies",
    naam: "Vocht- en waterscan",
    prijsCent: 19500,
    omschrijving:
      "Controle van kruipruimte, kelder en afwatering op vocht- en overstromingsgevoeligheid, met maatregelenlijst.",
  },
};

/** Welke checks passen bij dit adres, met reden. Bouwkundige keuring altijd. */
export function recommendDiensten(facts: PropertyFacts): Dienst[] {
  const out: Dienst[] = [];
  const label = facts.energy?.labelklasse?.toUpperCase().replace(/\s|\+/g, "") ?? "";
  const year = facts.bag?.bouwjaar;
  const fund = facts.climate?.funderingsrisico?.toLowerCase() ?? "";
  const geluid = facts.environment?.geluidLden;
  const flood = facts.climate?.overstromingsdiepteM ?? 0;
  const hoos = facts.climate?.wateroverlastHoosbuiM ?? 0;

  if ((year && year < 1975) || fund.includes("hoog") || fund.includes("middel")) {
    out.push({
      ...DIENSTEN.funderingsonderzoek,
      reden:
        year && year < 1975
          ? `Bouwjaar ${year} en het funderingssignaal in de buurt maken een check vóór het bod verstandig.`
          : "Het funderingsrisico in deze buurt is verhoogd volgens de Klimaateffectatlas.",
    });
  }

  out.push({
    ...DIENSTEN["bouwkundige-keuring"],
    reden:
      year && year < 1992
        ? `Bij een woning uit ${year} is een keuring vaak voorwaarde voor de hypotheek en sterk aan te raden.`
        : "Standaard aanrader vóór een bod; vaak ook voorwaarde van de geldverstrekker.",
  });

  if (["C", "D", "E", "F", "G"].includes(label)) {
    out.push({
      ...DIENSTEN["epa-maatwerkadvies"],
      reden: `Label ${facts.energy!.labelklasse}: een maatwerkadvies maakt de verduurzamingskosten en subsidies concreet.`,
    });
  }

  if (geluid != null && geluid >= 60) {
    out.push({
      ...DIENSTEN.geluidsmeting,
      reden: `Berekend geluidsniveau Lden ${Math.round(geluid)} dB; een meting laat zien wat je binnen echt hoort.`,
    });
  }

  if (flood > 0 || hoos > 0.1) {
    out.push({
      ...DIENSTEN["vocht-wateradvies"],
      reden: "Dit adres heeft een overstromings- of hoosbuisignaal in de Klimaateffectatlas.",
    });
  }

  return out;
}

export function formatPrijs(cent: number): string {
  return `€${(cent / 100).toLocaleString("nl-NL", { minimumFractionDigits: 0 })}`;
}
