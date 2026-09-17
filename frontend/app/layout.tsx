import type { Metadata } from "next";
import { IBM_Plex_Sans, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { ToastProvider } from "@/components/ui/Toast";

// Outfit / DM Sans (the brief's alternates) ship without a "vietnamese" glyph
// subset, so Vietnamese diacritics would silently fall back to a system font.
// Plus Jakarta Sans and IBM Plex Sans both carry the vietnamese subset.
const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin", "vietnamese"],
  weight: ["500", "600", "700", "800"],
  variable: "--font-jakarta",
  display: "swap",
});

const plexSans = IBM_Plex_Sans({
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-plex",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Thư viện Trường học",
  description: "Hệ thống quản lý thư viện trường học đa trường",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" className={`${jakarta.variable} ${plexSans.variable}`}>
      <body>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
