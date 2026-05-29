import { TrackedLink } from "@/components/analytics/TrackedLink";
import { ErrorState } from "@/components/primitives/ErrorState";
import { BoardView } from "@/components/board/BoardView";
import { buildBoardViewModel } from "@/lib/ui/view-models/boardViewModel";
import { fetchFairBoardPageData, hasOddsKey } from "@/lib/server/odds/pageData";
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
  if (!hasOddsKey()) {
    return <ConfigRequired />;
  }

  const params = (await searchParams) || {};
  const league = params.league || "nba";
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
      detail: "The public launch, pricing, and transparency pages remain available."
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
          minBooks,
          pinnedOnly: false,
          includeStale: true,
          pinnedBooks: new Set<string>()
        }
      })
    : null;

  const topEdges = preview?.rows.slice(0, 3) ?? [];
  const sportsbookExamples = board?.books.slice(0, 6) ?? [];

  return (
    <div className={styles.page}>
      <section className={styles.heroWrap}>
        <section className={styles.hero}>
          <p className={styles.eyebrow}>Fair-line sportsbook intelligence</p>
          <h1 className={styles.heroTitle}>See the market edge before the market shifts.</h1>
          <p className={styles.heroCopy}>
            EmpirePicks compares posted sportsbook prices against no-vig fair lines, freshness, and confidence so
            action candidates stand out without unsupported pick-selling claims.
          </p>
          <div className={styles.heroActions}>
            <TrackedLink
              href="/pricing"
              className={styles.heroPrimary}
              eventName="hero_cta"
              eventProperties={{ placement: "homepage_hero", intent: "pricing" }}
            >
              View launch access
            </TrackedLink>
            <TrackedLink
              href="#board"
              className={styles.heroSecondary}
              eventName="board_open"
              eventProperties={{ placement: "homepage_hero" }}
            >
              Open live board
            </TrackedLink>
          </div>
          <div className={styles.trustStrip} aria-label="Platform trust signals">
            <span>No-vig fair lines</span>
            <span>Book coverage</span>
            <span>CLV-ready history</span>
            <span>Responsible-use framing</span>
          </div>
        </section>
      </section>

      <section className={styles.heroMetrics}>
        <div>
          <p className={styles.metricLabel}>Live state</p>
          <p className={styles.metricValue}>{preview?.resultLabel ?? "Board unavailable"}</p>
        </div>
        <div>
          <p className={styles.metricLabel}>Coverage</p>
          <p className={styles.metricValue}>{preview?.coverageLabel ?? "Pending feed"}</p>
        </div>
        <div>
          <p className={styles.metricLabel}>Last update</p>
          <p className={styles.metricValue}>{preview?.updatedLabel ?? "No live update"}</p>
        </div>
      </section>

      <section className={styles.sectionGrid}>
        <article className={styles.sectionCard}>
          <h2>Best current edges</h2>
          <p className={styles.sectionIntro}>Top opportunities filtered from the current league and market.</p>
          {topEdges.length ? (
            <ul className={styles.itemList}>
              {topEdges.map((row) => (
                <li key={row.id} className={styles.itemRow}>
                  <span>
                    <strong>{row.event}</strong>
                    <span className={styles.itemMeta}>{row.market}</span>
                    <span className={styles.itemMeta}>
                      {row.bestBook} {row.bestPrice} · Fair {row.fairPrice}
                    </span>
                  </span>
                  <span className={styles.edgePriceStack}>
                    <span className={styles.edgePricePrimary}>{row.bestPrice}</span>
                    <span className={styles.edgePriceSecondary}>{row.evMeta || "Market-neutral"}</span>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className={styles.sectionCopy}>Live edge examples load when the odds feed is configured and reachable.</p>
          )}
        </article>

        <article className={styles.sectionCard}>
          <h2>Line shopping examples</h2>
          <p className={styles.sectionIntro}>Compare posted lines with consensus fair values in one place.</p>
          {topEdges.length ? (
            <ul className={styles.itemList}>
              {topEdges.slice(0, 3).map((row) => (
                <li key={`${row.id}-line`} className={styles.itemRow}>
                  <span>
                    <strong>{row.bestBook}</strong>
                    <span className={styles.itemMeta}>{row.bestPrice}</span>
                  </span>
                  <span className={styles.itemStats}>Fair {row.fairPrice}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className={styles.sectionCopy}>The board keeps examples tied to live market data instead of fabricated samples.</p>
          )}
        </article>
      </section>

      <section className={styles.sectionGrid}>
        <article className={styles.sectionCard}>
          <h2>Why fair odds matter</h2>
          <ul className={styles.itemList}>
            <li>Normalize margin and compare apples-to-apples across books.</li>
            <li>Combine fair pricing, freshness, and confidence into one decision signal.</li>
            <li>Reduce stale reads through explicit timing and movement context.</li>
          </ul>
        </article>

        <article className={styles.sectionCard}>
          <h2>Supported sportsbooks</h2>
          {sportsbookExamples.length ? (
            <div className={styles.tagWrap}>
              {sportsbookExamples.map((book) => (
                <span key={book.key} className={styles.tag}>
                  {book.title}
                </span>
              ))}
            </div>
          ) : null}
          <p className={styles.sectionCopy}>Feed availability can vary by sport, region, and event freshness.</p>
        </article>
      </section>

      <section className={styles.sectionGrid}>
        <article className={styles.sectionCard}>
          <h2>Trust and transparency</h2>
          <p className={styles.sectionCopy}>
            Public ROI, win rate, and CLV claims should be reproducible. EmpirePicks tracks recommendation-time context
            and keeps missing outcomes null-safe instead of inferring results.
          </p>
          <TrackedLink
            href="/transparency"
            className={styles.inlineCta}
            eventName="transparency_cta"
            eventProperties={{ placement: "homepage_trust" }}
          >
            Review methodology
          </TrackedLink>
        </article>

        <article className={styles.sectionCard}>
          <h2>Launch access</h2>
          <p className={styles.sectionCopy}>
            Use the live board as the product preview, then request access for pricing, onboarding, and paid workflow
            updates as the record-tracking layer matures.
          </p>
          <TrackedLink
            href="/pricing"
            className={styles.inlineCta}
            eventName="pricing_cta"
            eventProperties={{ placement: "homepage_launch_access" }}
          >
            View launch access
          </TrackedLink>
        </article>
      </section>

      <section className={styles.sectionCard}>
        <h2>Live market signals</h2>
        <p className={styles.sectionCopy}>
          Movement and freshness signals are calculated from live timing, spread updates, and recency windows.
        </p>
        {topEdges.length ? (
          <div className={styles.tagWrap}>
            {Array.from(
              new Set(topEdges.map((row) => [row.marketMeta, row.market]).flat().filter(Boolean))
            ).map((token) =>
              token ? (
                <span key={token} className={styles.tag}>
                  {token}
                </span>
              ) : null
            )}
          </div>
        ) : null}
      </section>

      <section id="board" className={styles.boardSection}>
        <div className={styles.sectionLead}>
          <h2>Live board</h2>
          <p className={styles.sectionCopy}>Markets are sorted by actionability, movement, and confidence.</p>
        </div>
        {board && !boardError ? <BoardView board={board} league={league} model={model} mode="board" /> : boardError ? (
          boardError.title === "Live board configuration required" ? (
            <ConfigRequired />
          ) : (
            <ErrorState title={boardError.title} message={boardError.message} detail={boardError.detail} />
          )
        ) : null}
      </section>

      <section className={styles.mobileCta}>
        <h2>Mobile app experience</h2>
        <p className={styles.sectionCopy}>A responsive mobile workflow is available with compact cards and sticky controls.</p>
        <TrackedLink
          href="/contact"
          className={styles.heroSecondary}
          eventName="contact_cta"
          eventProperties={{ placement: "homepage_mobile_alpha" }}
        >
          Join mobile alpha list
        </TrackedLink>
      </section>
    </div>
  );
}
