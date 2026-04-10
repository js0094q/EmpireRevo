"use client";

import { useState } from "react";
import { Badge } from "@/components/primitives/Badge";
import { Button } from "@/components/primitives/Button";
import { Input } from "@/components/primitives/Input";
import { Panel } from "@/components/primitives/Panel";
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

  return (
    <div className={styles.toolbar}>
      <div className={styles.toolbarTop}>
        <div className={styles.toolbarField}>
          <span className={styles.toolbarLabel}>League</span>
          <Select value={value.league} onChange={(event) => onChange({ league: event.target.value })}>
            <option value="nba">NBA</option>
            <option value="nfl">NFL</option>
            <option value="nhl">NHL</option>
            <option value="ncaab">NCAAB</option>
            <option value="mlb">MLB</option>
          </Select>
        </div>
        <div className={styles.toolbarField}>
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
        <div className={styles.toolbarField}>
          <span className={styles.toolbarLabel}>Model</span>
          <Select value={value.model} onChange={(event) => onChange({ model: event.target.value as FilterValue["model"] })}>
            <option value="weighted">Weighted</option>
            <option value="sharp">Sharp</option>
            <option value="equal">Equal</option>
          </Select>
        </div>
        <div className={styles.toolbarField}>
          <span className={styles.toolbarLabel}>Min Books</span>
          <Select value={`${value.minBooks}`} onChange={(event) => onChange({ minBooks: Number(event.target.value) })}>
            {[2, 3, 4, 5, 6].map((count) => (
              <option key={count} value={count}>
                {count}
              </option>
            ))}
          </Select>
        </div>
        <div className={`${styles.toolbarField} ${styles.toolbarFieldWide}`}>
          <span className={styles.toolbarLabel}>Search</span>
          <Input value={value.search} onChange={(event) => onChange({ search: event.target.value })} placeholder="Team, market, book" />
        </div>
      </div>

      <div className={styles.toolbarBottom}>
        <div className={styles.toolbarField}>
          <span className={styles.toolbarLabel}>Sort</span>
          <Select value={value.sort} onChange={(event) => onChange({ sort: event.target.value as BoardSortValue })}>
            <option value="score">Rank</option>
            <option value="edge">Edge</option>
            <option value="confidence">Confidence</option>
            <option value="soonest">Start Time</option>
            <option value="timing">Timing</option>
            <option value="pinned_score">Pinned Score</option>
          </Select>
        </div>
        <div className={styles.toolbarField}>
          <span className={styles.toolbarLabel}>Edge Floor</span>
          <Select value={`${value.edgeThresholdPct}`} onChange={(event) => onChange({ edgeThresholdPct: Number(event.target.value) })}>
            {[0, 0.5, 1, 1.5, 2].map((threshold) => (
              <option key={threshold} value={threshold}>
                {threshold.toFixed(1)}%
              </option>
            ))}
          </Select>
        </div>
        <div className={styles.toolbarField}>
          <span className={styles.toolbarLabel}>State</span>
          <div className={styles.toggleRow}>
            <Button type="button" onClick={() => onChange({ includeStale: !value.includeStale })} variant={value.includeStale ? "primary" : "default"}>
              {value.includeStale ? "Including Stale" : "Hide Stale"}
            </Button>
            <Button type="button" onClick={() => onChange({ pinnedOnly: !value.pinnedOnly })} variant={value.pinnedOnly ? "primary" : "default"}>
              {value.pinnedOnly ? "Pinned Only" : "All Books"}
            </Button>
          </div>
        </div>
        <div className={styles.toolbarField}>
          <span className={styles.toolbarLabel}>Density</span>
          <div className={styles.toggleRow}>
            <Button type="button" onClick={() => onChange({ compactMode: !value.compactMode })} variant={value.compactMode ? "primary" : "default"}>
              {value.compactMode ? "Compact" : "Comfortable"}
            </Button>
          </div>
        </div>
        <div className={styles.toolbarField}>
          <span className={styles.toolbarLabel}>Preferences</span>
          <div className={styles.toggleRow}>
            <Button type="button" onClick={() => setShowPreferences((current) => !current)}>
              {showPreferences ? "Hide" : "Show"}
            </Button>
            <Badge tone="accent">{preferencesLabel}</Badge>
          </div>
        </div>
      </div>

      {showPreferences ? (
        <Panel>
          <div className={styles.preferences}>
            <div className={styles.summaryLine}>
              <strong>Preferences</strong>
              <Button type="button" variant="primary" onClick={onSaveDefaults}>
                Save Defaults
              </Button>
            </div>
            <div className={styles.preferencesGrid}>
              <div className={styles.toolbarField}>
                <span className={styles.toolbarLabel}>Default League</span>
                <Select value={value.league} onChange={(event) => onChange({ league: event.target.value })}>
                  <option value="nba">NBA</option>
                  <option value="nfl">NFL</option>
                  <option value="nhl">NHL</option>
                  <option value="ncaab">NCAAB</option>
                  <option value="mlb">MLB</option>
                </Select>
              </div>
              <div className={styles.toolbarField}>
                <span className={styles.toolbarLabel}>Default Model</span>
                <Select value={value.model} onChange={(event) => onChange({ model: event.target.value as FilterValue["model"] })}>
                  <option value="weighted">Weighted</option>
                  <option value="sharp">Sharp</option>
                  <option value="equal">Equal</option>
                </Select>
              </div>
              <div className={styles.toolbarField}>
                <span className={styles.toolbarLabel}>Default Min Books</span>
                <Select value={`${value.minBooks}`} onChange={(event) => onChange({ minBooks: Number(event.target.value) })}>
                  {[2, 3, 4, 5, 6].map((count) => (
                    <option key={count} value={count}>
                      {count}
                    </option>
                  ))}
                </Select>
              </div>
              <div className={styles.toolbarField}>
                <span className={styles.toolbarLabel}>Default Density</span>
                <Button type="button" onClick={() => onChange({ compactMode: !value.compactMode })} variant={value.compactMode ? "primary" : "default"}>
                  {value.compactMode ? "Compact" : "Comfortable"}
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
        </Panel>
      ) : null}
    </div>
  );
}
