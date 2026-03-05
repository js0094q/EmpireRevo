import type { BoardResponse } from "@/lib/odds/schemas";

export function MarketFeed({ feed }: { feed: BoardResponse["feed"] }) {
  return (
    <aside className="feed">
      <h3>Market Activity</h3>
      {feed.length === 0 ? <p className="muted">No major moves yet.</p> : null}
      {feed.map((item) => (
        <article key={item.id} className="feed-item">
          <strong>{item.title}</strong>
          <p>{item.subtitle}</p>
        </article>
      ))}
    </aside>
  );
}
