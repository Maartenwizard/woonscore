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
