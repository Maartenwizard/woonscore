"use client";

function scoreColor(score: number): string {
  if (score >= 75) return "#1f7a4c";
  if (score >= 55) return "#c47b16";
  return "#c23b3b";
}

export function ScoreRing({
  score,
  size = 168,
  label = "Woonscore",
}: {
  score: number | null;
  size?: number;
  label?: string;
}) {
  const value = score ?? 0;
  const color = score == null ? "#94a3b8" : scoreColor(value);
  const stroke = 10;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (value / 100) * c;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="#e8ecef"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={score == null ? c : offset}
          className="transition-all duration-700"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-5xl font-semibold tracking-tight" style={{ color }}>
          {score ?? "—"}
        </span>
        <span className="text-sm text-[var(--muted)]">{label}</span>
      </div>
    </div>
  );
}
