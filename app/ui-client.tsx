"use client";

import type { BoardResponse } from "@/lib/odds/schemas";
import { MatchupCard } from "@/lib/ui/MatchupCard";
import OddsRow from "@/lib/ui/OddsRow";
import { MarketFeed } from "@/lib/ui/MarketFeed";
import Drawer from "@/lib/ui/Drawer";

export function BoardClient({ board }: { board: BoardResponse }) {
  return (
    <main className="page-shell">
      <nav className="top-nav">
        <div className="brand">
          <div className="logo-dot" />
          <div>
            <strong>EmpirePicks</strong>
            <p>Live Market Intelligence</p>
          </div>
        </div>
        <div className="live-pill"><span /> LIVE</div>
      </nav>

      <section className="hero-note">
        <h1>{board.editorNote.headline}</h1>
        <p>{board.editorNote.body}</p>
        <ul>
          {board.editorNote.watchlist.map((w) => <li key={w}>{w}</li>)}
        </ul>
        <small>{board.editorNote.lockLike[0]}</small>
      </section>

      <section>
        <h2>Coming Up</h2>
        <div className="coming-up-grid">
          {board.comingUp.map((g) => (
            <MatchupCard key={g.event.id} game={g} onOpen={() => {}} />
          ))}
        </div>
      </section>

      <section className="content-grid">
        <div>
          <h2>Best Value Now</h2>
          <div className="rows">
            {board.bestValueNow.map((g) => <OddsRow key={g.event.id} game={g} />)}
          </div>

          <h2>League Board</h2>
          <div className="rows">
            {board.games.map((g) => <OddsRow key={`${g.event.id}-full`} game={g} />)}
          </div>
        </div>

        <MarketFeed feed={board.feed} />
      </section>

      <Drawer />
    </main>
  );
}
