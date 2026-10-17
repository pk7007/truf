import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.BETTER_AUTH_URL || "https://truf-red.vercel.app";
  return ["", "/help", "/privacy", "/terms", "/credits"].map((path) => ({
    url: new URL(path || "/", base).toString(),
    changeFrequency: path ? ("monthly" as const) : ("weekly" as const),
    priority: path ? 0.6 : 1,
  }));
}
