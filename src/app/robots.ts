import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.kirayah.xyz";

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin/", "/api/", "/dashboard/", "/(auth)/"],
      },
      {
        userAgent: [
          "Google-Extended",
          "GPTBot",
          "PerplexityBot",
          "ClaudeBot",
          "Bytespider",
          "CCBot",
        ],
        allow: "/",
        disallow: ["/admin/", "/api/", "/dashboard/"],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
