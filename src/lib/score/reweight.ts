import type { PartialScore, PartialScoreKey } from "@/lib/types";

export const DEFAULT_WEIGHTS: Record<PartialScoreKey, number> = {
  woning: 0.2,
  waarde: 0.15,
  veiligheid: 0.15,
  milieu: 0.15,
  klimaat: 0.15,
  voorzieningen: 0.1,
  buurt: 0.1,
};

export function reweightTotal(
  partials: PartialScore[],
  weights: Record<PartialScoreKey, number>,
): number | null {
  const available = partials.filter((p) => p.score != null);
  if (!available.length) return null;
  const weightSum = available.reduce((s, p) => s + (weights[p.key] ?? p.weight), 0);
  if (weightSum <= 0) return null;
  const total = available.reduce(
    (s, p) => s + (p.score as number) * ((weights[p.key] ?? p.weight) / weightSum),
    0,
  );
  return Math.max(0, Math.min(100, Math.round(total)));
}
