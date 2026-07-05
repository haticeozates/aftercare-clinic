import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AfterCare Clinic Platform",
  description: "Production foundation for AfterCare Clinic"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="tr">
      <body>{children}</body>
    </html>
  );
}
