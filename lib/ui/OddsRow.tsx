function movementIcon(icon?: string) {
  if (icon === "bolt") return "⚡";
  if (icon === "up") return "▲";
  if (icon === "down") return "▼";
  return "•";
}

export default function OddsRow({ game }: { game: any }) {
  const h2h = game.markets?.find((m: any) => m.market === "h2h") || game.markets?.[0];
  const side = h2h?.sides?.[0];

  return (
    <div className="px-4 py-3 bg-black/10 hover:bg-black/20 transition grid grid-cols-12 gap-2 items-center cursor-pointer">
      <div className="col-span-5">
        <div className="font-semibold tracking-tight">{game.event.away.name} <span className="text-white/50">@</span> {game.event.home.name}</div>
        <div className="text-xs text-white/50">{new Date(game.event.commenceTime).toLocaleString()}</div>
      </div>

      <div className="col-span-2">
        <div className="text-sm font-semibold">{side?.bestPrice?.price ?? "—"}</div>
        <div className="text-[11px] text-white/50">{side?.bestPrice?.bookTitle ?? ""}</div>
        {side?.sharpDrivers?.length ? (
          <div className="mt-1 text-[11px] text-emerald-300/80">Sharp-weighted present</div>
        ) : null}
      </div>

      <div className="col-span-2 text-sm">
        <div className="font-semibold">
          {movementIcon(side?.movement?.icon)} <span className="ml-1">{Math.round(side?.movement?.deltaCents || 0)}c</span>
        </div>
        <div className="text-[11px] text-white/50">
          {side?.movement?.openPrice ?? "—"} → {side?.movement?.currentPrice ?? "—"}
        </div>
      </div>

      <div className="col-span-1 text-sm font-semibold">{(side?.leanPct ?? 0).toFixed(1)}%</div>
      <div className="col-span-1 text-sm font-semibold">{(side?.evPct ?? 0).toFixed(1)}%</div>
      <div className="col-span-1 text-sm font-semibold">{side?.confidence ?? "—"}</div>
    </div>
  );
}
