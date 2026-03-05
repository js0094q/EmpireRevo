import Link from "next/link";
import { fetchFairBoardServer, hasOddsKey } from "@/lib/server/odds/pageData";

export default async function GamePage({
  params,
  searchParams
}: {
  params: Promise<{ eventId: string }>;
  searchParams?: Promise<{ league?: string; market?: string; model?: string }>;
}) {
  const { eventId } = await params;
  const query = (await searchParams) || {};

  if (!hasOddsKey()) {
    return (
      <main className="config-shell">
        <section className="config-card">
          <h1>Configuration Required</h1>
          <p>ODDS_API_KEY is missing. Configure it to view game details.</p>
        </section>
      </main>
    );
  }

  const league = query.league || "nba";
  const market = query.market === "spreads" || query.market === "totals" ? query.market : "h2h";
  const model = query.model === "equal" ? "equal" : "sharp";

  const board = await fetchFairBoardServer({
    league,
    market,
    model,
    windowHours: 24
  });

  const event = board.events.find((entry) => entry.id === eventId);

  if (!event) {
    return (
      <main className="grid-shell">
        <p>Game not found in this market window.</p>
        <Link href={`/?league=${league}&market=${market}&model=${model}`}>Back to board</Link>
      </main>
    );
  }

  return (
    <main className="grid-shell">
      <Link href={`/?league=${league}&market=${market}&model=${model}`}>Back to board</Link>
      <h1>
        {event.awayTeam} @ {event.homeTeam}
      </h1>
      <p className="muted">{new Date(event.commenceTime).toLocaleString()}</p>
      {event.outcomes.map((outcome) => (
        <section key={outcome.name} className="detail-section">
          <h3>{outcome.name}</h3>
          <p>
            Fair line: {outcome.fairAmerican > 0 ? `+${outcome.fairAmerican}` : outcome.fairAmerican} ({(outcome.fairProb * 100).toFixed(2)}%)
          </p>
          <div className="detail-table">
            {outcome.books.map((book) => (
              <div key={`${outcome.name}-${book.bookKey}`} className="detail-row">
                <span>{book.title}</span>
                <strong>{book.priceAmerican > 0 ? `+${book.priceAmerican}` : book.priceAmerican}</strong>
                <small>{book.edgePct.toFixed(2)}% edge</small>
              </div>
            ))}
          </div>
        </section>
      ))}
    </main>
  );
}
