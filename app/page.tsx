import Link from "next/link";
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
      title="Configuration required"
      message="ODDS_API_KEY is missing on the server."
      detail="Add it to .env.local and the deployment environment before loading the board."
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

  const result = await fetchFairBoardPageData({
    league,
    market,
    model,
    minBooks,
    windowHours,
    historyWindowHours: 72
  })
    .then((board) => ({ board, error: null as (Error & { code?: string; status?: number }) | null }))
    .catch((error) => ({ board: null as null, error: error as Error & { code?: string; status?: number } }));

  if (result.error) {
    const e = result.error;
    let title = "Live odds unavailable";
    let message = "Unexpected error while building the fair board.";
    let hint: string = e.message || "Please try refreshing shortly.";

    if (e.code === "UPSTREAM_AUTH_FAILURE") {
      title = "Upstream authentication failed";
      message = "EmpirePicks could not authenticate with the odds feed.";
      hint = "Verify the API key and account status in your provider dashboard.";
    } else if (e.code === "UPSTREAM_RATE_LIMIT") {
      title = "Odds feed is temporarily unavailable";
      message = "The upstream provider rate limited this request.";
      hint = "Wait a moment, then refresh. Cached snapshots may still be available.";
    } else if (e.code === "UPSTREAM_EMPTY_PAYLOAD") {
      title = "No games available";
      message = "The feed returned an empty schedule for this league and market.";
      hint = "Try another league or market.";
    }

    return <ErrorState title={title} message={message} detail={hint} />;
  }

  const pageData = result.board;
  if (!pageData) {
    return <ErrorState title="Odds unavailable" message="Unexpected error while building the board." detail="Missing board payload." />;
  }

  if (pageData.resolvedMarket !== market) {
    const nextParams = new URLSearchParams();
    nextParams.set("league", league);
    nextParams.set("market", pageData.resolvedMarket);
    if (model !== HOME_FILTERS.model) nextParams.set("model", model);
    if (minBooks !== HOME_FILTERS.minBooks) nextParams.set("minBooks", `${minBooks}`);
    redirect(`/?${nextParams.toString()}`);
  }

  const board = pageData.board;

  if (!(board.events?.length ?? 0)) {
    return (
      <ErrorState
        title="No qualifying markets for current filters."
        message="Try another league, market, or book threshold."
        detail="EmpirePicks only shows markets with live comparable prices."
      />
    );
  }

  const preview = buildBoardViewModel({
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
  });

  const topEdges = preview.rows.slice(0, 3);
  const sportsbookExamples = board.books.slice(0, 6);
  const faqs = [
    {
      q: "What is a fair line?",
      a: "A fair line is the market-implied price after removing sportsbook margin and averaging multiple books into a consensus view."
    },
    {
      q: "What is EV?",
      a: "EV is the expected-value signal for a selected price versus fair value. Positive values are usually better opportunities; neutral values may still be worth monitoring."
    },
    {
      q: "Should I only use strong EV signals?",
      a: "Strong EV is the clearest opportunity signal, but market confidence, liquidity, and freshness are also important for execution confidence."
    }
  ];

  return (
    <div className={styles.page}>
      <section className={styles.heroWrap}>
        <section className={styles.hero}>
          <p className={styles.eyebrow}>Trusted odds intelligence</p>
          <h1 className={styles.heroTitle}>See the market edge before the market shifts.</h1>
          <p className={styles.heroCopy}>
            The board ranks live opportunities by price, freshness, and confidence so action candidates stand out immediately.
          </p>
          <div className={styles.heroActions}>
            <Link href="#board" className={styles.heroPrimary}>
              Open board
            </Link>
            <Link href="#faq" className={styles.heroSecondary}>
              How it works
            </Link>
          </div>
        </section>
      </section>

      <section className={styles.heroMetrics}>
        <div>
          <p className={styles.metricLabel}>Live state</p>
          <p className={styles.metricValue}>{preview.resultLabel}</p>
        </div>
        <div>
          <p className={styles.metricLabel}>Coverage</p>
          <p className={styles.metricValue}>{preview.coverageLabel}</p>
        </div>
        <div>
          <p className={styles.metricLabel}>Last update</p>
          <p className={styles.metricValue}>{preview.updatedLabel}</p>
        </div>
      </section>

      <section className={styles.sectionGrid}>
        <article className={styles.sectionCard}>
          <h2>Best current edges</h2>
          <p className={styles.sectionIntro}>Top opportunities filtered from the current league and market.</p>
          <ul className={styles.itemList}>
            {topEdges.map((row) => (
              <li key={row.id} className={styles.itemRow}>
                <span>
                  <strong>{row.event}</strong>
                  <span className={styles.itemMeta}>{row.market}</span>
                </span>
                <span className={styles.itemStats}>{row.evMeta || "Market-neutral"}</span>
              </li>
            ))}
          </ul>
        </article>

        <article className={styles.sectionCard}>
          <h2>Line shopping examples</h2>
          <p className={styles.sectionIntro}>Compare posted lines with consensus fair values in one place.</p>
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
          <div className={styles.tagWrap}>
            {sportsbookExamples.map((book) => (
              <span key={book.key} className={styles.tag}>
                {book.title}
              </span>
            ))}
          </div>
          <p className={styles.sectionCopy}>Feed availability can vary by sport, region, and event freshness.</p>
        </article>
      </section>

      <section className={styles.sectionCard}>
        <h2>Live market signals</h2>
        <p className={styles.sectionCopy}>
          Movement and freshness signals are calculated from live timing, spread updates, and recency windows.
        </p>
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
      </section>

      <section id="board" className={styles.boardSection}>
        <div className={styles.sectionLead}>
          <h2>Live board</h2>
          <p className={styles.sectionCopy}>Markets are sorted by actionability, movement, and confidence.</p>
        </div>
        <BoardView board={board} league={league} model={model} mode="board" />
      </section>

      <section className={styles.faqSection} id="faq">
        <h2>FAQ</h2>
        <div className={styles.faqList}>
          {faqs.map((item) => (
            <details key={item.q} className={styles.faqItem}>
              <summary>{item.q}</summary>
              <p>{item.a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className={styles.mobileCta}>
        <h2>Mobile app experience</h2>
        <p className={styles.sectionCopy}>A responsive mobile workflow is available with compact cards and sticky controls.</p>
        <Link href="/contact" className={styles.heroSecondary}>
          Join mobile alpha list
        </Link>
      </section>
    </div>
  );
}
