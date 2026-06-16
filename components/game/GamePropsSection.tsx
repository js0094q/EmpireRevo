"use client";

import { useEffect, useMemo, useState } from "react";
import { formatAmericanOdds, formatBookCount, formatUpdatedLabel } from "@/lib/ui/formatters/display";
import type { PropBoardRow, PropsBoardData } from "@/lib/server/odds/propsService";
import type { PropsDisplayState } from "@/lib/ui/propsDisplay";
import styles from "./detail.module.css";

type PropsApiResponse = PropsBoardData & {
  ok: true;
  emptyState: PropsDisplayState;
};

function isPropsApiResponse(value: unknown): value is PropsApiResponse {
  return Boolean(value && typeof value === "object" && "ok" in value && (value as { ok?: unknown }).ok === true);
}

function rowLine(row: PropBoardRow): string {
  return Number.isFinite(row.line) ? `${row.line}` : "—";
}

export function GamePropsSection({
  league,
  eventId,
  fallback
}: {
  league: string;
  eventId: string | null;
  fallback: PropsDisplayState;
}) {
  const [data, setData] = useState<PropsApiResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!eventId) {
      return;
    }
    const controller = new AbortController();
    const params = new URLSearchParams({
      league,
      eventId,
      propType: "player"
    });
    fetch(`/api/props?${params.toString()}`, {
      signal: controller.signal,
      cache: "no-store"
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("Prop markets could not be loaded.");
        const payload: unknown = await response.json();
        if (!isPropsApiResponse(payload)) throw new Error("Prop markets could not be loaded.");
        setData(payload);
        setError(null);
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return;
        setError(cause instanceof Error ? cause.message : "Prop markets could not be loaded.");
      });
    return () => controller.abort();
  }, [eventId, league]);

  const loading = Boolean(eventId && !data && !error);

  const state = useMemo(() => {
    if (error) {
      return {
        ...fallback,
        title: "Prop markets could not be loaded.",
        message: "The main game markets remain available; refresh or try again later."
      };
    }
    return data?.emptyState ?? fallback;
  }, [data?.emptyState, error, fallback]);

  const rows = data?.rows ?? [];

  return (
    <div className={styles.section}>
      <div>
        <h2 className={styles.sectionTitle}>Props</h2>
        <p className={styles.note}>{loading ? "Loading event-level prop markets." : state.title}</p>
      </div>
      {rows.length ? (
        <div className={styles.propsTableWrap}>
          <table className={styles.propsTable}>
            <thead>
              <tr>
                <th>Market</th>
                <th>Selection</th>
                <th>Best</th>
                <th>Books</th>
                <th>Status</th>
                <th>Updated</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 12).map((row) => (
                <tr key={row.id}>
                  <td>
                    <strong>{row.market}</strong>
                    <span>Line {rowLine(row)}</span>
                  </td>
                  <td>{row.selection}</td>
                  <td>
                    <strong>{formatAmericanOdds(row.bestPrice)}</strong>
                    <span>{row.bestBook}</span>
                  </td>
                  <td>{formatBookCount(row.bookCount)}</td>
                  <td>{row.status}</td>
                  <td>{formatUpdatedLabel(row.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <>
          <div className={styles.propsMeta} aria-label="Props display mode">
            <span>
              <small>Mode</small>
              <strong>{state.evVisible ? "EV eligible" : "Line shopping"}</strong>
            </span>
            {state.metrics.map((metric) => (
              <span key={metric}>
                <small>{metric}</small>
                <strong>{loading ? "Loading" : "Pending"}</strong>
              </span>
            ))}
          </div>
          <p className={styles.note}>{state.message}</p>
        </>
      )}
    </div>
  );
}
