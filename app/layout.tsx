import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "EmpirePicks",
  description: "Live market intelligence powered by weighted sportsbook consensus.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
