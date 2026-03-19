import { cn } from "@/lib/ui/cn";
import layoutStyles from "./layout.module.css";

export function BrandMark({ compact = false, className }: { compact?: boolean; className?: string }) {
  return (
    <span className={cn(layoutStyles.brandMark, compact && layoutStyles.brandMarkCompact, className)} aria-hidden="true">
      <svg viewBox="0 0 48 48" fill="none">
        <rect x="3" y="3" width="42" height="42" rx="12" className={layoutStyles.brandMarkBase} />
        <path d="M12 31l10-9 6 5 8-10" className={layoutStyles.brandMarkLine} />
        <path d="M31 17h6v6" className={layoutStyles.brandMarkLine} />
      </svg>
    </span>
  );
}
