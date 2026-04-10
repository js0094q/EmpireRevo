import type { ReactNode } from "react";
import styles from "./primitives.module.css";
import { cn } from "@/lib/ui/cn";

type TabOption = {
  value: string;
  label: string;
  disabled?: boolean;
  href?: string | null;
};

export function Tabs({
  value,
  options,
  onChange,
  renderOption
}: {
  value: string;
  options: TabOption[];
  onChange?: (value: string) => void;
  renderOption?: (option: TabOption, content: ReactNode) => ReactNode;
}) {
  return (
    <div className={styles.tabs} role="tablist">
      {options.map((option) => {
        const content = (
          <button
            type="button"
            role="tab"
            disabled={option.disabled}
            aria-selected={option.value === value}
            className={cn(styles.tab, option.value === value && styles.tabActive)}
            onClick={() => onChange?.(option.value)}
          >
            {option.label}
          </button>
        );
        return renderOption ? <span key={option.value}>{renderOption(option, content)}</span> : <span key={option.value}>{content}</span>;
      })}
    </div>
  );
}
