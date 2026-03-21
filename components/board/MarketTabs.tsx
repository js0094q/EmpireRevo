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
  marketAvailability
}: {
  value: FairBoardResponse["market"];
  onChange: (value: FairBoardResponse["market"]) => void;
  marketAvailability?: FairBoardResponse["marketAvailability"];
}) {
  const availabilityByMarket = new Map((marketAvailability || []).map((entry) => [entry.market, entry]));
  const options = OPTIONS.flatMap((option) => {
    const availability = availabilityByMarket.get(option.value);
    if (availability?.status === "unavailable") return [];

    return [
      {
        value: option.value,
        label: availability?.status === "limited" ? `${option.label} (Limited)` : option.label,
        title: availability?.status === "limited" ? "Limited live availability; representative comparable lines shown" : undefined
      }
    ];
  });
  return <SegmentedControl value={value} options={options} onChange={onChange} ariaLabel="Market" />;
}
