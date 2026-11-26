import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  buildDonutSlicePath,
  buildMonotoneAreaPath,
  buildMonotonePath,
  computeNiceScale,
} from '../utils/svgChartMath.ts';

function useElementWidth(fallback = 560): [React.RefObject<HTMLDivElement | null>, number] {
  const ref = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState<number>(fallback);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const next = Math.round(el.getBoundingClientRect().width);
      if (next > 40) setWidth(next);
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return [ref, width];
}

export interface CartesianSeries<T extends Record<string, any>> {
  key: keyof T & string;
  name: string;
  type: 'bar' | 'area' | 'line';
  color: string;
  yAxisId?: 'left' | 'right';
  strokeWidth?: number;
  strokeDasharray?: string;
  fillOpacity?: number;
  gradientTopOpacity?: number;
  gradientBottomOpacity?: number;
  maxBarSize?: number;
  cellColors?: string[];
  dotRadius?: number;
  showDots?: boolean;
}

export interface SvgCartesianChartProps<T extends Record<string, any>> {
  data: T[];
  xKey: keyof T & string;
  series: CartesianSeries<T>[];
  height?: number;
  leftTickFormatter?: (val: number) => string;
  rightTickFormatter?: (val: number) => string;
  leftAxisColor?: string;
  rightAxisColor?: string;
  referenceLineY?: number;
  legendPosition?: 'top' | 'bottom' | 'none';
  renderTooltip?: (item: T, index: number) => React.ReactNode;
  formatTooltipValue?: (value: number, series: CartesianSeries<T>, item: T) => string;
  formatTooltipLabel?: (item: T) => string;
}

