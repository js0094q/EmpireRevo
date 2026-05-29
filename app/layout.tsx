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
    "Sportsbook pricing workstation for fair odds, line shopping, expected value context, and transparent market methodology.",
  offers: {
    "@type": "Offer",
    category: "Launch access",
    availability: "https://schema.org/PreOrder"
  }
};

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    template: "%s | EmpirePicks",
    default: "EmpirePicks"
  },
  description:
    "Find the best sportsbook prices before the market moves with enterprise-style fair odds and market diagnostics.",
  applicationName: "EmpirePicks",
  keywords: ["sports betting", "odds shopping", "fair odds", "expected value", "line shopping", "sportsbook"],
  openGraph: {
    title: "EmpirePicks",
    description: "Professional sportsbook pricing and opportunity board for real-time lineup decisions.",
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
    description: "Find the best sportsbook prices before the market moves.",
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
                <Link href="/pricing" className={layoutStyles.footerLink}>
                  Pricing
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
