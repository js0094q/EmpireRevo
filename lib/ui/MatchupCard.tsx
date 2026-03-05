import type { DerivedGame } from "@/lib/odds/schemas";

function fmtPrice(p: number): string {
  return p > 0 ? `+${p}` : `${p}`;
}

export function MatchupCard({ game, onOpen }: { game: DerivedGame; onOpen: (id: string) => void }) {
  const h2h = game.markets.find((m) => m.market === "h2h");
  const sides = h2h?.sides || [];

  return (
    <button className="matchup-card" onClick={() => onOpen(game.event.id)}>
      <div className="matchup-time">{new Date(game.event.commenceTime).toLocaleString()}</div>
      <div className="teams">
        <div className="team-line"><span>{game.event.away.name}</span></div>
        <div className="team-line"><span>{game.event.home.name}</span></div>
      </div>
      <div className="price-grid">
        {sides.slice(0, 2).map((s) => (
          <div className="price-item" key={s.label}>
            <span>{s.label}</span>
            <strong>{fmtPrice(s.bestPrice.price)}</strong>
            {s.sharpDrivers.length > 0 ? <em>Sharp-weighted</em> : null}
          </div>
        ))}
      </div>
    </button>
  );
}
