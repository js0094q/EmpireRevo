"use client";

import { useState } from "react";

export default function Drawer() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        className="fixed bottom-6 right-6 rounded-full px-4 py-3 bg-white text-black font-semibold shadow-lg"
        onClick={() => setOpen(true)}
      >
        Open Drawer (scaffold)
      </button>

      {open ? (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/70" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-0 h-full w-full max-w-xl border-l border-white/10 bg-black/90 backdrop-blur p-5">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-white/50 uppercase tracking-widest">Insights</div>
                <div className="text-xl font-semibold tracking-tight mt-1">Game Drawer</div>
              </div>
              <button className="rounded-xl border border-white/10 px-3 py-2 text-sm" onClick={() => setOpen(false)}>
                Close
              </button>
            </div>

            <div className="mt-5 space-y-3">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="text-sm font-semibold">Best Prices</div>
                <div className="mt-2 text-sm text-white/70">Wire details here.</div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="text-sm font-semibold">Consensus vs Sharp Lean</div>
                <div className="mt-2 text-sm text-white/70">Show weighted vs equal-weighted probabilities and drivers.</div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="text-sm font-semibold">Movement Timeline</div>
                <div className="mt-2 text-sm text-white/70">v1 shows open and current, v2 adds sparkline.</div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
