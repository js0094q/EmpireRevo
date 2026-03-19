import { Input } from "@/components/ui/Input";

export function SearchControl({
  value,
  onChange,
  className
}: {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  return (
    <Input
      className={className}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder="Search Teams or Matchup"
      aria-label="Search matchups"
    />
  );
}
