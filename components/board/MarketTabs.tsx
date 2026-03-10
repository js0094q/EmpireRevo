import type { FairBoardResponse } from "@/lib/server/odds/types";
import { SegmentedControl } from "@/components/ui/SegmentedControl";

const OPTIONS = [
  { value: "h2h", label: "Moneyline" },
  { value: "spreads", label: "Spread" },
  { value: "totals", label: "Total" }
] as const;

export function MarketTabs({
  value,
  onChange
}: {
  value: FairBoardResponse["market"];
  onChange: (value: FairBoardResponse["market"]) => void;
}) {
  return <SegmentedControl value={value} options={OPTIONS} onChange={onChange} ariaLabel="Market" />;
}
