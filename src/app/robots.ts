import type { MetadataRoute } from "next";

const baseUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://nietogreecare-site.vercel.app").replace(/\/$/, "");

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/crew", "/auth", "/api", "/payments"],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
