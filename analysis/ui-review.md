# UI / UX Review

## Codebase Surface
- Primary experience lives in the server component `app/page.tsx` + client bundle `app/ui-client.tsx` (~1,000 lines). `page.tsx` fetches `/api/fair` via HTTP even though it runs on the server, then hydrates a massive client component.
- Secondary experiences:
  - `/game/[eventId]` (`app/game/[eventId]/page.tsx`) – detail drill-down pulling from the same `/api/fair` payload.
  - `/games` (`app/games/page.tsx`) – new OddsTrader-style comparison grid powered by the aggregator.
  - `/league/[leagueKey]` – immediate redirect to `/` with query parameters.
- There is no `components/` directory; all UI logic, state, and presentation live inside `app/ui-client.tsx` or the page files.
- Styling is entirely custom via `app/globals.css`, which contains both legacy board styles and new `/games` table styles (~900 lines).

## Layout & Information Hierarchy
- `/` (Fair Board): the UI is extremely dense. The top toolbar mixes league buttons, time windows, "editor note" copy, book filters, search, toggles, etc., all within one client component. There is no modularity, so small changes require editing a monolithic file.
- The odds grid itself uses nested tables with numerous metrics (EV, best price, sharp drivers, movement icons). While powerful, the layout can overwhelm users; there is no collapsing of low-signal data or virtualization, so long lists require large scrolls.
- `/games`: the layout is more straightforward (table per spec) but lacks any controls (league selector, market tabs, sort, pagination). It always defaults to `basketball_nba` and whichever market was in the query string. No breadcrumbs link it back to the main view.
- `/game/[eventId]`: reads the same dataset but renders using plain HTML sections. It shows fair line and edges but duplicates best-book logic already visible on the main grid.

## Sportsbook Comparison UX
- Main board highlights best prices using badges, but because `/api/fair` is broken the UI currently cannot show real odds; the component logic depends on `board.events` that never populate.
- `/games` table highlights “Best Price / Fair Odds / Edge” for whichever side has the highest EV, and lists bankroll of sportsbooks below. However, it only displays *one* side per row (the max EV outcome) and there is no way to flip between home/away or Over/Under, which limits its usefulness.
- Spread/total lines ignore the line (`point`) entirely, so users cannot see whether the "best price" is tied to a different number.

## Performance Considerations
- `OddsGridClient` is a giant client bundle that performs extensive synchronous work (sorting, generating chart series, computing variance, slicing book history, etc.) on every render. There is no memoization at module boundaries and no virtualization, so the component can lag with many games.
- `/app/page.tsx` fetches `/api/fair` via HTTP + JSON parsing, meaning every page load incurs an internal HTTP hop instead of calling shared functions.
- `/games` is server-rendered, which helps, but it performs the entire aggregation on the server for every request (though the aggregator caches for 30 s). There is no client auto-refresh, so odds can go stale without visible cues.

## Visual Polish
- The design aesthetic (dark theme, microbars, chip buttons) feels close to professional dashboards, but the monolithic CSS file lacks structure. Media queries exist, yet the grid still struggles below tablet widths (horizontal scrolling, cramped text).
- Iconography: movement arrows rely on plain text (“▲/▼”) and delta values truncated to integers. There is no tool-tip explaining what constitutes “improving” vs “worsening.”
- Accessibility: no focus states, no ARIA labels, and many buttons are plain `<button>` elements with icons but no text.

## Summary
- `/` is feature-rich but currently unusable because the underlying API is broken. Even if fixed, the UX is overwhelming due to the monolithic client component.
- `/games` embodies the requested OddsTrader grid but is missing league/market controls, toggles for each side, and line-value awareness.
- The lack of reusable components or design system makes it hard to evolve the UI safely, and performance optimizations (virtualization, incremental rendering) are absent.
