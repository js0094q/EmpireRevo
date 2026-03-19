"use client";

import { useMemo, useState } from "react";
import { Sparkline, type ChartSeries } from "@/components/board/Sparkline";
import type { MarketTimelineResponse, MarketPressureSignal } from "@/lib/server/odds/types";

type ViewMode = "fair" | "global" | "pinned" | "books";

const COLORS = ["#7ce3bf", "#d5dce7", "#a8b2c2", "#ff8d8d", "#8f9daf"];

function byBook(timeline: MarketTimelineResponse): Map<string, Array<{ ts: number; priceAmerican: number }>> {
  const map = new Map<string, Array<{ ts: number; priceAmerican: number }>>();
  for (const point of timeline.books) {
    if (!Number.isFinite(point.american)) continue;
    const rows = map.get(point.bookKey) || [];
    rows.push({ ts: point.ts, priceAmerican: Number(point.american) });
    map.set(point.bookKey, rows);
  }
  for (const [key, rows] of map.entries()) {
    rows.sort((a, b) => a.ts - b.ts);
    map.set(key, rows);
  }
  return map;
}

function singleSeries(timeline: MarketTimelineResponse, key: "fairAmerican" | "globalBestAmerican" | "pinnedBestAmerican", label: string): ChartSeries[] {
  const points = timeline.points
    .map((point) => ({
      ts: point.ts,
      priceAmerican: Number(point[key])
    }))
    .filter((point) => Number.isFinite(point.priceAmerican));

  if (points.length < 2) return [];

  return [
    {
      id: key,
      label,
      color: COLORS[0],
      points
    }
  ];
}

export function EventTimelinePanel({
  outcome,
  timeline,
  pressureSignals
}: {
  outcome: string;
  timeline: MarketTimelineResponse | null;
  pressureSignals: MarketPressureSignal[];
}) {
  const [mode, setMode] = useState<ViewMode>("fair");

  const bookSeries = useMemo(() => {
    if (!timeline) return [] as ChartSeries[];
    const grouped = byBook(timeline);
    return Array.from(grouped.entries())
      .sort((a, b) => b[1].length - a[1].length)
      .slice(0, 4)
      .map((entry, idx) => ({
        id: entry[0],
        label: entry[0],
        color: COLORS[idx % COLORS.length],
        points: entry[1]
      }));
  }, [timeline]);

  const series = useMemo(() => {
    if (!timeline) return [] as ChartSeries[];
    if (mode === "fair") return singleSeries(timeline, "fairAmerican", "Fair");
    if (mode === "global") return singleSeries(timeline, "globalBestAmerican", "Global Best");
    if (mode === "pinned") return singleSeries(timeline, "pinnedBestAmerican", "Pinned Best");
    return bookSeries;
  }, [bookSeries, mode, timeline]);

  const historyPoints = timeline?.points.length || 0;

  return (
    <section className="detail-section timeline-panel">
      <h3>{outcome} · Historical Timeline</h3>
      {!timeline ? <p className="muted">Persistence unavailable.</p> : null}
      {timeline && historyPoints < 2 ? <p className="muted">Insufficient history (fewer than 2 persisted snapshots).</p> : null}

      {timeline ? (
        <>
          <div className="timeline-controls">
            <button className={mode === "fair" ? "active" : ""} onClick={() => setMode("fair")}>Fair</button>
            <button className={mode === "global" ? "active" : ""} onClick={() => setMode("global")}>Global Best</button>
            <button className={mode === "pinned" ? "active" : ""} onClick={() => setMode("pinned")}>Pinned Best</button>
            <button className={mode === "books" ? "active" : ""} onClick={() => setMode("books")}>Books</button>
          </div>
          <Sparkline series={series} compact={false} />
          <div className="timeline-meta">
            Snapshots {historyPoints} · Open {timeline.openTs ? new Date(timeline.openTs).toLocaleString() : "--"} · Current {new Date(timeline.currentTs).toLocaleString()}
          </div>
        </>
      ) : null}

      {pressureSignals.length ? (
        <div className="detail-table">
          {pressureSignals.map((signal) => (
            <div key={`${outcome}-${signal.label}`} className="detail-row slim">
              <span>
                {signal.label} ({signal.severity})
              </span>
              <small>{signal.explanation}</small>
            </div>
          ))}
        </div>
      ) : (
        <p className="muted">No descriptive pressure values from current persisted history.</p>
      )}
    </section>
  );
}
