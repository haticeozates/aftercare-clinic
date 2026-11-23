import type { Metadata } from "next";
import type { ReactNode } from "react";
import { requirePhase11 } from "@/lib/phase11/server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
  referrer: "no-referrer"
};

export default function AccountLayout({ children }: { children: ReactNode }) {
  requirePhase11();
  return children;
}
