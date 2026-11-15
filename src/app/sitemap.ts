import type { MetadataRoute } from "next";

const baseUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://nietogreecare-site.vercel.app").replace(/\/$/, "");

export default function sitemap(): MetadataRoute.Sitemap {
  const pages = [
    { path: "/", priority: 1, frequency: "weekly" as const },
    { path: "/services", priority: 0.9, frequency: "monthly" as const },
    { path: "/pricing", priority: 0.8, frequency: "monthly" as const },
    { path: "/quote", priority: 0.8, frequency: "monthly" as const },
    { path: "/contact", priority: 0.8, frequency: "monthly" as const },
    { path: "/questions", priority: 0.6, frequency: "monthly" as const },
    { path: "/referrals", priority: 0.5, frequency: "monthly" as const },
  ];

  return pages.map(({ path, priority, frequency }) => ({
    url: baseUrl + (path === "/" ? "" : path),
    changeFrequency: frequency,
    priority,
  }));
}