export function SvgCartesianChart<T extends Record<string, any>>({
  data,
  xKey,
  series,
  height = 270,
  leftTickFormatter = (v) => (Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(0)}k` : `${v}`),
  rightTickFormatter = (v) => `${v}`,
  leftAxisColor = '#475569',
  rightAxisColor = '#00897b',
  referenceLineY,
  legendPosition = 'bottom',
  renderTooltip,
  formatTooltipValue,
  formatTooltipLabel,
}: SvgCartesianChartProps<T>) {
  const uid = useId().replace(/:/g, '');
  const [containerRef, containerWidth] = useElementWidth(560);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const hasRightAxis = useMemo(
    () => series.some((s) => s.yAxisId === 'right'),
    [series]
  );
  const barSeries = useMemo(
    () => series.filter((s) => s.type === 'bar'),
    [series]
  );
  const areaSeries = useMemo(
    () => series.filter((s) => s.type === 'area'),
    [series]
  );
  const lineSeries = useMemo(
    () => series.filter((s) => s.type === 'line'),
    [series]
  );

  const legendHeight = legendPosition === 'none' ? 0 : 28;
  const svgHeight = Math.max(160, height - legendHeight);

  const margin = {
    top: 12,
    right: hasRightAxis ? 60 : 18,
    bottom: 28,
    left: 56,
  };

  const plotW = Math.max(120, containerWidth - margin.left - margin.right);
  const plotH = Math.max(80, svgHeight - margin.top - margin.bottom);

  const leftScale = useMemo(() => {
    const vals: number[] = [];
    for (const s of series) {
      if ((s.yAxisId ?? 'left') !== 'left') continue;
      for (const row of data) {
        vals.push(Number(row[s.key]) || 0);
      }
    }
    if (referenceLineY !== undefined) vals.push(referenceLineY);
    return computeNiceScale(vals, { tickCount: 5, includeZero: true });
  }, [data, series, referenceLineY]);

  const rightScale = useMemo(() => {
    if (!hasRightAxis) return null;
    const vals: number[] = [];
    for (const s of series) {
      if (s.yAxisId !== 'right') continue;
      for (const row of data) {
        vals.push(Number(row[s.key]) || 0);
      }
    }
    return computeNiceScale(vals, { tickCount: 5, includeZero: true });
  }, [data, series, hasRightAxis]);

  const mapY = (value: number, axis: 'left' | 'right' = 'left'): number => {
    const sc = axis === 'right' && rightScale ? rightScale : leftScale;
    const span = sc.max - sc.min || 1;
    const ratio = (value - sc.min) / span;
    return margin.top + plotH - ratio * plotH;
  };

  const count = data.length;
  const hasBars = barSeries.length > 0;
  const slotWidth = count > 0 ? plotW / count : plotW;

  const getCenterX = (index: number): number => {
    if (count === 0) return margin.left + plotW / 2;
    if (hasBars || count === 1) {
      return margin.left + slotWidth * index + slotWidth / 2;
    }
    const padX = Math.min(20, plotW * 0.04);
    const usableW = Math.max(1, plotW - padX * 2);
    return margin.left + padX + (usableW * index) / (count - 1);
  };

  const zeroYLeft = Math.max(margin.top, Math.min(margin.top + plotH, mapY(0, 'left')));
  const zeroYRight = rightScale
    ? Math.max(margin.top, Math.min(margin.top + plotH, mapY(0, 'right')))
    : zeroYLeft;

  const maxLabelChars = Math.max(4, Math.floor((slotWidth - 6) / 6.5));
  const labelStride = count > 8 && containerWidth < 460 ? 2 : 1;

  const renderLegend = () => {
    if (legendPosition === 'none') return null;
    return (
      <div
        className={`flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] font-semibold text-slate-700 ${
          legendPosition === 'top' ? 'justify-end pb-1' : 'justify-center pt-1.5'
        }`}
      >
        {series.map((s) => (
          <div key={s.key} className="inline-flex items-center gap-1.5">
            {s.type === 'line' ? (
              <span
                className="inline-block w-3.5 h-0.5 rounded-full"
                style={{
                  backgroundColor: s.strokeDasharray ? 'transparent' : s.color,
                  borderTop: s.strokeDasharray ? `2px dashed ${s.color}` : undefined,
                }}
              />
            ) : (
              <span
                className="inline-block w-2.5 h-2.5 rounded-xs shrink-0"
                style={{ backgroundColor: s.color }}
              />
            )}
            <span className="truncate max-w-[210px]">{s.name}</span>
          </div>
        ))}
      </div>
    );
  };

  const hoveredItem = hoverIdx !== null && data[hoverIdx] ? data[hoverIdx] : null;
  const hoverX = hoverIdx !== null ? getCenterX(hoverIdx) : 0;
  const approxTooltipWidth = Math.min(240, Math.max(180, containerWidth - 16));
  const rawLeft =
    hoverX > containerWidth * 0.56
      ? hoverX - approxTooltipWidth - 12
      : hoverX + 12;
  const clampedTooltipLeft = Math.max(
    8,
    Math.min(Math.max(8, containerWidth - approxTooltipWidth - 8), rawLeft)
  );

  return (
    <div
      ref={containerRef}
      className="relative w-full select-none flex flex-col"
      style={{ height }}
      onMouseLeave={() => setHoverIdx(null)}
    >
      {legendPosition === 'top' && renderLegend()}

      <div className="relative w-full" style={{ height: svgHeight }}>
        <svg
          width={containerWidth}
          height={svgHeight}
          viewBox={`0 0 ${containerWidth} ${svgHeight}`}
          className="block overflow-visible"
          role="img"
        >
          <defs>
            {areaSeries.map((s) => (
              <linearGradient
                key={`grad-${s.key}`}
                id={`svg-grad-${uid}-${s.key}`}
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop
                  offset="5%"
                  stopColor={s.color}
                  stopOpacity={s.gradientTopOpacity ?? s.fillOpacity ?? 0.28}
                />
                <stop
                  offset="95%"
                  stopColor={s.color}
                  stopOpacity={s.gradientBottomOpacity ?? 0.03}
                />
              </linearGradient>
            ))}
          </defs>

          {/* Horizontal Grid Lines & Left Y-Axis Ticks */}
          {leftScale.ticks.map((tick, idx) => {
            const y = mapY(tick, 'left');
            return (
              <g key={`ltick-${idx}`}>
                <line
                  x1={margin.left}
                  x2={margin.left + plotW}
                  y1={y}
                  y2={y}
                  stroke="#e2e8f0"
                  strokeDasharray="3 3"
                  strokeWidth={1}
                />
                <text
                  x={margin.left - 8}
                  y={y + 4}
                  textAnchor="end"
                  fill={leftAxisColor}
                  fontSize={11}
                  fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
                >
                  {leftTickFormatter(tick)}
                </text>
              </g>
            );
          })}

          {/* Right Y-Axis Ticks */}
          {hasRightAxis &&
            rightScale &&
            rightScale.ticks.map((tick, idx) => {
              const y = mapY(tick, 'right');
              return (
                <text
                  key={`rtick-${idx}`}
                  x={margin.left + plotW + 8}
                  y={y + 4}
                  textAnchor="start"
                  fill={rightAxisColor}
                  fontSize={11}
                  fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
                >
                  {rightTickFormatter(tick)}
                </text>
              );
            })}

          {/* Axes Borders */}
          <line
            x1={margin.left}
            x2={margin.left + plotW}
            y1={margin.top + plotH}
            y2={margin.top + plotH}
            stroke="#cbd5e1"
            strokeWidth={1}
          />
          <line
            x1={margin.left}
            x2={margin.left}
            y1={margin.top}
            y2={margin.top + plotH}
            stroke={hasRightAxis ? '#93c5fd' : '#cbd5e1'}
            strokeWidth={1}
          />
          {hasRightAxis && (
            <line
              x1={margin.left + plotW}
              x2={margin.left + plotW}
              y1={margin.top}
              y2={margin.top + plotH}
              stroke="#5eead4"
              strokeWidth={1}
            />
          )}

          {/* Optional Reference Line (e.g. y = 0) */}
          {referenceLineY !== undefined && (
            <line
              x1={margin.left}
              x2={margin.left + plotW}
              y1={mapY(referenceLineY, 'left')}
              y2={mapY(referenceLineY, 'left')}
              stroke="#94a3b8"
              strokeDasharray="4 4"
              strokeWidth={1.25}
            />
          )}

          {/* Hover Vertical Highlight Column */}
          {hoverIdx !== null && (
            <line
              x1={hoverX}
              x2={hoverX}
              y1={margin.top}
              y2={margin.top + plotH}
              stroke="#94a3b8"
              strokeDasharray="3 3"
              strokeWidth={1}
            />
          )}

          {/* Area Series */}
          {areaSeries.map((s) => {
            const pts = data.map((row, idx) => ({
              x: getCenterX(idx),
              y: mapY(Number(row[s.key]) || 0, s.yAxisId ?? 'left'),
            }));
            const base = s.yAxisId === 'right' ? zeroYRight : zeroYLeft;
            const areaD = buildMonotoneAreaPath(pts, base);
            const lineD = buildMonotonePath(pts);
            return (
              <g key={`area-${s.key}`}>
                {areaD && <path d={areaD} fill={`url(#svg-grad-${uid}-${s.key})`} />}
                {lineD && (
                  <path
                    d={lineD}
                    fill="none"
                    stroke={s.color}
                    strokeWidth={s.strokeWidth ?? 2.5}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                )}
                {pts.length === 1 && (
                  <circle
                    cx={pts[0].x}
                    cy={pts[0].y}
                    r={4.5}
                    fill={s.color}
                    stroke="#ffffff"
                    strokeWidth={2}
                  />
                )}
                {hoverIdx !== null && pts[hoverIdx] && (
                  <circle
                    cx={pts[hoverIdx].x}
                    cy={pts[hoverIdx].y}
                    r={5}
                    fill={s.color}
                    stroke="#ffffff"
                    strokeWidth={2}
                  />
                )}
              </g>
            );
          })}

          {/* Bar Series */}
          {hasBars &&
            data.map((row, rowIdx) => {
              const cx = getCenterX(rowIdx);
              const barCount = barSeries.length;
              const gap = barCount > 1 ? 6 : 0;
              const maxPerBar = barSeries[0]?.maxBarSize ?? (barCount === 1 ? 42 : 34);
              const availW = Math.max(12, slotWidth * 0.72);
              const barW = Math.max(
                6,
                Math.min(maxPerBar, (availW - gap * (barCount - 1)) / barCount)
              );
              const groupW = barW * barCount + gap * (barCount - 1);
              const startX = cx - groupW / 2;

              return (
                <g key={`bars-${rowIdx}`}>
                  {barSeries.map((s, sIdx) => {
                    const axis = s.yAxisId ?? 'left';
                    const val = Number(row[s.key]) || 0;
                    const base = axis === 'right' ? zeroYRight : zeroYLeft;
                    const yVal = mapY(val, axis);
                    const yTop = Math.min(base, yVal);
                    const barH = Math.max(val !== 0 ? 2 : 0, Math.abs(base - yVal));
                    const x = startX + sIdx * (barW + gap);
                    const fill = s.cellColors
                      ? s.cellColors[rowIdx % s.cellColors.length]
                      : s.color;
                    const isHovered = hoverIdx === rowIdx;

                    return (
                      <rect
                        key={`bar-${rowIdx}-${s.key}`}
                        x={x}
                        y={yTop}
                        width={barW}
                        height={barH}
                        rx={barH >= 4 ? 4 : 1}
                        ry={barH >= 4 ? 4 : 1}
                        fill={fill}
                        opacity={hoverIdx === null || isHovered ? 1 : 0.78}
                      />
                    );
                  })}
                </g>
              );
            })}

          {/* Line Series */}
          {lineSeries.map((s) => {
            const pts = data.map((row, idx) => ({
              x: getCenterX(idx),
              y: mapY(Number(row[s.key]) || 0, s.yAxisId ?? 'left'),
            }));
            const lineD = buildMonotonePath(pts);
            const dotR = s.dotRadius ?? 3.5;
            return (
              <g key={`line-${s.key}`}>
                {lineD && (
                  <path
                    d={lineD}
                    fill="none"
                    stroke={s.color}
                    strokeWidth={s.strokeWidth ?? 2.5}
                    strokeDasharray={s.strokeDasharray}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                )}
                {(s.showDots ?? true) &&
                  pts.map((pt, idx) => {
                    const isActive = hoverIdx === idx;
                    return (
                      <circle
                        key={`dot-${s.key}-${idx}`}
                        cx={pt.x}
                        cy={pt.y}
                        r={isActive ? Math.max(dotR + 1.5, 5.5) : dotR}
                        fill={isActive && !s.strokeDasharray ? '#fbbf24' : s.color}
                        stroke={isActive && !s.strokeDasharray ? '#1e3247' : '#ffffff'}
                        strokeWidth={2}
                      />
                    );
                  })}
              </g>
            );
          })}

          {/* X-Axis Labels */}
          {data.map((row, idx) => {
            if (idx % labelStride !== 0 && idx !== count - 1) return null;
            const rawLabel = String(row[xKey] ?? '');
            const label =
              rawLabel.length > maxLabelChars + 2
                ? `${rawLabel.slice(0, maxLabelChars)}…`
                : rawLabel;
            return (
              <text
                key={`xlabel-${idx}`}
                x={getCenterX(idx)}
                y={margin.top + plotH + 17}
                textAnchor="middle"
                fill="#334155"
                fontSize={11}
                fontWeight={600}
              >
                {label}
              </text>
            );
          })}

          {/* Invisible Interactive Hover Hit Columns */}
          {data.map((_row, idx) => {
            const cx = getCenterX(idx);
            const hitW = count > 1 ? Math.max(16, plotW / count) : plotW;
            const hitX = Math.max(margin.left, Math.min(margin.left + plotW - hitW, cx - hitW / 2));
            return (
              <rect
                key={`hit-${idx}`}
                x={hitX}
                y={margin.top}
                width={hitW}
                height={plotH}
                fill="transparent"
                className="cursor-crosshair"
                onMouseEnter={() => setHoverIdx(idx)}
                onClick={() => setHoverIdx((prev) => (prev === idx ? null : idx))}
              />
            );
          })}
        </svg>

        {/* Floating Interactive Tooltip */}
        {hoveredItem && hoverIdx !== null && (
          <div
            className="pointer-events-none absolute top-2 z-20 transition-all duration-75"
            style={{
              left: clampedTooltipLeft,
              maxWidth: Math.max(180, containerWidth - 16),
            }}
          >
            {renderTooltip ? (
              renderTooltip(hoveredItem, hoverIdx)
            ) : (
              <div className="bg-white border border-[#CBD8E6] rounded-lg px-3 py-2 shadow-lg text-xs font-mono space-y-1 min-w-[200px] max-w-[290px]">
                <div className="font-bold text-[#1D6CE0] border-b border-slate-100 pb-1 font-sans">
                  {formatTooltipLabel
                    ? formatTooltipLabel(hoveredItem)
                    : String(hoveredItem[xKey] ?? '')}
                </div>
                {series.map((s) => {
                  const val = Number(hoveredItem[s.key]) || 0;
                  const formatted = formatTooltipValue
                    ? formatTooltipValue(val, s, hoveredItem)
                    : val.toLocaleString();
                  return (
                    <div key={s.key} className="flex items-center justify-between gap-3 text-[11px]">
                      <span className="inline-flex items-center gap-1.5 text-slate-600 truncate font-sans">
                        <span
                          className="w-2 h-2 rounded-xs shrink-0"
                          style={{ backgroundColor: s.color }}
                        />
                        <span className="truncate">{s.name}</span>
                      </span>
                      <span className="font-bold text-slate-900 shrink-0 tabular-nums">
                        {formatted}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {legendPosition === 'bottom' && renderLegend()}
    </div>
  );
}

export interface DonutChartItem {
  key: string;
  label: string;
  value: number;
  color: string;
}

export interface SvgDonutChartProps<T extends DonutChartItem> {
  data: T[];
  height?: number;
  innerRadius?: number;
  outerRadius?: number;
  renderTooltip?: (item: T) => React.ReactNode;
}

export function SvgDonutChart<T extends DonutChartItem>({
  data,
  height = 240,
  innerRadius = 64,
  outerRadius = 96,
  renderTooltip,
}: SvgDonutChartProps<T>) {
  const [containerRef, containerWidth] = useElementWidth(320);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const total = useMemo(
    () => data.reduce((sum, d) => sum + Math.max(0, Number(d.value) || 0), 0),
    [data]
  );

  const cx = containerWidth / 2;
  const cy = height / 2;
  const maxR = Math.max(40, Math.min(outerRadius, Math.min(containerWidth, height) / 2 - 12));
  const innerR = Math.round((innerRadius / outerRadius) * maxR);

  const slices = useMemo(() => {
    if (total <= 0) return [];
    const padDeg = data.length > 1 ? 2.5 : 0;
    let cursor = 0;
    return data.map((item, idx) => {
      const val = Math.max(0, Number(item.value) || 0);
      const deg = (val / total) * 360;
      const start = cursor + padDeg / 2;
      const end = cursor + Math.max(0.5, deg - padDeg / 2);
      cursor += deg;
      return { item, idx, start, end };
    });
  }, [data, total]);

  const hovered = hoverIdx !== null && data[hoverIdx] ? data[hoverIdx] : null;

  return (
    <div
      ref={containerRef}
      className="relative w-full select-none"
      style={{ height }}
      onMouseLeave={() => setHoverIdx(null)}
    >
      <svg
        width={containerWidth}
        height={height}
        viewBox={`0 0 ${containerWidth} ${height}`}
        className="block"
        role="img"
      >
        {slices.map(({ item, idx, start, end }) => {
          const isHovered = hoverIdx === idx;
          const rOut = isHovered ? maxR + 4 : maxR;
          const d = buildDonutSlicePath(cx, cy, innerR, rOut, start, end);
          return (
            <path
              key={item.key}
              d={d}
              fill={item.color}
              stroke="#ffffff"
              strokeWidth={2}
              className="cursor-pointer transition-opacity duration-150"
              opacity={hoverIdx === null || isHovered ? 1 : 0.78}
              onMouseEnter={() => setHoverIdx(idx)}
              onClick={() => setHoverIdx((prev) => (prev === idx ? null : idx))}
            />
          );
        })}
      </svg>

      {hovered && renderTooltip && (
        <div className="pointer-events-none absolute top-2 right-2 z-20">
          {renderTooltip(hovered)}
        </div>
      )}
    </div>
  );
}

export interface HorizontalBarItem {
  key: string;
  label: string;
  value: number;
  color: string;
}

export interface SvgHorizontalBarChartProps<T extends HorizontalBarItem> {
  data: T[];
  height?: number;
  maxValue?: number;
  formatXTick?: (val: number) => string;
  formatBarLabel?: (val: number) => string;
  renderTooltip?: (item: T) => React.ReactNode;
}

export function SvgHorizontalBarChart<T extends HorizontalBarItem>({
  data,
  height = 240,
  maxValue = 100,
  formatXTick = (v) => `${v}%`,
  formatBarLabel = (v) => `${v.toFixed(1)}%`,
  renderTooltip,
}: SvgHorizontalBarChartProps<T>) {
  const [containerRef, containerWidth] = useElementWidth(380);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const margin = { top: 8, right: 54, bottom: 26, left: 112 };
  const plotW = Math.max(80, containerWidth - margin.left - margin.right);
  const plotH = Math.max(80, height - margin.top - margin.bottom);

  const scale = useMemo(
    () => computeNiceScale([0, maxValue], { fixedDomain: [0, maxValue], tickCount: 5 }),
    [maxValue]
  );

  const count = Math.max(1, data.length);
  const rowH = plotH / count;
  const barH = Math.max(12, Math.min(24, rowH * 0.62));
  const hovered = hoverIdx !== null && data[hoverIdx] ? data[hoverIdx] : null;

  return (
    <div
      ref={containerRef}
      className="relative w-full select-none"
      style={{ height }}
      onMouseLeave={() => setHoverIdx(null)}
    >
      <svg
        width={containerWidth}
        height={height}
        viewBox={`0 0 ${containerWidth} ${height}`}
        className="block"
        role="img"
      >
        {/* Vertical Gridlines + X Ticks */}
        {scale.ticks.map((tick, idx) => {
          const x = margin.left + (tick / (scale.max || 1)) * plotW;
          return (
            <g key={`xtick-${idx}`}>
              <line
                x1={x}
                x2={x}
                y1={margin.top}
                y2={margin.top + plotH}
                stroke="#e2e8f0"
                strokeDasharray="3 3"
                strokeWidth={1}
              />
              <text
                x={x}
                y={margin.top + plotH + 16}
                textAnchor="middle"
                fill="#475569"
                fontSize={11}
                fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
              >
                {formatXTick(tick)}
              </text>
            </g>
          );
        })}

        {/* Axis Lines */}
        <line
          x1={margin.left}
          x2={margin.left}
          y1={margin.top}
          y2={margin.top + plotH}
          stroke="#cbd5e1"
          strokeWidth={1}
        />
        <line
          x1={margin.left}
          x2={margin.left + plotW}
          y1={margin.top + plotH}
          y2={margin.top + plotH}
          stroke="#cbd5e1"
          strokeWidth={1}
        />

        {/* Horizontal Bars */}
        {data.map((item, idx) => {
          const cy = margin.top + rowH * idx + rowH / 2;
          const y = cy - barH / 2;
          const clamped = Math.max(0, Math.min(scale.max, Number(item.value) || 0));
          const w = (clamped / (scale.max || 1)) * plotW;
          const isHovered = hoverIdx === idx;
          const shortLabel =
            item.label.length > 15 ? `${item.label.slice(0, 14)}…` : item.label;

          return (
            <g
              key={item.key}
              className="cursor-pointer"
              onMouseEnter={() => setHoverIdx(idx)}
              onClick={() => setHoverIdx((prev) => (prev === idx ? null : idx))}
            >
              <rect
                x={0}
                y={margin.top + rowH * idx}
                width={containerWidth}
                height={rowH}
                fill={isHovered ? '#f8fafc' : 'transparent'}
              />
              <text
                x={margin.left - 8}
                y={cy + 4}
                textAnchor="end"
                fill="#1e293b"
                fontSize={11}
                fontWeight={600}
              >
                {shortLabel}
              </text>
              <rect
                x={margin.left}
                y={y}
                width={Math.max(2, w)}
                height={barH}
                rx={5}
                ry={5}
                fill={item.color}
                opacity={hoverIdx === null || isHovered ? 1 : 0.8}
              />
              <text
                x={margin.left + Math.max(2, w) + 6}
                y={cy + 4}
                textAnchor="start"
                fill="#0f172a"
                fontSize={11}
                fontWeight={700}
                fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
              >
                {formatBarLabel(Number(item.value) || 0)}
              </text>
            </g>
          );
        })}
      </svg>

      {hovered && renderTooltip && (
        <div className="pointer-events-none absolute top-2 right-2 z-20">
          {renderTooltip(hovered)}
        </div>
      )}
    </div>
  );
}
