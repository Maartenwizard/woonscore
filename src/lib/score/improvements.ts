import type { Improvement, PropertyFacts } from "@/lib/types";

/** Concrete verbouw-/verbetersignalen op basis van open data (geen advies). */
export function buildImprovements(facts: PropertyFacts): Improvement[] {
  const out: Improvement[] = [];
  const label = facts.energy?.labelklasse?.toUpperCase().replace(/\s/g, "") ?? "";
  const year = facts.bag?.bouwjaar;
  const flood = facts.climate?.overstromingsdiepteM;
  const hoos = facts.climate?.wateroverlastHoosbuiM;
  const geluid = facts.environment?.geluidLden;

  if (["E", "F", "G"].includes(label)) {
    out.push({
      id: "isolatie",
      title: "Isolatie en energielabel",
      detail: `Energielabel ${facts.energy!.labelklasse}: dak, gevel, vloer en glas zijn de grootste winstposten. Laat een EPA-adviseur een stappenplan maken.`,
      impact: "high",
    });
  } else if (["C", "D"].includes(label)) {
    out.push({
      id: "isolatie",
      title: "Energielabel verder omhoog",
      detail: `Label ${facts.energy!.labelklasse} is gemiddeld. Isolatieglas, spouwmuurisolatie of een (hybride) warmtepomp til je vaak naar B of A.`,
      impact: "medium",
    });
  }

  if (year && year < 1975 && !facts.monument?.isRijksmonument) {
    out.push({
      id: "fundering-check",
      title: "Funderingscheck",
      detail: `Bouwjaar ${year}: laat bij aankoop de fundering inspecteren, vooral op veen- of kleigrond. Het rapport toont het buurt-paalrotrisico als eerste signaal.`,
      impact: "high",
    });
  }

  if (facts.monument?.isRijksmonument) {
    out.push({
      id: "monument-vergunning",
      title: "Vergunning bij verbouwing",
      detail: `Rijksmonument${facts.monument.rijksmonumentNummer ? ` nr. ${facts.monument.rijksmonumentNummer}` : ""}: bijna elke uitwendige of constructieve wijziging is vergunningplichtig. Schakel een restauratie-architect in.`,
      impact: "high",
    });
  } else if (facts.surroundings?.beschermdGezicht) {
    out.push({
      id: "gezicht",
      title: "Beschermd stads- of dorpsgezicht",
      detail: `${facts.surroundings.beschermdGezichtNaam ?? "Dit gebied"} is beschermd: het uiterlijk van de gevel is vaak extra gereguleerd.`,
      impact: "medium",
    });
  }

  if ((flood != null && flood > 0.2) || (hoos != null && hoos > 0.15)) {
    out.push({
      id: "water",
      title: "Waterkering bij kelder/souterrain",
      detail:
        "Dit adres kent overstromings- of hoosbuirisico. Drempels, terugslagkleppen en een waterdichte kelderdeur beperken schade.",
      impact: "medium",
    });
  }

  if (geluid != null && geluid >= 60) {
    out.push({
      id: "geluidglas",
      title: "Geluidwerend glas",
      detail: `Lden ${Math.round(geluid)} dB: HR++ of triple glas met goede kierdichting maakt een merkbare binnenverschil.`,
      impact: "medium",
    });
  }

  if (facts.climate?.hitteeilandC != null && facts.climate.hitteeilandC >= 2) {
    out.push({
      id: "hitte",
      title: "Koeling en schaduw",
      detail: `Hitte-eiland +${facts.climate.hitteeilandC} °C: buitenzonwering, een groen dak of een boom aan de zonzijde helpen meer dan alleen airco.`,
      impact: "low",
    });
  }

  return out.slice(0, 5);
}
