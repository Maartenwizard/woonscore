import { Disclaimer, Nav } from "@/components/Nav";

export default function DocsPage() {
  return (
    <div className="flex min-h-full flex-col">
      <Nav active="docs" />
      <main className="mx-auto w-full max-w-3xl flex-1 space-y-8 px-4 pb-16 pt-8">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">API docs</h1>
          <p className="mt-2 text-[var(--muted)]">
            Publieke REST API v1. Auth via header <code>X-API-Key</code>. Demo
            keys: <code>demo-key-1</code>, <code>demo-key-2</code> (60 req/uur).
          </p>
        </div>

        <Endpoint
          method="GET"
          path="/api/v1/geocode?q=Prinsengracht"
          desc="Adressuggesties. Voeg lookup=1 toe voor volledige resolutie."
        />
        <Endpoint
          method="GET"
          path="/api/v1/score?address=Dam%201%20Amsterdam&profile=consumer"
          desc="Woonscore + deelscores + bullets."
        />
        <Endpoint
          method="GET"
          path="/api/v1/report?address=Dam%201%20Amsterdam&profile=commercial"
          desc="Volledig due-diligence rapport inclusief feiten en risico-checklist."
        />
        <Endpoint
          method="POST"
          path="/api/v1/bulk"
          desc='Body: { "addresses": ["Dam 1 Amsterdam", "..."], "profile": "commercial" } (max 20).'
        />

        <pre className="overflow-x-auto rounded-xl bg-[var(--ink)] p-4 text-sm text-white">
{`curl -H "X-API-Key: demo-key-1" \\
  "http://localhost:3000/api/v1/score?address=Dam%201%20Amsterdam"`}
        </pre>

        <section className="space-y-2 text-sm text-[var(--muted)]">
          <h2 className="text-lg font-semibold text-[var(--ink)]">OpenAPI (samenvatting)</h2>
          <p>
            Stabiele response-shape met <code>version: &quot;v1&quot;</code>,{" "}
            <code>sources[]</code> en <code>fetchedAt</code> per bron. Scores
            zijn deterministisch; optionele LLM-samenvatting alleen als{" "}
            <code>OPENAI_API_KEY</code> gezet is.
          </p>
        </section>
      </main>
      <footer className="mx-auto w-full max-w-5xl px-4 pb-8">
        <Disclaimer />
      </footer>
    </div>
  );
}

function Endpoint({
  method,
  path,
  desc,
}: {
  method: string;
  path: string;
  desc: string;
}) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-white p-4">
      <div className="mb-1 font-mono text-sm">
        <span className="mr-2 rounded bg-[var(--accent)] px-2 py-0.5 text-white">
          {method}
        </span>
        {path}
      </div>
      <p className="text-sm text-[var(--muted)]">{desc}</p>
    </div>
  );
}
