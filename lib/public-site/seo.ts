import type { Metadata } from "next";
import { publicPages, siteName, type PublicPath } from "./content";

export function resolvePublicOrigin(raw: string | undefined) {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    if (url.username || url.password || url.search || url.hash || url.pathname !== "/")
      return null;
    return url.protocol === "https:" || (loopback && url.protocol === "http:")
      ? url.origin
      : null;
  } catch {
    return null;
  }
}

export function publicOrigin() {
  return resolvePublicOrigin(process.env.AFTERCARE_PUBLIC_SITE_URL);
}

export function publicMetadata(path: PublicPath): Metadata {
  const entry = publicPages[path];
  const origin = publicOrigin();
  const title =
    path === "/" ? `${siteName} | ${entry.title}` : `${entry.title} | ${siteName}`;
  const image = "/aftercare/share.jpg";
  return {
    title,
    description: entry.description,
    metadataBase: new URL(origin ?? "http://localhost:3000"),
    alternates: origin ? { canonical: new URL(path, origin) } : undefined,
    ...(origin ? {} : { robots: { index: false, follow: false } }),
    openGraph: {
      title,
      description: entry.description,
      siteName,
      type: "website",
      locale: "tr_TR",
      url: origin ? new URL(path, origin) : undefined,
      images: [
        { url: image, width: 1200, height: 630, alt: "AfterCare Clinic ürün önizlemesi" }
      ]
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: entry.description,
      images: [image]
    }
  };
}
