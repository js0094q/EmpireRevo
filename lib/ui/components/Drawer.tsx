"use client";

import type { DerivedGame } from "@/lib/odds/schemas";
import { formatAmerican, movementIcon } from "@/lib/ui/theme";

export function Drawer({ game, onClose }: { game: DerivedGame | null; onClose: () => void }) {
  const open = Boolean(game);
  const sideRows = game?.markets.flatMap((market) =>
    market.sides.slice(0, 2).map((side) => ({ market: market.market, side }))
  ) || [];

  return (
    <div className={`drawer ${open ? "open" : ""}`} aria-hidden={!open}>
      <button className="drawer-backdrop" onClick={onClose} aria-label="Close drawer" />

      <section className="drawer-panel" aria-label="Game detail drawer">
        <header>
          <div>
            <div className="muted">Market Detail</div>
            <strong>
              {game ? `${game.event.away.name} @ ${game.event.home.name}` : "No game selected"}
            </strong>
          </div>
          <button onClick={onClose}>Close</button>
        </header>

        <div className="drawer-body">
          {game ? (
            <>
              <section className="drawer-section">
                <h4>Best Prices</h4>
                {sideRows.map(({ market, side }) => (
                  <div className="drawer-row" key={`${market}-${side.label}`}>
                    <div>
                      <strong>{side.label}</strong>
                      <p className="muted">{market.toUpperCase()}</p>
                    </div>
                    <div className="mono-cluster">
                      <span>{formatAmerican(side.bestPrice.price)}</span>
                      <small>{side.bestPrice.bookTitle}</small>
                    </div>
                  </div>
                ))}
              </section>

              <section className="drawer-section">
                <h4>Weighted vs Equal Consensus</h4>
                {sideRows.map(({ market, side }) => (
                  <div className="drawer-row" key={`${market}-${side.label}-consensus`}>
                    <div>
                      <strong>{side.label}</strong>
                      <p className="muted">lean {side.explain.leanPct.toFixed(2)}pp</p>
                    </div>
                    <div className="mono-cluster">
                      <span>{(side.explain.sharpWeightedProb * 100).toFixed(1)}%</span>
                      <small>sharp weighted</small>
                    </div>
                    <div className="mono-cluster">
                      <span>{(side.explain.equalWeightedProb * 100).toFixed(1)}%</span>
                      <small>equal weighted</small>
                    </div>
                  </div>
                ))}
              </section>

              <section className="drawer-section">
                <h4>Sharp Drivers</h4>
                {sideRows.map(({ market, side }) => (
                  <div className="drawer-row" key={`${market}-${side.label}-drivers`}>
                    <div>
                      <strong>{side.label}</strong>
                      <p className="muted">top weighted books</p>
                    </div>
                    <div className="driver-list">
                      {side.explain.topDrivers.length === 0 ? <small className="muted">No sharp-book signal</small> : null}
                      {side.explain.topDrivers.map((driver) => (
                        <small key={`${market}-${side.label}-${driver.bookKey}`}>
                          {driver.bookTitle} ({driver.weight.toFixed(2)}x)
                        </small>
                      ))}
                    </div>
                  </div>
                ))}
              </section>

              <section className="drawer-section">
                <h4>Movement Timeline</h4>
                {sideRows.map(({ market, side }) => (
                  <div className="drawer-row" key={`${market}-${side.label}-movement`}>
                    <div>
                      <strong>{side.label}</strong>
                      <p className="muted">
                        {movementIcon(side.movement.icon)} {Math.round(side.movement.deltaCents || 0)}c
                      </p>
                    </div>
                    <div className="mono-cluster">
                      <span>{formatAmerican(side.movement.openPrice)}</span>
                      <small>open</small>
                    </div>
                    <div className="mono-cluster">
                      <span>{formatAmerican(side.movement.prevPrice)}</span>
                      <small>prev</small>
                    </div>
                    <div className="mono-cluster">
                      <span>{formatAmerican(side.movement.currentPrice)}</span>
                      <small>current</small>
                    </div>
                  </div>
                ))}
              </section>

              <section className="drawer-section">
                <h4>Confidence Rationale</h4>
                {sideRows.map(({ market, side }) => (
                  <div className="drawer-row" key={`${market}-${side.label}-confidence`}>
                    <div>
                      <strong>{side.label}</strong>
                      <p className="muted">{side.confidence} confidence</p>
                    </div>
                    <div className="mono-cluster">
                      <span>{side.explain.bookCount}</span>
                      <small>books</small>
                    </div>
                    <div className="mono-cluster">
                      <span>{side.explain.variance.toFixed(5)}</span>
                      <small>variance</small>
                    </div>
                    <div className="mono-cluster">
                      <span>{side.explain.recencySec}s</span>
                      <small>recency</small>
                    </div>
                  </div>
                ))}
              </section>
            </>
          ) : (
            <p className="muted">Select a game to open details.</p>
          )}
        </div>
      </section>
    </div>
  );
}
