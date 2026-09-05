"use client";

import { useEffect, useRef, useState } from "react";
import type { SuggestItem } from "@/lib/types";

export function AddressSearch({
  onSelect,
  placeholder = "Bijv. Prinsengracht 263, Amsterdam",
  initial = "",
}: {
  onSelect: (item: SuggestItem) => void;
  placeholder?: string;
  initial?: string;
}) {
  const [q, setQ] = useState(initial);
  const [items, setItems] = useState<SuggestItem[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(async () => {
      if (q.trim().length < 3) {
        setItems([]);
        return;
      }
      setLoading(true);
      try {
        const res = await fetch(`/api/suggest?q=${encodeURIComponent(q)}`);
        const json = await res.json();
        setItems(json.items ?? []);
        setOpen(true);
      } catch {
        setItems([]);
      } finally {
        setLoading(false);
      }
    }, 220);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  return (
    <div ref={boxRef} className="relative w-full">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onFocus={() => items.length && setOpen(true)}
        placeholder={placeholder}
        className="w-full rounded-2xl border border-[var(--border)] bg-white px-5 py-4 text-lg text-[var(--ink)] shadow-sm outline-none ring-[var(--accent)] transition focus:ring-2"
        autoComplete="off"
        aria-label="Zoek adres"
      />
      {loading && (
        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-[var(--muted)]">
          zoeken…
        </span>
      )}
      {open && items.length > 0 && (
        <ul className="absolute z-20 mt-2 max-h-72 w-full overflow-auto rounded-xl border border-[var(--border)] bg-white py-1 shadow-lg">
          {items.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                className="w-full px-4 py-3 text-left text-[var(--ink)] hover:bg-[var(--surface)]"
                onClick={() => {
                  setQ(item.weergavenaam);
                  setOpen(false);
                  onSelect(item);
                }}
              >
                {item.weergavenaam}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
