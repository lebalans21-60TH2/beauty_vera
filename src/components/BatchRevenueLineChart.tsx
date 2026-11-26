import { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { TrendingUp } from 'lucide-react';
import { formatDateVi, formatVnd } from '../lib/format';

export interface BatchRevenuePoint {
  date: string;
  dailyRevenue: number;
  cumulativeRevenue: number;
  dailyQty: number;
  cumulativeQty: number;
}

export interface BatchRevenueSeries {
  batchId: string;
  batchCode: string;
  productName: string;
  sku: string;
  totalActualRevenue: number;
  totalSoldQty: number;
  dailyPoints: BatchRevenuePoint[];
}

interface BatchRevenueLineChartProps {
  dates: string[];
  series: BatchRevenueSeries[];
  highlightedBatchId?: string | null;
  onSelectBatch?: (batchId: string | null) => void;
}

const SERIES_COLORS = [
  '#C81E3A', // Crimson
  '#090D16', // Midnight Ink
  '#0F766E', // Deep Teal
  '#B45309', // Amber Ochre
  '#4338CA', // Indigo Slate
  '#6D28D9', // Plum
];

function formatCompactVnd(value: number): string {
  if (value <= 0) return '0 ₫';
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, '')}tr`;
  }
  if (value >= 1_000) {
    return `${Math.round(value / 1_000)}k`;
  }
  return `${Math.round(value)}`;
}

function formatShortDate(isoDate: string): string {
  const parts = isoDate.slice(0, 10).split('-');
  if (parts.length !== 3) return isoDate;
  return `${parts[2]}/${parts[1]}`;
}

export function BatchRevenueLineChart({
  dates,
  series,
  highlightedBatchId = null,
  onSelectBatch,
}: BatchRevenueLineChartProps) {
  const [metricMode, setMetricMode] = useState<'cumulative' | 'daily'>('cumulative');
  const [hiddenBatchIds, setHiddenBatchIds] = useState<string[]>([]);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const visibleSeries = useMemo(() => {
    const active = series.filter((s) => !hiddenBatchIds.includes(s.batchId));
    if (highlightedBatchId) {
      const focused = active.filter((s) => s.batchId === highlightedBatchId);
      if (focused.length > 0) return focused;
    }
    return active;
  }, [series, hiddenBatchIds, highlightedBatchId]);

  const toggleSeriesVisibility = (batchId: string) => {
    setHiddenBatchIds((prev) =>
      prev.includes(batchId) ? prev.filter((id) => id !== batchId) : [...prev, batchId]
    );
  };

  // SVG Geometry
  const width = 760;
  const height = 240;
  const padLeft = 56;
  const padRight = 24;
  const padTop = 18;
  const padBottom = 34;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  const maxValue = useMemo(() => {
    let peak = 0;
    for (const s of visibleSeries) {
      for (const pt of s.dailyPoints) {
        const val = metricMode === 'cumulative' ? pt.cumulativeRevenue : pt.dailyRevenue;
        if (val > peak) peak = val;
      }
    }
    if (peak <= 0) return 100_000;
    // Nice ceiling step (~15% headroom)
    return Math.ceil((peak * 1.15) / 10_000) * 10_000;
  }, [visibleSeries, metricMode]);

  const yTicks = useMemo(
    () => [0, 0.25, 0.5, 0.75, 1].map((ratio) => Math.round(maxValue * ratio)),
    [maxValue]
  );

  const getX = (index: number) => {
    if (dates.length <= 1) return padLeft + plotW / 2;
    return padLeft + (index / (dates.length - 1)) * plotW;
  };

  const getY = (val: number) => {
    const ratio = Math.max(0, Math.min(1, val / maxValue));
    return padTop + plotH - ratio * plotH;
  };

  const activeHoverIdx =
    hoveredIdx !== null && hoveredIdx >= 0 && hoveredIdx < dates.length ? hoveredIdx : null;

  return (
    <div className="border-b border-zinc-200 bg-white p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-[#C81E3A]" />
          <div>
            <h4 className="text-xs font-semibold text-[#1A1917]">
              Biểu đồ xu hướng doanh thu theo từng lô hàng
            </h4>
            <p className="text-[11px] text-[#6B665E]">
              Di chuột lên mốc ngày để đối chiếu doanh thu thực tế của từng mã lô; nhấn vào chú thích để ẩn/hiện lô.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {highlightedBatchId && onSelectBatch && (
            <button
              type="button"
              onClick={() => onSelectBatch(null)}
              className="px-2.5 py-1.5 text-[11px] font-mono border border-[#C81E3A] text-[#C81E3A] hover:bg-[#FFF1F2] rounded-md transition-colors"
            >
              Hiện lại tất cả lô
            </button>
          )}
          <div className="flex items-center border border-zinc-200 rounded-lg bg-[#FAF8F5] text-[11px] overflow-hidden">
            <button
              type="button"
              onClick={() => setMetricMode('cumulative')}
              className={`px-3 py-1.5 font-medium transition-colors ${
                metricMode === 'cumulative'
                  ? 'bg-[#1A1917] text-white'
                  : 'text-[#6B665E] hover:text-[#1A1917]'
              }`}
            >
              Lũy kế
            </button>
            <button
              type="button"
              onClick={() => setMetricMode('daily')}
              className={`px-3 py-1.5 font-medium border-l border-zinc-200 transition-colors ${
                metricMode === 'daily'
                  ? 'bg-[#1A1917] text-white'
                  : 'text-[#6B665E] hover:text-[#1A1917]'
              }`}
            >
              Theo ngày
            </button>
          </div>
        </div>
      </div>

      {/* Interactive Legend Pills */}
      {series.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-[11px]">
          {series.map((s, idx) => {
            const color = SERIES_COLORS[idx % SERIES_COLORS.length];
            const isHidden = hiddenBatchIds.includes(s.batchId);
            const isFocused = highlightedBatchId === s.batchId;
            return (
              <button
                key={`legend-${s.batchId}`}
                type="button"
                onClick={() => toggleSeriesVisibility(s.batchId)}
                className={`inline-flex items-center gap-2 px-2.5 py-1 border rounded-md font-mono transition-colors ${
                  isHidden
                    ? 'border-zinc-200 bg-zinc-50 text-zinc-400 line-through'
                    : isFocused
                      ? 'border-[#C81E3A] bg-[#FFF1F2] text-[#1A1917] font-semibold'
                      : 'border-zinc-200 bg-[#FAF8F5] text-[#1A1917] hover:border-zinc-400'
                }`}
              >
                <span
                  className="w-2.5 h-2.5 shrink-0"
                  style={{ backgroundColor: isHidden ? '#D4D4D8' : color }}
                />
                <span>{s.batchCode}</span>
                <span className="text-[#6B665E] tabular-nums">
                  ({formatCompactVnd(s.totalActualRevenue)})
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Responsive SVG Multi-Series Line Chart */}
      <div className="relative w-full">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto overflow-visible select-none"
          role="img"
          aria-label="Biểu đồ đường xu hướng doanh thu theo từng lô hàng"
          onMouseLeave={() => setHoveredIdx(null)}
        >
          {/* Horizontal Gridlines & Y-Axis Ticks */}
          {yTicks.map((tick) => {
            const y = getY(tick);
            return (
              <g key={`y-tick-${tick}`}>
                <line
                  x1={padLeft}
                  y1={y}
                  x2={width - padRight}
                  y2={y}
                  stroke="#E4E4E7"
                  strokeDasharray={tick === 0 ? undefined : '3 3'}
                  strokeWidth={1}
                />
                <text
                  x={padLeft - 8}
                  y={y + 3.5}
                  textAnchor="end"
                  className="fill-[#6B665E] text-[10px] font-mono"
                >
                  {formatCompactVnd(tick)}
                </text>
              </g>
            );
          })}

          {/* X-Axis Labels */}
          {dates.map((date, idx) => {
            const showLabel =
              dates.length <= 10 ||
              idx === 0 ||
              idx === dates.length - 1 ||
              idx % Math.ceil(dates.length / 7) === 0;
            if (!showLabel) return null;
            const x = getX(idx);
            return (
              <text
                key={`x-tick-${date}`}
                x={x}
                y={height - 10}
                textAnchor="middle"
                className="fill-[#6B665E] text-[10px] font-mono"
              >
                {formatShortDate(date)}
              </text>
            );
          })}

          {/* Vertical Hover Crosshair */}
          {activeHoverIdx !== null && (
            <line
              x1={getX(activeHoverIdx)}
              y1={padTop}
              x2={getX(activeHoverIdx)}
              y2={padTop + plotH}
              stroke="#090D16"
              strokeWidth={1}
              strokeDasharray="3 3"
              opacity={0.45}
            />
          )}

          {/* Series Polylines & Data Points */}
          {visibleSeries.map((s) => {
            const originalIdx = series.findIndex((item) => item.batchId === s.batchId);
            const color = SERIES_COLORS[(originalIdx >= 0 ? originalIdx : 0) % SERIES_COLORS.length];

            const points = s.dailyPoints.map((pt, i) => {
              const val = metricMode === 'cumulative' ? pt.cumulativeRevenue : pt.dailyRevenue;
              return { x: getX(i), y: getY(val), val, pt };
            });

            const pathD = points
              .map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
              .join(' ');

            return (
              <g key={`series-${s.batchId}`}>
                <motion.path
                  d={pathD}
                  fill="none"
                  stroke={color}
                  strokeWidth={2.25}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  initial={{ pathLength: 0, opacity: 0.4 }}
                  animate={{ pathLength: 1, opacity: 1 }}
                  transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
                />

                {points.map((p, i) => {
                  const isHovered = activeHoverIdx === i;
                  const showPoint = isHovered || p.pt.dailyRevenue > 0 || i === points.length - 1;
                  if (!showPoint) return null;
                  return (
                    <circle
                      key={`pt-${s.batchId}-${p.pt.date}`}
                      cx={p.x}
                      cy={p.y}
                      r={isHovered ? 4.5 : 3}
                      fill={isHovered ? '#FFFFFF' : color}
                      stroke={color}
                      strokeWidth={isHovered ? 2.5 : 1.5}
                    />
                  );
                })}
              </g>
            );
          })}

          {/* Invisible Interactive Columns for Smooth Hover Detection */}
          {dates.map((date, idx) => {
            const colWidth = dates.length <= 1 ? plotW : plotW / Math.max(1, dates.length - 1);
            const xCenter = getX(idx);
            const xStart = Math.max(padLeft, xCenter - colWidth / 2);
            const xEnd = Math.min(width - padRight, xCenter + colWidth / 2);
            return (
              <rect
                key={`hit-${date}`}
                x={xStart}
                y={padTop}
                width={Math.max(4, xEnd - xStart)}
                height={plotH}
                fill="transparent"
                className="cursor-crosshair"
                onMouseEnter={() => setHoveredIdx(idx)}
              />
            );
          })}
        </svg>

        {/* Floating Tooltip Card on Hover */}
        {activeHoverIdx !== null && dates[activeHoverIdx] && (
          <div
            className={`pointer-events-none absolute top-2 z-10 w-64 bg-[#090D16] text-white border border-zinc-700 shadow-xl p-3 text-[11px] space-y-2 ${
              activeHoverIdx > dates.length / 2 ? 'left-3' : 'right-3'
            }`}
          >
            <div className="flex items-center justify-between border-b border-zinc-800 pb-1.5 font-mono">
              <span className="text-zinc-300">Ngày {formatDateVi(dates[activeHoverIdx])}</span>
              <span className="text-[#C81E3A] uppercase">
                {metricMode === 'cumulative' ? 'Lũy kế' : 'Trong ngày'}
              </span>
            </div>
            <div className="space-y-1.5">
              {visibleSeries.map((s) => {
                const originalIdx = series.findIndex((item) => item.batchId === s.batchId);
                const color =
                  SERIES_COLORS[(originalIdx >= 0 ? originalIdx : 0) % SERIES_COLORS.length];
                const pt = s.dailyPoints[activeHoverIdx];
                if (!pt) return null;
                const val = metricMode === 'cumulative' ? pt.cumulativeRevenue : pt.dailyRevenue;
                const qty = metricMode === 'cumulative' ? pt.cumulativeQty : pt.dailyQty;
                return (
                  <div
                    key={`tt-${s.batchId}`}
                    className="flex items-center justify-between gap-2"
                  >
                    <span className="flex items-center gap-1.5 min-w-0">
                      <span
                        className="w-2 h-2 shrink-0"
                        style={{ backgroundColor: color }}
                      />
                      <span className="font-mono truncate">{s.batchCode}</span>
                    </span>
                    <span className="font-mono tabular-nums text-right shrink-0">
                      <strong>{formatVnd(val)}</strong>
                      <span className="text-zinc-400 ml-1">({qty} sp)</span>
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
