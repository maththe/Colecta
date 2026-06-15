const FILL_TARGET = 90;
const MIN_READINGS = 3;
const MIN_DELTA_PCT = 2;
const MAX_FORECAST_HOURS = 7 * 24;

export interface ReadingPoint {
  receivedAt: Date;
  fillLevel: number;
}

export interface FillForecast {
  /** Predicted hours until fillLevel reaches FILL_TARGET. */
  etaHours: number;
  /** ISO timestamp when the bin is expected to be full. */
  etaAt: string;
  /** Fill increase per hour (pp/h) from linear regression. */
  slopePerHour: number;
  /** Number of readings used in the regression. */
  samples: number;
}

/**
 * Linear regression over recent fill readings projected to a 90% threshold.
 * Returns null if there isn't enough signal or the bin isn't actually filling.
 */
export function forecastFill(
  readings: ReadingPoint[],
  currentFill: number | null,
): FillForecast | null {
  if (currentFill === null) return null;
  if (currentFill >= FILL_TARGET) return null;
  if (readings.length < MIN_READINGS) return null;

  const sorted = [...readings].sort(
    (a, b) => a.receivedAt.getTime() - b.receivedAt.getTime(),
  );
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  if (last.fillLevel - first.fillLevel < MIN_DELTA_PCT) return null;

  const t0 = first.receivedAt.getTime();
  const xs = sorted.map((r) => (r.receivedAt.getTime() - t0) / 3600_000);
  const ys = sorted.map((r) => r.fillLevel);
  const n = xs.length;
  const sumX = xs.reduce((a, b) => a + b, 0);
  const sumY = ys.reduce((a, b) => a + b, 0);
  const sumXX = xs.reduce((a, b) => a + b * b, 0);
  const sumXY = xs.reduce((a, b, i) => a + b * ys[i], 0);
  const denom = n * sumXX - sumX * sumX;
  if (denom === 0) return null;
  const slope = (n * sumXY - sumX * sumY) / denom;
  if (slope <= 0) return null;

  const etaHours = (FILL_TARGET - currentFill) / slope;
  if (etaHours <= 0) return null;
  if (etaHours > MAX_FORECAST_HOURS) return null;

  return {
    etaHours: Math.round(etaHours * 10) / 10,
    etaAt: new Date(Date.now() + etaHours * 3600_000).toISOString(),
    slopePerHour: Math.round(slope * 100) / 100,
    samples: n,
  };
}
