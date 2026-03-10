import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { LEAGUES } from "@/components/board/constants";

export function LeagueSelector({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const options = LEAGUES.map((league) => ({ value: league.key, label: league.label }));
  return <SegmentedControl value={value} options={options} onChange={onChange} ariaLabel="League" />;
}
