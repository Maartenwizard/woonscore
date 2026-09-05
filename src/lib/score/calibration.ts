import fs from "node:fs";
import path from "node:path";
import type { PartialScoreKey } from "@/lib/types";

/**
 * Kalibratie-anchors per pijler, gegenereerd door `npm run calibrate` op basis
 * van een landelijke adressenmix. De engine mapt ruwe pijlerscores door deze
 * percentielen zodat een score landelijk vergelijkbaar is: het mediane adres
 * krijgt ~55, p10 ~30 en p90 ~80.
 */
export interface PillarAnchors {
  p10: number;
  p50: number;
  p90: number;
}

export interface CalibrationData {
  generatedAt: string;
  pillars: Partial<Record<PartialScoreKey, PillarAnchors>>;
}

const CALIBRATION_PATH = path.join(process.cwd(), "data", "calibration.json");

/** Doelscores voor de percentiel-anchors. */
const TARGETS = { p10: 30, p50: 55, p90: 80 } as const;

let cached: { data: CalibrationData | null; mtimeMs: number } | null = null;

export function loadCalibration(): CalibrationData | null {
  try {
    const stat = fs.statSync(CALIBRATION_PATH);
    if (cached && cached.mtimeMs === stat.mtimeMs) return cached.data;
    const json = JSON.parse(fs.readFileSync(CALIBRATION_PATH, "utf8")) as CalibrationData;
    const data = json.pillars ? json : null;
    cached = { data, mtimeMs: stat.mtimeMs };
    return data;
  } catch {
    cached = null;
    return null;
  }
}

/**
 * Stuksgewijs-lineaire mapping door de anchors: (0→0, p10→30, p50→55,
 * p90→80, 100→100). Buiten de anchors wordt vloeiend richting 0/100 gemapt,
 * zodat smalle percentiel-banden geen extreme extrapolatie veroorzaken.
 */
export function applyAnchors(raw: number, anchors: PillarAnchors): number {
  const { p10, p50, p90 } = anchors;
  // Te weinig spreiding in de kalibratieset → mapping is niet betekenisvol
  if (!(p10 < p50 && p50 < p90)) return raw;

  const points: Array<[number, number]> = [
    [0, 0],
    [p10, TARGETS.p10],
    [p50, TARGETS.p50],
    [p90, TARGETS.p90],
    [100, 100],
  ];

  let mapped: number;
  if (raw <= 0) {
    mapped = 0;
  } else if (raw >= 100) {
    mapped = 100;
  } else {
    mapped = 100;
    for (let i = 1; i < points.length; i++) {
      const [x0, y0] = points[i - 1];
      const [x1, y1] = points[i];
      if (raw <= x1) {
        // Anchors op 0/100 kunnen samenvallen met de randpunten
        mapped = x1 === x0 ? y1 : y0 + ((raw - x0) * (y1 - y0)) / (x1 - x0);
        break;
      }
    }
  }
  return Math.max(0, Math.min(100, Math.round(mapped)));
}
