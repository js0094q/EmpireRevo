import { cn } from "@/lib/ui/cn";
import layoutStyles from "./layout.module.css";

export function BrandMark({ compact = false, className }: { compact?: boolean; className?: string }) {
  return (
    <span className={cn(layoutStyles.brandMark, compact && layoutStyles.brandMarkCompact, className)} aria-hidden="true">
      <svg viewBox="0 0 48 48" fill="none">
        <rect x="2" y="2" width="44" height="44" rx="14" className={layoutStyles.brandMarkBase} />
        <path d="M14 31h20" className={layoutStyles.brandMarkLine} />
        <path d="M16 24h16" className={layoutStyles.brandMarkLineMuted} />
        <path d="M16 17h16" className={layoutStyles.brandMarkLineMuted} />
      </svg>
    </span>
  );
}
