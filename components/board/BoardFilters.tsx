"use client";

import { useState } from "react";
import { Badge } from "@/components/primitives/Badge";
import { Button } from "@/components/primitives/Button";
import { Input } from "@/components/primitives/Input";
import { Select } from "@/components/primitives/Select";
import { Tabs } from "@/components/primitives/Tabs";
import { PROP_MARKET_TYPE_OPTIONS, type PropType } from "@/lib/ui/propsDisplay";
import type { BoardConfidenceFilter, BoardOutcomeFilter, BoardSortValue } from "@/lib/ui/view-models/boardViewModel";
import type { PublicSportOption } from "@/lib/server/odds/sportsRegistry";
import styles from "./workstation.module.css";

type FilterValue = {
  league: string;
  market: "h2h" | "spreads" | "totals";
  model: "sharp" | "equal" | "weighted";
  minBooks: number;
  bookKey: string;
  search: string;
  sort: BoardSortValue;
  edgeThresholdPct: number;
  confidence: BoardConfidenceFilter;
  outcomeStatus: BoardOutcomeFilter;
  includeStale: boolean;
  pinnedOnly: boolean;
  compactMode: boolean;
  pinnedBooks: string[];
  marketScope: "main" | "props";
  propMarketType: PropType;
};

type ExperienceMode = "beginner" | "advanced";

