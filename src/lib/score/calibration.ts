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
 * Stuksgewijs-lineaire mapping door de anchors, met doortrekking van de
 * aangrenzende helling buiten p10/p90, begrensd op 0-100.
 */
export function applyAnchors(raw: number, anchors: PillarAnchors): number {
  const { p10, p50, p90 } = anchors;
  // Te weinig spreiding in de kalibratieset → mapping is niet betekenisvol
  if (!(p10 < p50 && p50 < p90)) return raw;

  let mapped: number;
  if (raw <= p10) {
    mapped = TARGETS.p10 - ((p10 - raw) * (TARGETS.p50 - TARGETS.p10)) / (p50 - p10);
  } else if (raw <= p50) {
    mapped = TARGETS.p10 + ((raw - p10) * (TARGETS.p50 - TARGETS.p10)) / (p50 - p10);
  } else if (raw <= p90) {
    mapped = TARGETS.p50 + ((raw - p50) * (TARGETS.p90 - TARGETS.p50)) / (p90 - p50);
  } else {
    mapped = TARGETS.p90 + ((raw - p90) * (TARGETS.p90 - TARGETS.p50)) / (p90 - p50);
  }
  return Math.max(0, Math.min(100, Math.round(mapped)));
}
