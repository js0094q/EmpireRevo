import type { FairBoardResponse } from "@/lib/server/odds/types";
import { SegmentedControl } from "@/components/ui/SegmentedControl";

const OPTIONS = [
  { value: "h2h", label: "Moneyline" },
  { value: "spreads", label: "Spread" },
  { value: "totals", label: "Total" }
] as const;

export function MarketTabs({
  value,
  onChange,
  availableMarkets
}: {
  value: FairBoardResponse["market"];
  onChange: (value: FairBoardResponse["market"]) => void;
  availableMarkets?: FairBoardResponse["activeMarkets"];
}) {
  const options = OPTIONS.filter((option) => !availableMarkets || availableMarkets.includes(option.value));
  return <SegmentedControl value={value} options={options} onChange={onChange} ariaLabel="Market" />;
}
