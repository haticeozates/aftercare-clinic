import type { MetadataRoute } from "next";
import { publicOrigin } from "@/lib/public-site/seo";

export default function robots(): MetadataRoute.Robots {
  const origin = publicOrigin();
  return {
    rules: origin
      ? {
          userAgent: "*",
          allow: "/",
          disallow: ["/clinic", "/care", "/login", "/internal", "/unauthorized", "/kayit",
            "/sifre-unuttum", "/sifre-yenile", "/auth", "/ekip", "/kurulum", "/randevu"]
        }
      : { userAgent: "*", disallow: "/" },
    sitemap: origin ? new URL("/sitemap.xml", origin).href : undefined
  };
}
