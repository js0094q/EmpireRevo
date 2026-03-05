import type { DerivedGame } from "@/lib/odds/schemas";
import { formatAmerican, movementIcon, teamInitials } from "@/lib/ui/theme";

export function MatchupCard({ game, onOpen }: { game: DerivedGame; onOpen: (game: DerivedGame) => void }) {
  const h2h = game.markets.find((market) => market.market === "h2h");
  const topSides = (h2h?.sides || []).slice(0, 2);

  return (
    <button className="matchup-card" onClick={() => onOpen(game)}>
      <div className="matchup-header">
        <time className="matchup-time">{new Date(game.event.commenceTime).toLocaleString()}</time>
        <span className="badge-soft">Coming Up</span>
      </div>

      <div className="teams">
        <div className="team-line">
          {game.event.away.logoUrl ? (
            <img src={game.event.away.logoUrl} alt={`${game.event.away.name} logo`} className="team-logo" />
          ) : (
            <span className="team-logo-fallback">{teamInitials(game.event.away.name)}</span>
          )}
          <strong>{game.event.away.name}</strong>
        </div>

        <div className="team-line">
          {game.event.home.logoUrl ? (
            <img src={game.event.home.logoUrl} alt={`${game.event.home.name} logo`} className="team-logo" />
          ) : (
            <span className="team-logo-fallback">{teamInitials(game.event.home.name)}</span>
          )}
          <strong>{game.event.home.name}</strong>
        </div>
      </div>

      <div className="price-grid">
        {topSides.map((side) => (
          <div className="price-item" key={side.label}>
            <span>{side.label}</span>
            <strong>{formatAmerican(side.bestPrice.price)}</strong>
            <small>
              {movementIcon(side.movement.icon)} {Math.round(side.movement.deltaCents || 0)}c
            </small>
            {side.sharpDrivers.length > 0 ? <em>Sharp-weighted</em> : null}
          </div>
        ))}
      </div>
    </button>
  );
}
