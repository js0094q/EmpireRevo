import Link from "next/link";
import { Badge } from "@/components/primitives/Badge";
import type { GameDetailViewModel } from "@/lib/ui/view-models/gameDetailViewModel";

export function MarketTabs({ tabs }: { tabs: GameDetailViewModel["tabs"] }) {
  return (
    <div style={{ display: "flex", gap: "0.45rem", flexWrap: "wrap" }}>
      {tabs.map((tab) => {
        const tone = tab.active ? "accent" : tab.limited ? "warning" : "neutral";
        if (!tab.href || tab.active) {
          return (
            <Badge key={tab.label} tone={tone}>
              {tab.label}
            </Badge>
          );
        }
        return (
          <Link key={tab.label} href={tab.href}>
            <Badge tone={tone}>{tab.label}</Badge>
          </Link>
        );
      })}
    </div>
  );
}
