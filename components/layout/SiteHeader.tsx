"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrandMark } from "@/components/layout/BrandMark";
import layoutStyles from "./layout.module.css";
import { cn } from "@/lib/ui/cn";

const NAV_ITEMS = [
  { href: "/", label: "Board" },
  { href: "/games", label: "Games" },
  { href: "/pricing", label: "Pricing" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" }
];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SiteHeader() {
  const pathname = usePathname();

  return (
    <header className={layoutStyles.shellHeader}>
      <div className={layoutStyles.shellHeaderInner}>
        <Link href="/" className={layoutStyles.brandLink}>
          <BrandMark compact />
          <span className={layoutStyles.brandText}>
            <span className={layoutStyles.brandName}>EmpirePicks</span>
            <span className={layoutStyles.brandTag}>Betting analytics workstation</span>
          </span>
        </Link>

        <nav className={layoutStyles.nav} aria-label="Primary desktop">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(layoutStyles.navLink, pathname && isActive(pathname, item.href) && layoutStyles.navLinkActive)}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
      <nav className={layoutStyles.mobileNav} aria-label="Primary mobile">
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(layoutStyles.mobileNavLink, pathname && isActive(pathname, item.href) && layoutStyles.mobileNavLinkActive)}
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
