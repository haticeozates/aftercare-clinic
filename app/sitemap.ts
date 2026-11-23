import type { MetadataRoute } from "next";
import { publicPages } from "@/lib/public-site/content";
import { publicOrigin } from "@/lib/public-site/seo";

export default function sitemap(): MetadataRoute.Sitemap {
  const origin = publicOrigin();
  return origin
    ? Object.keys(publicPages).map((path) => ({ url: new URL(path, origin).href }))
    : [];
}
