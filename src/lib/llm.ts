import type { PropertyFacts, ScoreResult } from "@/lib/types";

export async function maybeSummarize(
  facts: PropertyFacts,
  score: ScoreResult,
): Promise<string | undefined> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return undefined;

  try {
    const prompt = {
      adres: facts.address.weergavenaam,
      score: score.total,
      positief: score.positives.map((p) => p.text),
      negatief: score.negatives.map((n) => n.text),
      energielabel: facts.energy?.labelklasse,
      woz: facts.woz?.actueleWaarde,
    };

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.3,
        max_tokens: 180,
        messages: [
          {
            role: "system",
            content:
              "Je schrijft korte Nederlandse samenvattingen (max 3 zinnen) voor een woonrapport op basis van open data. Geen juridisch of financieel advies. Neutraal en helder.",
          },
          {
            role: "user",
            content: `Vat dit woonrapport samen:\n${JSON.stringify(prompt)}`,
          },
        ],
      }),
    });
    if (!res.ok) return undefined;
    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    return json.choices?.[0]?.message?.content?.trim();
  } catch {
    return undefined;
  }
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

/**
 * Beantwoord een vraag over een rapport, uitsluitend op basis van de
 * meegeleverde feiten. Geeft undefined terug zonder API-key of bij een fout.
 */
export async function answerReportQuestion(
  facts: PropertyFacts,
  score: ScoreResult,
  question: string,
  history: ChatMessage[] = [],
): Promise<string | undefined> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return undefined;

  const context = {
    adres: facts.address.weergavenaam,
    score: score.total,
    deelscores: score.partials.map((p) => ({
      label: p.label,
      score: p.score,
      details: p.details,
    })),
    positief: score.positives.map((p) => p.text),
    negatief: score.negatives.map((n) => n.text),
    risicos: score.risks?.map((r) => ({ label: r.label, niveau: r.level, detail: r.detail })),
    woning: facts.bag,
    energielabel: facts.energy,
    woz: facts.woz
      ? { actueel: facts.woz.actueleWaarde, trendPctPerJaar: facts.woz.trendPctPerJaar }
      : undefined,
    buurt: facts.cbs,
    criminaliteit: facts.crime,
    milieu: facts.environment,
    klimaat: facts.climate,
    scholen: facts.schools
      ? {
          binnen1km: facts.schools.binnen1km,
          dichtstbij: facts.schools.scholen.slice(0, 5),
        }
      : undefined,
    perceel: facts.perceel,
    monument: facts.monument,
    markt: facts.market,
    omgeving: facts.surroundings,
    bekendmakingen: facts.bekendmakingen
      ? {
          count12m: facts.bekendmakingen.count12m,
          samenvatting: facts.bekendmakingen.samenvatting,
          items: facts.bekendmakingen.items.slice(0, 8),
        }
      : undefined,
  };

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.2,
        max_tokens: 350,
        messages: [
          {
            role: "system",
            content:
              "Je beantwoordt vragen over één woonrapport, uitsluitend op basis van de meegeleverde rapportdata (open data, indicatief). Antwoord kort en concreet in het Nederlands. Als het antwoord niet in de data staat, zeg dat eerlijk. Geen juridisch, financieel of bouwkundig advies; verwijs daarvoor naar een professional.",
          },
          {
            role: "user",
            content: `Rapportdata:\n${JSON.stringify(context)}`,
          },
          ...history.slice(-6).map((m) => ({ role: m.role, content: m.content })),
          { role: "user", content: question },
        ],
      }),
    });
    if (!res.ok) return undefined;
    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    return json.choices?.[0]?.message?.content?.trim();
  } catch {
    return undefined;
  }
}

export async function maybeBuurtVergelijking(
  facts: PropertyFacts,
  score: ScoreResult,
): Promise<string | undefined> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return undefined;
  try {
    const prompt = {
      adres: facts.address.weergavenaam,
      buurt: facts.address.buurtnaam,
      score: score.total,
      woz: facts.woz?.actueleWaarde,
      gemWozBuurt: facts.cbs?.gemiddeldeWoz,
      inkomenBuurt: facts.cbs?.gemiddeldInkomen,
      criminaliteitVsLandelijk: facts.crime?.pctVsLandelijk,
      inbraak: facts.crime?.inbraakWoning,
      prijsindexYoY: facts.market?.prijsindexYoY,
      verkochtYoY: facts.market?.verkochtYoY,
      voorzieningen: {
        scholen: facts.schools?.binnen1km,
        ovM: facts.surroundings?.afstandOvHalteM,
        parkM: facts.surroundings?.afstandParkM,
        supermarktKm: facts.cbs?.afstandSupermarktKm,
      },
    };
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.3,
        max_tokens: 160,
        messages: [
          {
            role: "system",
            content:
              "Vergelijk deze woning in 2-3 Nederlandse zinnen met de buurt en de regionale markt. Neutraal, geen advies. Noem alleen wat in de data staat.",
          },
          { role: "user", content: JSON.stringify(prompt) },
        ],
      }),
    });
    if (!res.ok) return undefined;
    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    return json.choices?.[0]?.message?.content?.trim();
  } catch {
    return undefined;
  }
}

export async function summarizeBekendmakingen(
  items: Array<{ titel: string; type?: string }>,
): Promise<string | undefined> {
  const key = process.env.OPENAI_API_KEY;
  if (!key || !items.length) return undefined;

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.2,
        max_tokens: 120,
        messages: [
          {
            role: "system",
            content:
              "Vat officiële bekendmakingen/vergunningen samen in 1-2 Nederlandse zinnen voor een buurtbewoner. Noem aantallen en types (bijv. dakkapel, horeca).",
          },
          {
            role: "user",
            content: JSON.stringify(items.slice(0, 12)),
          },
        ],
      }),
    });
    if (!res.ok) return undefined;
    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    return json.choices?.[0]?.message?.content?.trim();
  } catch {
    return undefined;
  }
}
