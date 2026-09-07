"use client";

import { useRef, useState } from "react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const SUGGESTIONS = [
  "Wat zijn de grootste risico's van dit adres?",
  "Hoe is de buurt qua veiligheid en voorzieningen?",
  "Waar moet ik op letten bij een verbouwing?",
];

export function ReportChat({ nummeraanduidingId }: { nummeraanduidingId: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  async function ask(question: string) {
    const q = question.trim();
    if (!q || busy) return;
    setError(null);
    setBusy(true);
    setInput("");
    const nextMessages: Message[] = [...messages, { role: "user", content: q }];
    setMessages(nextMessages);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nummeraanduiding: nummeraanduidingId,
          question: q,
          history: messages.slice(-6),
        }),
      });
      const json = await res.json();
      if (res.status === 503) {
        setUnavailable(true);
        return;
      }
      if (!res.ok) throw new Error(json.error ?? "Er ging iets mis");
      setMessages([...nextMessages, { role: "assistant", content: json.answer }]);
      requestAnimationFrame(() => {
        listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Er ging iets mis");
    } finally {
      setBusy(false);
    }
  }

  if (unavailable) return null;

  return (
    <section className="space-y-3 rounded-2xl border border-[var(--border)] bg-white/70 p-5 print:hidden">
      <h2 className="text-lg font-semibold text-[var(--ink)]">Vraag het rapport</h2>
      <p className="text-sm text-[var(--muted)]">
        Stel een vraag over dit adres; het antwoord is gebaseerd op de openbare
        data in dit rapport. Indicatief, geen advies.
      </p>

      {messages.length === 0 && (
        <div className="flex flex-wrap gap-2">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => ask(s)}
              disabled={busy}
              className="rounded-full border border-[var(--border)] bg-white px-3 py-1.5 text-sm text-[var(--ink)] hover:border-[var(--accent)] disabled:opacity-50"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {messages.length > 0 && (
        <div ref={listRef} className="max-h-80 space-y-3 overflow-y-auto pr-1">
          {messages.map((m, i) => (
            <div
              key={i}
              className={
                m.role === "user"
                  ? "ml-8 rounded-xl bg-[var(--accent)] px-4 py-2.5 text-sm text-white"
                  : "mr-8 whitespace-pre-wrap rounded-xl bg-[var(--surface)] px-4 py-2.5 text-sm text-[var(--ink)]"
              }
            >
              {m.content}
            </div>
          ))}
          {busy && (
            <div className="mr-8 rounded-xl bg-[var(--surface)] px-4 py-2.5 text-sm text-[var(--muted)]">
              Bezig…
            </div>
          )}
        </div>
      )}

      {error && <p className="text-sm text-rose-700">{error}</p>}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          ask(input);
        }}
        className="flex gap-2"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Bijv. is er funderingsrisico?"
          maxLength={500}
          className="flex-1 rounded-xl border border-[var(--border)] bg-white px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[var(--accent)]"
          aria-label="Vraag over dit rapport"
        />
        <button
          type="submit"
          disabled={busy || !input.trim()}
          className="rounded-xl bg-[var(--accent)] px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
        >
          Vraag
        </button>
      </form>
    </section>
  );
}
