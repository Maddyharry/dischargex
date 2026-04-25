import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/admin",
          "/app",
          "/chat",
          "/api/",
        ],
      },
    ],
    sitemap: "https://dischargex.net/sitemap.xml",
    host: "https://dischargex.net",
  };
}
