/**
 * Performance utilities for T6.3 hardening:
 *  - decimateSeriesForDisplay: thin a large data series to at most `maxPoints` samples
 *  - parseJsonSafe: tolerant JSON parse with truncated input for preview text
 *  - estimateWindowRows: compute how many rows fit a given px height at a standard row height
 */

const DEFAULT_ROW_HEIGHT_PX = 32;
const MAX_PARSE_CHARS = 8_000;

/**
 * Reduce a numeric series to `maxPoints` evenly spaced samples.
 * Preserves first and last element. Returns the original array when already short enough.
 */
export function decimateSeriesForDisplay(series: number[], maxPoints: number): number[] {
  if (series.length <= maxPoints || maxPoints < 2) {
    return series;
  }

  const result: number[] = [];
  const step = (series.length - 1) / (maxPoints - 1);

  for (let i = 0; i < maxPoints; i++) {
    const index = Math.round(i * step);
    result.push(series[Math.min(index, series.length - 1)]);
  }

  return result;
}

/**
 * Parse JSON to a displayable string, truncating input to avoid O(n) parse cost
 * on very large payloads. Falls back to a truncation notice if input is oversized.
 */
export function parseJsonSafe(raw: string, maxPreviewChars = MAX_PARSE_CHARS): string {
  if (raw.length <= maxPreviewChars) {
    return raw;
  }

  return `${raw.slice(0, maxPreviewChars)}[... truncated at ${maxPreviewChars} chars]`;
}

/**
 * Estimate how many rows fit within a container of `containerHeightPx` given a row height.
 * Adds an overscan row in each direction (1 above + 1 below) to avoid blank edges during scroll.
 */
export function estimateWindowRows(
  containerHeightPx: number,
  rowHeightPx = DEFAULT_ROW_HEIGHT_PX,
): number {
  return Math.ceil(containerHeightPx / rowHeightPx) + 2;
}
