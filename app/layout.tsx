import "./globals.css";
import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { Analytics } from "@vercel/analytics/next";
import { SiteHeader } from "@/components/layout/SiteHeader";
import layoutStyles from "@/components/layout/layout.module.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.empirepicks.com";
const structuredData = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "EmpirePicks",
  applicationCategory: "FinanceApplication",
  operatingSystem: "Web",
  url: siteUrl,
  description:
    "Testing-phase sportsbook pricing workstation for fair odds, line shopping, expected value context, and transparent market methodology.",
};

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    template: "%s | EmpirePicks",
    default: "EmpirePicks"
  },
  description:
    "Read-only testing preview of sportsbook prices, no-vig fair lines, market freshness, and transparent diagnostics.",
  applicationName: "EmpirePicks",
  keywords: ["sports betting", "odds shopping", "fair odds", "expected value", "line shopping", "sportsbook"],
  openGraph: {
    title: "EmpirePicks",
    description: "Testing-phase sportsbook pricing board for fair-line and market-freshness review.",
    type: "website",
    images: [
      {
        url: "/opengraph-image.png",
        width: 1200,
        height: 630,
        alt: "EmpirePicks board screenshot"
      }
    ]
  },
  twitter: {
    card: "summary_large_image",
    title: "EmpirePicks",
    description: "Read-only testing preview of fair-line and market-freshness analytics.",
    images: ["/opengraph-image.png"]
  },
  icons: {
    icon: "/icon.svg",
    shortcut: "/icon.svg"
  },
  manifest: "/site.webmanifest"
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <a href="#main-content" className="skip-link">
          Skip to content
        </a>
        <div className={layoutStyles.shell}>
          <SiteHeader />
          <main id="main-content" className={layoutStyles.main}>
            <div className={layoutStyles.container}>{children}</div>
          </main>
          <footer className={layoutStyles.footer}>
            <div className={layoutStyles.footerInner}>
              <nav className={layoutStyles.footerLinks} aria-label="Legal and product links">
                <Link href="/about" className={layoutStyles.footerLink}>
                  About
                </Link>
                <Link href="/contact" className={layoutStyles.footerLink}>
                  Contact
                </Link>
                <Link href="/props" className={layoutStyles.footerLink}>
                  Props
                </Link>
                <Link href="/history" className={layoutStyles.footerLink}>
                  Record
                </Link>
                <Link href="/transparency" className={layoutStyles.footerLink}>
                  Transparency
                </Link>
                <Link href="/learn" className={layoutStyles.footerLink}>
                  Learn
                </Link>
                <Link href="/faq" className={layoutStyles.footerLink}>
                  FAQ
                </Link>
                <Link href="/terms" className={layoutStyles.footerLink}>
                  Terms
                </Link>
                <Link href="/privacy" className={layoutStyles.footerLink}>
                  Privacy
                </Link>
                <Link href="/responsible-gaming" className={layoutStyles.footerLink}>
                  Responsible Gaming
                </Link>
              </nav>
              <p className={layoutStyles.footerLegal}>© {new Date().getFullYear()} EmpirePicks. Not advice for wagering.</p>
            </div>
          </footer>
        </div>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
        <Analytics />
      </body>
    </html>
  );
}