export function BoardFilters({
  value,
  books,
  sports,
  onChange,
  onSaveDefaults,
  preferencesLabel,
  experienceMode,
  onModeChange,
  onRefresh,
  supportsAnyProps,
  propsDisabledReason
}: {
  value: FilterValue;
  books: Array<{ key: string; title: string; tier: string }>;
  sports: PublicSportOption[];
  onChange: (next: Partial<FilterValue>) => void;
  onSaveDefaults: () => void;
  preferencesLabel: string;
  experienceMode: ExperienceMode;
  onModeChange: (mode: ExperienceMode) => void;
  onRefresh: () => void;
  supportsAnyProps: boolean;
  propsDisabledReason?: string;
}) {
  const [showPreferences, setShowPreferences] = useState(false);
  const staleLabel = value.includeStale ? "Including stale" : "Fresh only";
  const pinnedLabel = value.pinnedOnly ? "Pinned only" : "All books";
  const densityLabel = value.compactMode ? "Compact" : "Comfort";
  const sportGroups = Array.from(new Set(sports.map((sport) => sport.group)));
  const sportOptions = sportGroups.length
    ? sportGroups.map((group) => (
        <optgroup key={group} label={group}>
          {sports
            .filter((sport) => sport.group === group)
            .map((sport) => (
              <option key={sport.key} value={sport.key}>
                {sport.label}
              </option>
            ))}
        </optgroup>
      ))
    : [
        <option key={value.league} value={value.league}>
          {value.league.toUpperCase()}
        </option>
      ];

  const tooltips = {
    search: "Search teams, outcomes, or book names.",
    league: "Switch between supported leagues.",
    market: "Choose moneyline, spread, total, or a props line-shopping view.",
    marketScope: supportsAnyProps
      ? "Props use a separate line-shopping display unless fair probability is defensible."
      : "Props are not currently supported for this league by the provider.",
    propMarketType: "Choose which prop market family to inspect.",
    mode: "Beginner keeps only the highest-impact controls.",
    sort: "Order rows by signal and decision relevance.",
    includeStale: "Include markets marked stale from feed freshness.",
    pinnedOnly: "Show only rows supported by your pinned books.",
    model: "Weight model used by board scoring.",
    minBooks: "Minimum books required for each recommendation.",
    edgeThresholdPct: "Hide low-confidence opportunities below this edge threshold.",
    confidence: "Filter by minimum signal confidence.",
    outcome: "Filter rows by settlement status.",
    book: "Restrict board rows to a single book.",
    defaults: "Persist your preferred default settings in this browser."
  };

  return (
    <div className={styles.toolbar} aria-label="Board controls">
      <div className={styles.controlGrid}>
        <label className={`${styles.toolbarField} ${styles.searchField} ${styles.searchPrimary}`}>
          <span className={styles.toolbarLabel} title={tooltips.search}>
            Search
          </span>
          <Input value={value.search} onChange={(event) => onChange({ search: event.target.value })} placeholder="Team, market, book" />
        </label>

        <div className={`${styles.filterGroup} ${styles.marketScopeGroup}`}>
          <span className={styles.filterGroupLabel}>Market Scope</span>
          <div className={styles.filterFields}>
            <label className={styles.toolbarField}>
              <span className={styles.toolbarLabel} title={tooltips.league}>
                League
              </span>
              <Select value={value.league} onChange={(event) => onChange({ league: event.target.value })}>
                {sportOptions}
              </Select>
            </label>
            <div className={`${styles.toolbarField} ${styles.marketField}`}>
              <span className={styles.toolbarLabel} title={tooltips.marketScope}>
                Board
              </span>
              <Tabs
                value={value.marketScope}
                options={[
                  { value: "main", label: "Main Lines" },
                  {
                    value: "props",
                    label: "Props",
                    disabled: !supportsAnyProps && value.marketScope !== "props"
                  }
                ]}
                onChange={(marketScope) => onChange({ marketScope: marketScope as FilterValue["marketScope"] })}
              />
            </div>
            <div className={`${styles.toolbarField} ${styles.marketField}`}>
              <span className={styles.toolbarLabel} title={tooltips.market}>
                {value.marketScope === "props" ? "Prop Type" : "Market"}
              </span>
              {value.marketScope === "props" ? (
                <Select
                  value={value.propMarketType}
                  disabled={!supportsAnyProps}
                  title={supportsAnyProps ? undefined : propsDisabledReason}
                  onChange={(event) => onChange({ propMarketType: event.target.value as PropType })}
                >
                  {PROP_MARKET_TYPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              ) : (
                <Tabs
                  value={value.market}
                  options={[
                    { value: "h2h", label: "Moneyline" },
                    { value: "spreads", label: "Spread" },
                    { value: "totals", label: "Total" }
                  ]}
                  onChange={(market) => onChange({ market: market as FilterValue["market"] })}
                />
              )}
            </div>
          </div>
        </div>

        <div className={styles.filterGroup}>
          <span className={styles.filterGroupLabel}>Display mode</span>
          <div className={styles.filterFields}>
            <label className={styles.toolbarField}>
              <span className={styles.toolbarLabel} title={tooltips.sort}>
                Sort by
              </span>
              <Select value={value.sort} onChange={(event) => onChange({ sort: event.target.value as BoardSortValue })}>
                <option value="score">Decision score</option>
                <option value="ev">Highest EV</option>
                <option value="best">Best price</option>
                <option value="confidence">Confidence</option>
                <option value="soonest">Start time</option>
                <option value="outcome">Outcome status</option>
                <option value="book">Book</option>
                <option value="coverage">Coverage</option>
                <option value="timing">Freshness</option>
                <option value="pinned_score">Pinned score</option>
              </Select>
            </label>
            <div className={styles.toolbarField}>
              <span className={styles.toolbarLabel} title={tooltips.mode}>
                Mode
              </span>
              <div className={styles.toggleRow}>
                <Button
                  type="button"
                  className={styles.controlButton}
                  aria-pressed={experienceMode === "beginner"}
                  onClick={() => onModeChange("beginner")}
                  variant={experienceMode === "beginner" ? "primary" : "default"}
                >
                  Beginner
                </Button>
                <Button
                  type="button"
                  className={styles.controlButton}
                  aria-pressed={experienceMode === "advanced"}
                  onClick={() => onModeChange("advanced")}
                  variant={experienceMode === "advanced" ? "primary" : "default"}
                >
                  Advanced
                </Button>
              </div>
            </div>
            <div className={styles.toolbarField}>
              <span className={styles.toolbarLabel}>Refresh</span>
              <div className={styles.toggleRow}>
                <Button
                  type="button"
                  className={styles.controlButton}
                  onClick={onRefresh}
                >
                  Refresh odds
                </Button>
              </div>
            </div>
          </div>
        </div>

        {experienceMode === "advanced" ? (
          <>
            <div className={styles.filterGroup}>
              <span className={styles.filterGroupLabel}>Model Controls</span>
              <div className={styles.filterFields}>
                <label className={styles.toolbarField}>
                  <span className={styles.toolbarLabel} title={tooltips.model}>
                    Model
                  </span>
                  <Select value={value.model} onChange={(event) => onChange({ model: event.target.value as FilterValue["model"] })}>
                    <option value="weighted">Weighted</option>
                    <option value="sharp">Sharp</option>
                    <option value="equal">Equal</option>
                  </Select>
                </label>
                <label className={styles.toolbarField}>
                  <span className={styles.toolbarLabel} title={tooltips.minBooks}>
                    Min Books
                  </span>
                  <Select value={`${value.minBooks}`} onChange={(event) => onChange({ minBooks: Number(event.target.value) })}>
                    {[2, 3, 4, 5, 6].map((count) => (
                      <option key={count} value={count}>
                        {count}
                      </option>
                    ))}
                  </Select>
                </label>
              </div>
            </div>

            <div className={styles.filterGroup}>
              <span className={styles.filterGroupLabel}>Quality Controls</span>
              <div className={styles.filterFields}>
                <label className={styles.toolbarField}>
                  <span className={styles.toolbarLabel} title={tooltips.edgeThresholdPct}>
                    EV Floor
                  </span>
                  <Select value={`${value.edgeThresholdPct}`} onChange={(event) => onChange({ edgeThresholdPct: Number(event.target.value) })}>
                    {[0, 0.5, 1, 1.5, 2].map((threshold) => (
                      <option key={threshold} value={threshold}>
                        {threshold.toFixed(1)}pp
                      </option>
                    ))}
                  </Select>
                </label>
                <label className={styles.toolbarField}>
                  <span className={styles.toolbarLabel} title={tooltips.confidence}>
                    Confidence
                  </span>
                  <Select value={value.confidence} onChange={(event) => onChange({ confidence: event.target.value as BoardConfidenceFilter })}>
                    <option value="all">All confidence</option>
                    <option value="high">High only</option>
                    <option value="medium">Medium+</option>
                    <option value="low">Low only</option>
                  </Select>
                </label>
                <label className={styles.toolbarField}>
                  <span className={styles.toolbarLabel} title={tooltips.outcome}>
                    Outcome
                  </span>
                  <Select value={value.outcomeStatus} onChange={(event) => onChange({ outcomeStatus: event.target.value as BoardOutcomeFilter })}>
                    <option value="all">All outcomes</option>
                    <option value="pending">Pending</option>
                    <option value="win">Win</option>
                    <option value="loss">Loss</option>
                    <option value="push">Push</option>
                    <option value="void">Void</option>
                    <option value="unknown">Unknown</option>
                  </Select>
                </label>
                <div className={styles.toolbarField}>
                  <span className={styles.toolbarLabel} title={tooltips.includeStale}>
                    State
                  </span>
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
                  </div>
                </div>
              </div>
            </div>

            <div className={styles.filterGroup}>
              <span className={styles.filterGroupLabel}>Book Controls</span>
              <div className={styles.filterFields}>
                <label className={styles.toolbarField}>
                  <span className={styles.toolbarLabel} title={tooltips.book}>
                    Book
                  </span>
                  <Select value={value.bookKey} onChange={(event) => onChange({ bookKey: event.target.value })}>
                    <option value="all">All books</option>
                    {books.map((book) => (
                      <option key={book.key} value={book.key}>
                        {book.title}
                      </option>
                    ))}
                  </Select>
                </label>
                <div className={styles.toolbarField}>
                  <span className={styles.toolbarLabel} title={tooltips.pinnedOnly}>
                    Pinned
                  </span>
                  <div className={styles.toggleRow}>
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
              </div>
            </div>

            <div className={styles.filterGroup}>
              <span className={styles.filterGroupLabel}>Settings</span>
              <div className={styles.filterFields}>
                <div className={styles.toolbarField}>
                  <span className={styles.toolbarLabel}>Pinned Books</span>
                  <div className={styles.toggleRow}>
                    <Button
                      type="button"
                      className={styles.controlButton}
                      aria-expanded={showPreferences}
                      onClick={() => setShowPreferences((current) => !current)}
                    >
                      {showPreferences ? "Hide" : "Select"}
                    </Button>
                  </div>
                </div>
                <div className={styles.toolbarField}>
                  <span className={styles.toolbarLabel} title={tooltips.defaults}>
                    Defaults
                  </span>
                  <Badge tone="accent" className={styles.preferenceBadge}>
                    {preferencesLabel}
                  </Badge>
                </div>
              </div>
            </div>
          </>
        ) : null}
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
                <span className={styles.toolbarLabel} title={tooltips.league}>
                  Default League
                </span>
                <Select value={value.league} onChange={(event) => onChange({ league: event.target.value })}>
                  {sportOptions}
                </Select>
              </label>
              <label className={styles.toolbarField}>
                <span className={styles.toolbarLabel} title={tooltips.model}>
                  Default Model
                </span>
                <Select value={value.model} onChange={(event) => onChange({ model: event.target.value as FilterValue["model"] })}>
                  <option value="weighted">Weighted</option>
                  <option value="sharp">Sharp</option>
                  <option value="equal">Equal</option>
                </Select>
              </label>
              <label className={styles.toolbarField}>
                <span className={styles.toolbarLabel} title={tooltips.minBooks}>
                  Default Min
                </span>
                <Select value={`${value.minBooks}`} onChange={(event) => onChange({ minBooks: Number(event.target.value) })}>
                  {[2, 3, 4, 5, 6].map((count) => (
                    <option key={count} value={count}>
                      {count}
                    </option>
                  ))}
                </Select>
              </label>
              <div className={styles.toolbarField}>
                <span className={styles.toolbarLabel}>Density</span>
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
