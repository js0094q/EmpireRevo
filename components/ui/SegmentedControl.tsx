import { Button } from "@/components/ui/Button";
import styles from "./ui.module.css";

type SegmentedOption<T extends string> = {
  value: T;
  label: string;
};

type SegmentedControlProps<T extends string> = {
  value: T;
  options: readonly SegmentedOption<T>[];
  onChange: (value: T) => void;
  ariaLabel: string;
};

export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  ariaLabel
}: SegmentedControlProps<T>) {
  return (
    <div className={styles.segmented} role="tablist" aria-label={ariaLabel}>
      {options.map((option) => (
        <Button
          key={option.value}
          active={option.value === value}
          role="tab"
          aria-selected={option.value === value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </Button>
      ))}
    </div>
  );
}
