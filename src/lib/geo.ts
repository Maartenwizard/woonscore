/** Haversine distance in meters. */
export function haversineM(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/** Parse PDOK centroide "POINT(lon lat)" or "POINT(x y)" in RD. */
export function parsePoint(wkt?: string): { x: number; y: number } | null {
  if (!wkt) return null;
  const m = /POINT\s*\(\s*([-\d.]+)\s+([-\d.]+)\s*\)/i.exec(wkt);
  if (!m) return null;
  return { x: Number(m[1]), y: Number(m[2]) };
}

/** Rough RD New (EPSG:28992) → WGS84. Good enough for nearby searches. */
export function rdToWgs84(x: number, y: number): { lat: number; lon: number } {
  const dX = (x - 155000) * 1e-5;
  const dY = (y - 463000) * 1e-5;
  const lat =
    52.1551744 +
    (3235.65389 * dY -
      32.58297 * dX * dX -
      0.2475 * dY * dY -
      0.84978 * dX * dX * dY -
      0.0655 * dY * dY * dY -
      0.01709 * dX +
      0.00738 * dX * dY * dY -
      0.00012 * dX * dX * dX) /
      3600;
  const lon =
    5.38720621 +
    (5260.52916 * dX +
      105.94684 * dX * dY +
      2.45656 * dX * dY * dY -
      0.81885 * dX * dX * dX +
      0.05594 * dY -
      0.05607 * dX * dX * dY +
      0.01199 * dY * dY * dY -
      0.00256 * dX * dX * dX * dY) /
      3600;
  return { lat, lon };
}

export async function fetchWithTimeout(
  url: string,
  init: RequestInit = {},
  timeoutMs = 8000,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}
