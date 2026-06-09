import type { MetadataRoute } from "next";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.empirepicks.com";

const routes = [
  "/",
  "/history",
  "/transparency",
  "/learn",
  "/learn/ev-betting",
  "/learn/clv",
  "/learn/bankroll",
  "/learn/line-shopping",
  "/learn/market-inefficiencies",
  "/props",
  "/about",
  "/contact",
  "/faq",
  "/responsible-gaming",
  "/terms",
  "/privacy"
];

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return routes.map((route) => ({
    url: `${siteUrl}${route}`,
    lastModified: now,
    changeFrequency: route === "/" ? "hourly" : "monthly",
    priority: route === "/" ? 1 : route === "/history" || route === "/transparency" ? 0.8 : 0.6
  }));
}
