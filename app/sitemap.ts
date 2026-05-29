import type { MetadataRoute } from "next";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.empirepicks.com";

const routes = [
  "/",
  "/games",
  "/pricing",
  "/transparency",
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
    changeFrequency: route === "/" || route === "/games" ? "hourly" : "monthly",
    priority: route === "/" ? 1 : route === "/pricing" || route === "/transparency" ? 0.8 : 0.6
  }));
}
