import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/help", "/privacy", "/terms", "/credits"],
      disallow: [
        "/api/",
        "/app/",
        "/auth/",
        "/matches/",
        "/login",
        "/register",
        "/forgot-password",
        "/reset-password",
        "/two-factor",
      ],
    },
    sitemap: new URL(
      "/sitemap.xml",
      process.env.BETTER_AUTH_URL || "https://truf-red.vercel.app",
    ).toString(),
  };
}
