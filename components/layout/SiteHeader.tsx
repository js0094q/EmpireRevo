"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrandMark } from "@/components/layout/BrandMark";
import layoutStyles from "./layout.module.css";
import { cn } from "@/lib/ui/cn";

export function SiteHeader() {
  const pathname = usePathname();

  return (
    <header className={layoutStyles.shellHeader}>
      <div className={layoutStyles.shellHeaderInner}>
        <Link href="/" className={layoutStyles.brandLink}>
          <BrandMark compact />
          <span className={layoutStyles.brandText}>
            <span className={layoutStyles.brandName}>EmpirePicks</span>
            <span className={layoutStyles.brandTag}>Fair price workstation</span>
          </span>
        </Link>

        <nav className={layoutStyles.nav} aria-label="Primary">
          <Link href="/" className={cn(layoutStyles.navLink, pathname === "/" && layoutStyles.navLinkActive)}>
            Board
          </Link>
          <Link href="/games" className={cn(layoutStyles.navLink, pathname?.startsWith("/games") && layoutStyles.navLinkActive)}>
            Games
          </Link>
        </nav>
      </div>
    </header>
  );
}
