import type { BoardFeedItem } from "@/lib/odds/schemas";

export function MarketFeed({ feed }: { feed: BoardFeedItem[] }) {
  return (
    <aside className="feed">
      <div className="feed-head">
        <h3>Market Activity</h3>
        <span className="badge-soft">Live</span>
      </div>

      {feed.length === 0 ? <p className="muted">No major moves yet. Monitoring all books.</p> : null}

      {feed.map((item) => (
        <article key={item.id} className="feed-item">
          <strong>{item.title}</strong>
          <p>{item.subtitle}</p>
        </article>
      ))}
    </aside>
  );
}
