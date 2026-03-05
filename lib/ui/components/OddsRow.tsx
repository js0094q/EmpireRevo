import type { DerivedGame } from "@/lib/odds/schemas";
import { formatAmerican, movementIcon } from "@/lib/ui/theme";

export function OddsRow({ game, onOpen }: { game: DerivedGame; onOpen: (game: DerivedGame) => void }) {
  const market = game.markets.find((entry) => entry.market === "h2h") || game.markets[0];
  const side = market?.sides?.[0];

  return (
    <button className="odds-row" onClick={() => onOpen(game)}>
      <div className="row-left">
        <strong>
          {game.event.away.name} <span className="muted">@</span> {game.event.home.name}
        </strong>
        <p>{new Date(game.event.commenceTime).toLocaleString()}</p>
      </div>

      <div className="row-right">
        <div className="mono-cluster">
          <span>{formatAmerican(side?.bestPrice?.price)}</span>
          <small>{side?.bestPrice?.bookTitle || ""}</small>
        </div>

        <div className="mono-cluster">
          <span>
            {movementIcon(side?.movement?.icon)} {Math.round(side?.movement?.deltaCents || 0)}c
          </span>
          <small>
            {formatAmerican(side?.movement?.openPrice)} → {formatAmerican(side?.movement?.currentPrice)}
          </small>
        </div>

        <div className="mono-cluster">
          <span>{(side?.leanPct || 0).toFixed(1)}pp</span>
          <small>lean</small>
        </div>

        <div className="mono-cluster">
          <span>{(side?.evPct || 0).toFixed(1)}%</span>
          <small>EV</small>
        </div>

        <span className={`conf ${(side?.confidence || "Low").toLowerCase()}`}>{side?.confidence || "Low"}</span>
      </div>
    </button>
  );
}
