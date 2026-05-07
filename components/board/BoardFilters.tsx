"use client";

import { useState } from "react";
import { Badge } from "@/components/primitives/Badge";
import { Button } from "@/components/primitives/Button";
import { Input } from "@/components/primitives/Input";
import { Select } from "@/components/primitives/Select";
import { Tabs } from "@/components/primitives/Tabs";
import type { BoardSortValue } from "@/lib/ui/view-models/boardViewModel";
import styles from "./workstation.module.css";

type FilterValue = {
  league: string;
  market: "h2h" | "spreads" | "totals";
  model: "sharp" | "equal" | "weighted";
  minBooks: number;
  search: string;
  sort: BoardSortValue;
  edgeThresholdPct: number;
  includeStale: boolean;
  pinnedOnly: boolean;
  compactMode: boolean;
  pinnedBooks: string[];
};

export function BoardFilters({
  value,
  books,
  onChange,
  onSaveDefaults,
  preferencesLabel
}: {
  value: FilterValue;
  books: Array<{ key: string; title: string; tier: string }>;
  onChange: (next: Partial<FilterValue>) => void;
  onSaveDefaults: () => void;
  preferencesLabel: string;
}) {
  const [showPreferences, setShowPreferences] = useState(false);
  const staleLabel = value.includeStale ? "Stale on" : "Stale off";
  const pinnedLabel = value.pinnedOnly ? "Pinned" : "All";
  const densityLabel = value.compactMode ? "Compact" : "Comfort";

  return (
    <div className={styles.toolbar} aria-label="Board controls">
      <div className={styles.controlGrid}>
        <label className={styles.toolbarField}>
          <span className={styles.toolbarLabel}>League</span>
          <Select value={value.league} onChange={(event) => onChange({ league: event.target.value })}>
            <option value="nba">NBA</option>
            <option value="nfl">NFL</option>
            <option value="nhl">NHL</option>
            <option value="ncaab">NCAAB</option>
            <option value="mlb">MLB</option>
          </Select>
        </label>
        <div className={`${styles.toolbarField} ${styles.marketField}`}>
          <span className={styles.toolbarLabel}>Market</span>
          <Tabs
            value={value.market}
            options={[
              { value: "h2h", label: "Moneyline" },
              { value: "spreads", label: "Spread" },
              { value: "totals", label: "Total" }
            ]}
            onChange={(market) => onChange({ market: market as FilterValue["market"] })}
          />
        </div>
        <label className={styles.toolbarField}>
          <span className={styles.toolbarLabel}>Model</span>
          <Select value={value.model} onChange={(event) => onChange({ model: event.target.value as FilterValue["model"] })}>
            <option value="weighted">Weighted</option>
            <option value="sharp">Sharp</option>
            <option value="equal">Equal</option>
          </Select>
        </label>
        <label className={styles.toolbarField}>
          <span className={styles.toolbarLabel}>Min</span>
          <Select value={`${value.minBooks}`} onChange={(event) => onChange({ minBooks: Number(event.target.value) })}>
            {[2, 3, 4, 5, 6].map((count) => (
              <option key={count} value={count}>
                {count}
              </option>
            ))}
          </Select>
        </label>
        <label className={`${styles.toolbarField} ${styles.searchField}`}>
          <span className={styles.toolbarLabel}>Search</span>
          <Input value={value.search} onChange={(event) => onChange({ search: event.target.value })} placeholder="Team, market, book" />
        </label>
        <label className={styles.toolbarField}>
          <span className={styles.toolbarLabel}>Sort</span>
          <Select value={value.sort} onChange={(event) => onChange({ sort: event.target.value as BoardSortValue })}>
            <option value="score">Rank</option>
            <option value="edge">Edge</option>
            <option value="confidence">Confidence</option>
            <option value="soonest">Start Time</option>
            <option value="timing">Timing</option>
            <option value="pinned_score">Pinned Score</option>
          </Select>
        </label>
        <label className={styles.toolbarField}>
          <span className={styles.toolbarLabel}>Edge Floor</span>
          <Select value={`${value.edgeThresholdPct}`} onChange={(event) => onChange({ edgeThresholdPct: Number(event.target.value) })}>
            {[0, 0.5, 1, 1.5, 2].map((threshold) => (
              <option key={threshold} value={threshold}>
                {threshold.toFixed(1)}%
              </option>
            ))}
          </Select>
        </label>
        <div className={styles.toolbarField}>
          <span className={styles.toolbarLabel}>State</span>
          <div className={styles.toggleRow}>
            <Button
              type="button"
              className={styles.controlButton}
              aria-pressed={value.includeStale}
              onClick={() => onChange({ includeStale: !value.includeStale })}
              variant={value.includeStale ? "primary" : "default"}
            >
              {staleLabel}
            </Button>
            <Button
              type="button"
              className={styles.controlButton}
              aria-pressed={value.pinnedOnly}
              onClick={() => onChange({ pinnedOnly: !value.pinnedOnly })}
              variant={value.pinnedOnly ? "primary" : "default"}
            >
              {pinnedLabel}
            </Button>
          </div>
        </div>
        <div className={styles.toolbarField}>
          <span className={styles.toolbarLabel}>Density</span>
          <div className={styles.toggleRow}>
            <Button
              type="button"
              className={styles.controlButton}
              aria-pressed={value.compactMode}
              onClick={() => onChange({ compactMode: !value.compactMode })}
              variant={value.compactMode ? "primary" : "default"}
            >
              {densityLabel}
            </Button>
          </div>
        </div>
        <div className={styles.toolbarField}>
          <span className={styles.toolbarLabel}>Books</span>
          <div className={styles.toggleRow}>
            <Button
              type="button"
              className={styles.controlButton}
              aria-expanded={showPreferences}
              onClick={() => setShowPreferences((current) => !current)}
            >
              {showPreferences ? "Hide" : "Pin"}
            </Button>
            <Badge tone="accent" className={styles.preferenceBadge}>{preferencesLabel}</Badge>
          </div>
        </div>
      </div>

      {showPreferences ? (
        <div className={styles.preferencesPanel}>
          <div className={styles.preferences}>
            <div className={styles.summaryLine}>
              <strong>Defaults</strong>
              <Button type="button" className={styles.controlButton} variant="primary" onClick={onSaveDefaults}>
                Save Defaults
              </Button>
            </div>
            <div className={styles.preferencesGrid}>
              <label className={styles.toolbarField}>
                <span className={styles.toolbarLabel}>Default League</span>
                <Select value={value.league} onChange={(event) => onChange({ league: event.target.value })}>
                  <option value="nba">NBA</option>
                  <option value="nfl">NFL</option>
                  <option value="nhl">NHL</option>
                  <option value="ncaab">NCAAB</option>
                  <option value="mlb">MLB</option>
                </Select>
              </label>
              <label className={styles.toolbarField}>
                <span className={styles.toolbarLabel}>Default Model</span>
                <Select value={value.model} onChange={(event) => onChange({ model: event.target.value as FilterValue["model"] })}>
                  <option value="weighted">Weighted</option>
                  <option value="sharp">Sharp</option>
                  <option value="equal">Equal</option>
                </Select>
              </label>
              <label className={styles.toolbarField}>
                <span className={styles.toolbarLabel}>Default Min</span>
                <Select value={`${value.minBooks}`} onChange={(event) => onChange({ minBooks: Number(event.target.value) })}>
                  {[2, 3, 4, 5, 6].map((count) => (
                    <option key={count} value={count}>
                      {count}
                    </option>
                  ))}
                </Select>
              </label>
              <div className={styles.toolbarField}>
                <span className={styles.toolbarLabel}>Default Density</span>
                <Button
                  type="button"
                  className={styles.controlButton}
                  aria-pressed={value.compactMode}
                  onClick={() => onChange({ compactMode: !value.compactMode })}
                  variant={value.compactMode ? "primary" : "default"}
                >
                  {densityLabel}
                </Button>
              </div>
            </div>
            <div className={styles.toolbarField}>
              <span className={styles.toolbarLabel}>Pinned Books</span>
              <div className={styles.bookChecks}>
                {books.map((book) => {
                  const checked = value.pinnedBooks.includes(book.key);
                  return (
                    <label key={book.key} className={styles.checkbox}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() =>
                          onChange({
                            pinnedBooks: checked ? value.pinnedBooks.filter((key) => key !== book.key) : [...value.pinnedBooks, book.key]
                          })
                        }
                      />
                      <span>{book.title}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
