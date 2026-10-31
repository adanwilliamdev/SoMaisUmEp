import type { MetadataRoute } from "next";

const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: site, changeFrequency: "daily", priority: 1 },
    { url: `${site}/?tipo=movie`, changeFrequency: "daily", priority: 0.8 },
    { url: `${site}/?tipo=tv`, changeFrequency: "daily", priority: 0.8 },
  ];
}
