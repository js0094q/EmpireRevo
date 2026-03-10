import type { BoardSortKey } from "@/components/board/board-helpers";
import { SORT_OPTIONS } from "@/components/board/board-helpers";
import { Select } from "@/components/ui/Select";

export function SortControl({
  value,
  onChange,
  className
}: {
  value: BoardSortKey;
  onChange: (value: BoardSortKey) => void;
  className?: string;
}) {
  return (
    <Select className={className} value={value} onChange={(event) => onChange(event.target.value as BoardSortKey)} aria-label="Sort rows">
      {SORT_OPTIONS.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </Select>
  );
}
