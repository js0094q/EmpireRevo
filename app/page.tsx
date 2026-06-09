import { TrackedLink } from "@/components/analytics/TrackedLink";
import { ErrorState } from "@/components/primitives/ErrorState";
import { BoardView } from "@/components/board/BoardView";
import { buildBoardViewModel } from "@/lib/ui/view-models/boardViewModel";
import { fetchFairBoardPageData, hasOddsKey } from "@/lib/server/odds/pageData";
import { getPublicSportOptions, resolveSportOption } from "@/lib/server/odds/sportsRegistry";
import { listOutcomeResults } from "@/lib/server/odds/outcomes";
import { redirect } from "next/navigation";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

function ConfigRequired() {
  return (
    <ErrorState
      title="Live board configuration required"
      message="The launch and methodology pages are still available, but the live board needs ODDS_API_KEY on the server."
      detail="Add the key to the deployment environment before opening the board."
    />
  );
}

const HOME_FILTERS = {
  minBooks: 4,
  market: "h2h" as const,
  model: "weighted" as const
};

export default async function Page({
  searchParams
}: {
  searchParams?: Promise<{ league?: string; market?: string; model?: string; minBooks?: string }>;
}) {
  const params = (await searchParams) || {};
  const sports = await getPublicSportOptions();
  const selectedSport = resolveSportOption(params.league, sports);
  const league = selectedSport.key;
  const market = params.market === "spreads" || params.market === "totals" ? params.market : HOME_FILTERS.market;
  const model =
    params.model === "sharp" || params.model === "equal" || params.model === "weighted"
      ? (params.model as "sharp" | "equal" | "weighted")
      : HOME_FILTERS.model;
  const minBooks = Math.max(2, Math.min(6, Number(params.minBooks || `${HOME_FILTERS.minBooks}`) || HOME_FILTERS.minBooks));
  const windowHours = 168;

  let boardError: { title: string; message: string; detail?: string } | null = null;
  const pageData = hasOddsKey()
    ? await fetchFairBoardPageData({
        league,
        market,
        model,
        minBooks,
        windowHours,
        historyWindowHours: 72
      })
        .then((board) => board)
        .catch((error: Error & { code?: string; status?: number }) => {
          let title = "Live odds unavailable";
          let message = "Unexpected error while building the fair board.";
          let detail: string = error.message || "Please try refreshing shortly.";

          if (error.code === "UPSTREAM_AUTH_FAILURE") {
            title = "Upstream authentication failed";
            message = "EmpirePicks could not authenticate with the odds feed.";
            detail = "Verify the API key and account status in your provider dashboard.";
          } else if (error.code === "UPSTREAM_RATE_LIMIT") {
            title = "Odds feed is temporarily unavailable";
            message = "The upstream provider rate limited this request.";
            detail = "Wait a moment, then refresh. Cached snapshots may still be available.";
          } else if (error.code === "UPSTREAM_EMPTY_PAYLOAD") {
            title = "No games available";
            message = "The feed returned an empty schedule for this league and market.";
            detail = "Try another league or market.";
          }

          boardError = { title, message, detail };
          return null;
        })
    : null;

  if (!hasOddsKey()) {
    boardError = {
      title: "Live board configuration required",
      message: "ODDS_API_KEY is missing on the server.",
      detail: "The public record and transparency pages remain available."
    };
  }

  if (pageData?.resolvedMarket !== undefined && pageData.resolvedMarket !== market) {
    const nextParams = new URLSearchParams();
    nextParams.set("league", league);
    nextParams.set("market", pageData.resolvedMarket);
    if (model !== HOME_FILTERS.model) nextParams.set("model", model);
    if (minBooks !== HOME_FILTERS.minBooks) nextParams.set("minBooks", `${minBooks}`);
    redirect(`/?${nextParams.toString()}`);
  }

  const board = pageData?.board ?? null;
  const outcomes = board
    ? await listOutcomeResults(500).catch(() => [])
    : [];
  if (board && !(board.events?.length ?? 0)) {
    boardError = {
      title: "No qualifying markets for current filters.",
      message: "Try another league, market, or book threshold.",
      detail: "EmpirePicks only shows markets with live comparable prices."
    };
  }

  const preview = board
    ? buildBoardViewModel({
        board,
        league,
        model,
        mode: "board",
        filters: {
          search: "",
          sort: "edge",
          bookKey: "all",
          edgeThresholdPct: 0,
          confidence: "all",
          outcomeStatus: "all",
          minBooks,
          pinnedOnly: false,
          includeStale: false,
          pinnedBooks: new Set<string>()
        },
        outcomes
      })
    : null;

  return (
    <div className={styles.page}>
      <section className={styles.heroWrap}>
        <section className={styles.hero}>
          <p className={styles.phaseLabel}>Public read-only preview · Testing build</p>
          <h1 className={styles.heroTitle}>EmpirePicks market board</h1>
          <p className={styles.heroCopy}>
            Live sportsbook prices compared against no-vig fair lines, freshness, confidence, and book coverage.
          </p>
          <div className={styles.heroActions}>
            <TrackedLink
              href="#board"
              className={styles.heroPrimary}
              eventName="board_open"
              eventProperties={{ placement: "homepage_hero", intent: "board" }}
            >
              Open board
            </TrackedLink>
            <TrackedLink
              href="/history"
              className={styles.heroSecondary}
              eventName="history_cta"
              eventProperties={{ placement: "homepage_hero" }}
            >
              View record policy
            </TrackedLink>
          </div>
        </section>
      </section>

      <section className={styles.statusLine} aria-label="Board status">
        <strong>{preview?.resultLabel ?? "Board unavailable"}</strong>
        <span>{sports.length} {sports.length === 1 ? "active sport" : "active sports"}</span>
        <span>{preview?.coverageLabel ?? "Pending feed"}</span>
        <span>{preview?.updatedLabel ?? "No live odds refresh"}</span>
        <span>{preview ? `${preview.staleExcludedCount} stale excluded` : "Freshness pending"}</span>
      </section>

      <section id="board" className={styles.boardSection}>
        <div className={styles.sectionLead}>
          <h2>Live board</h2>
          <p className={styles.sectionCopy}>Testing-phase data is read-only; stale and historical markets are excluded by default.</p>
        </div>
        {board && !boardError ? <BoardView board={board} league={league} model={model} mode="board" outcomes={outcomes} sports={sports} /> : boardError ? (
          boardError.title === "Live board configuration required" ? (
            <ConfigRequired />
          ) : (
            <ErrorState title={boardError.title} message={boardError.message} detail={boardError.detail} />
          )
        ) : null}
      </section>

      <nav className={styles.supportLinks} aria-label="Product context">
        <TrackedLink
          href="/transparency"
          eventName="transparency_cta"
          eventProperties={{ placement: "homepage_support_links" }}
        >
          Methodology
        </TrackedLink>
        <TrackedLink
          href="/history"
          eventName="history_cta"
          eventProperties={{ placement: "homepage_support_links" }}
        >
          Record policy
        </TrackedLink>
      </nav>
    </div>
  );
}
