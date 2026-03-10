export type ChartPoint = { ts: number; priceAmerican: number };
export type ChartSeries = {
  id: string;
  label: string;
  color: string;
  points: ChartPoint[];
};

type SparklineProps = {
  series: ChartSeries[];
  compact?: boolean;
};

export function Sparkline({ series, compact = true }: SparklineProps) {
  const usable = series.filter((entry) => entry.points.length >= 2);
  if (!usable.length) return <div className="sparkline-placeholder">--</div>;

  const allPoints = usable.flatMap((entry) => entry.points);
  const minTs = Math.min(...allPoints.map((entry) => entry.ts));
  const maxTs = Math.max(...allPoints.map((entry) => entry.ts));
  const minPrice = Math.min(...allPoints.map((entry) => entry.priceAmerican));
  const maxPrice = Math.max(...allPoints.map((entry) => entry.priceAmerican));
  const tsRange = Math.max(1, maxTs - minTs);
  const priceRange = Math.max(1, maxPrice - minPrice);

  const height = compact ? 26 : 86;
  const width = 100;
  const strokeWidth = compact ? 2.8 : 1.8;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className={compact ? "sparkline" : "sparkline-lg"} role="img" aria-label="Odds movement history">
      {usable.map((entry) => {
        const polyline = entry.points
          .map((point) => {
            const x = ((point.ts - minTs) / tsRange) * width;
            const y = height - ((point.priceAmerican - minPrice) / priceRange) * height;
            return `${x},${y}`;
          })
          .join(" ");
        const last = entry.points[entry.points.length - 1];
        const lastX = ((last.ts - minTs) / tsRange) * width;
        const lastY = height - ((last.priceAmerican - minPrice) / priceRange) * height;
        return (
          <g key={entry.id}>
            <polyline points={polyline} fill="none" stroke={entry.color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
            <circle cx={lastX} cy={lastY} r={compact ? 2.4 : 1.9} fill={entry.color} />
          </g>
        );
      })}
    </svg>
  );
}
