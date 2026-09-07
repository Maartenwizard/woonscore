import { NextRequest, NextResponse } from "next/server";
import { checkSameOrigin } from "@/lib/auth";
import { loadReport } from "@/lib/cache";
import { answerReportQuestion, type ChatMessage } from "@/lib/llm";
import { ReportError, reportFromQuery } from "@/lib/service/report";
import type { FullReport } from "@/lib/types";

/** Vraag-en-antwoord over een rapport (interne UI, same-origin). */
export async function POST(req: NextRequest) {
  const origin = checkSameOrigin(req);
  if (!origin.ok) {
    return NextResponse.json({ error: origin.error }, { status: origin.status });
  }
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { error: "Chat is niet beschikbaar (geen OPENAI_API_KEY geconfigureerd)" },
      { status: 503 },
    );
  }

  let body: {
    nummeraanduiding?: string;
    question?: string;
    history?: ChatMessage[];
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const question = body.question?.trim();
  if (!body.nummeraanduiding || !question) {
    return NextResponse.json(
      { error: "nummeraanduiding en question zijn verplicht" },
      { status: 400 },
    );
  }
  if (question.length > 500) {
    return NextResponse.json({ error: "Vraag is te lang (max 500 tekens)" }, { status: 400 });
  }

  const history = Array.isArray(body.history)
    ? body.history
        .filter(
          (m): m is ChatMessage =>
            (m?.role === "user" || m?.role === "assistant") &&
            typeof m?.content === "string",
        )
        .slice(-6)
    : [];

  try {
    // Hergebruik het opgeslagen rapport; bouw alleen opnieuw als het er niet is
    const saved = loadReport(body.nummeraanduiding);
    const report: FullReport =
      (saved?.report as FullReport | undefined) ??
      (await reportFromQuery({ nummeraanduiding: body.nummeraanduiding }));

    const answer = await answerReportQuestion(
      report.facts,
      report.score,
      question,
      history,
    );
    if (!answer) {
      return NextResponse.json(
        { error: "Kon geen antwoord genereren, probeer het opnieuw" },
        { status: 502 },
      );
    }
    return NextResponse.json({ answer });
  } catch (e) {
    if (e instanceof ReportError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Chat failed" },
      { status: 502 },
    );
  }
}
