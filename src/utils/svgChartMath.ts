export interface NumericScale {
  min: number;
  max: number;
  ticks: number[];
}

/**
 * Computes human-friendly axis bounds and ticks for a list of numeric values.
 */
export function computeNiceScale(
  values: number[],
  options?: {
    tickCount?: number;
    includeZero?: boolean;
    fixedDomain?: [number, number];
  }
): NumericScale {
  const tickCount = Math.max(2, options?.tickCount ?? 5);
  const includeZero = options?.includeZero ?? true;

  if (options?.fixedDomain) {
    const [dMin, dMax] = options.fixedDomain;
    const span = dMax - dMin || 1;
    const step = span / (tickCount - 1);
    const ticks: number[] = [];
    for (let i = 0; i < tickCount; i++) {
      ticks.push(Math.round((dMin + step * i) * 1000) / 1000);
    }
    return { min: dMin, max: dMax, ticks };
  }

  const finite = values.filter((v) => Number.isFinite(v));
  let rawMin = finite.length > 0 ? Math.min(...finite) : 0;
  let rawMax = finite.length > 0 ? Math.max(...finite) : 0;

  if (includeZero) {
    rawMin = Math.min(0, rawMin);
    rawMax = Math.max(0, rawMax);
  }

  if (rawMin === rawMax) {
    if (rawMax === 0) {
      return { min: 0, max: 100, ticks: [0, 25, 50, 75, 100] };
    }
    const pad = Math.abs(rawMax) * 0.2 || 10;
    rawMin = includeZero && rawMax > 0 ? 0 : rawMin - pad;
    rawMax = includeZero && rawMax < 0 ? 0 : rawMax + pad;
  }

  const range = rawMax - rawMin;
  const roughStep = range / (tickCount - 1);
  const mag = Math.pow(10, Math.floor(Math.log10(roughStep)));
  const norm = roughStep / mag;
  let niceNorm = 1;
  if (norm <= 1) niceNorm = 1;
  else if (norm <= 2) niceNorm = 2;
  else if (norm <= 2.5) niceNorm = 2.5;
  else if (norm <= 5) niceNorm = 5;
  else niceNorm = 10;

  const step = niceNorm * mag;
  const niceMin = Math.floor(rawMin / step) * step;
  const niceMax = Math.ceil(rawMax / step) * step;

  const ticks: number[] = [];
  const maxSteps = 12;
  for (let i = 0; i <= maxSteps; i++) {
    const val = niceMin + i * step;
    if (val > niceMax + step * 0.001) break;
    const rounded = Math.abs(val) < step * 1e-9 ? 0 : Math.round(val * 1e6) / 1e6;
    ticks.push(rounded);
  }

  return {
    min: niceMin,
    max: ticks.length > 0 ? Math.max(niceMax, ticks[ticks.length - 1]) : niceMax,
    ticks: ticks.length >= 2 ? ticks : [niceMin, niceMax],
  };
}

/**
 * Generates a smooth monotone cubic Bezier SVG path string through (x, y) points.
 * Prevents overshoot between flat or monotonic segments (similar to d3 curveMonotoneX).
 */
export function buildMonotonePath(points: ReadonlyArray<{ x: number; y: number }>): string {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;
  if (points.length === 2) {
    return `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)} L ${points[1].x.toFixed(2)} ${points[1].y.toFixed(2)}`;
  }

  const n = points.length;
  const dx: number[] = new Array(n - 1);
  const dy: number[] = new Array(n - 1);
  const slopes: number[] = new Array(n - 1);

  for (let i = 0; i < n - 1; i++) {
    dx[i] = points[i + 1].x - points[i].x;
    dy[i] = points[i + 1].y - points[i].y;
    slopes[i] = dx[i] !== 0 ? dy[i] / dx[i] : 0;
  }

  const tangents: number[] = new Array(n);
  tangents[0] = slopes[0];
  tangents[n - 1] = slopes[n - 2];

  for (let i = 1; i < n - 1; i++) {
    if (slopes[i - 1] * slopes[i] <= 0) {
      tangents[i] = 0;
    } else {
      const w1 = 2 * dx[i] + dx[i - 1];
      const w2 = dx[i] + 2 * dx[i - 1];
      tangents[i] = (w1 + w2) / (w1 / slopes[i - 1] + w2 / slopes[i]);
    }
  }

  let d = `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;
  for (let i = 0; i < n - 1; i++) {
    const p0 = points[i];
    const p1 = points[i + 1];
    const h = dx[i] / 3;
    const cp1x = p0.x + h;
    const cp1y = p0.y + tangents[i] * h;
    const cp2x = p1.x - h;
    const cp2y = p1.y - tangents[i + 1] * h;
    d += ` C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(2)} ${cp2y.toFixed(2)}, ${p1.x.toFixed(2)} ${p1.y.toFixed(2)}`;
  }

  return d;
}

/**
 * Generates an SVG closed area path under a monotone line down to baselineY.
 */
export function buildMonotoneAreaPath(
  points: ReadonlyArray<{ x: number; y: number }>,
  baselineY: number
): string {
  if (points.length === 0) return '';
  const line = buildMonotonePath(points);
  const last = points[points.length - 1];
  const first = points[0];
  return `${line} L ${last.x.toFixed(2)} ${baselineY.toFixed(2)} L ${first.x.toFixed(2)} ${baselineY.toFixed(2)} Z`;
}

/**
 * Builds an annular sector (donut slice) SVG path in clockwise degrees starting at 12 o'clock (-90deg).
 */
export function buildDonutSlicePath(
  cx: number,
  cy: number,
  innerR: number,
  outerR: number,
  startAngleDeg: number,
  endAngleDeg: number
): string {
  const sweep = Math.max(0.1, Math.min(359.95, endAngleDeg - startAngleDeg));
  const startRad = ((startAngleDeg - 90) * Math.PI) / 180;
  const endRad = ((startAngleDeg + sweep - 90) * Math.PI) / 180;
  const largeArc = sweep > 180 ? 1 : 0;

  const x1 = cx + outerR * Math.cos(startRad);
  const y1 = cy + outerR * Math.sin(startRad);
  const x2 = cx + outerR * Math.cos(endRad);
  const y2 = cy + outerR * Math.sin(endRad);

  const x3 = cx + innerR * Math.cos(endRad);
  const y3 = cy + innerR * Math.sin(endRad);
  const x4 = cx + innerR * Math.cos(startRad);
  const y4 = cy + innerR * Math.sin(startRad);

  return [
    `M ${x1.toFixed(2)} ${y1.toFixed(2)}`,
    `A ${outerR.toFixed(2)} ${outerR.toFixed(2)} 0 ${largeArc} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`,
    `L ${x3.toFixed(2)} ${y3.toFixed(2)}`,
    `A ${innerR.toFixed(2)} ${innerR.toFixed(2)} 0 ${largeArc} 0 ${x4.toFixed(2)} ${y4.toFixed(2)}`,
    'Z',
  ].join(' ');
}
