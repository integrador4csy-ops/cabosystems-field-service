/** History cadence is independent from the live radar refresh rate. */
export function shouldRecordLocationHistory(
  previous: number | undefined,
  capturedAt: number,
  speedKmH: number,
): boolean {
  if (!Number.isFinite(capturedAt)) return false;
  if (previous === undefined) return true;
  if (capturedAt <= previous) return false;
  return capturedAt - previous >= (speedKmH >= 2.5 ? 30_000 : 120_000);
}
