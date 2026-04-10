import "./globals.css";
import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import { SiteHeader } from "@/components/layout/SiteHeader";
import layoutStyles from "@/components/layout/layout.module.css";

export const metadata: Metadata = {
  title: "EmpirePicks",
  description: "Professional sportsbook pricing board for fair value, line shopping, and market diagnostics."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className={layoutStyles.shell}>
          <SiteHeader />
          <main className={layoutStyles.main}>
            <div className={layoutStyles.container}>{children}</div>
          </main>
        </div>
        <Analytics />
      </body>
    </html>
  );
}
