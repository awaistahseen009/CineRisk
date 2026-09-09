import type { Metadata } from "next";
import { Inter, Inter_Tight, JetBrains_Mono } from "next/font/google";
import AmbientRibbons from "@/components/AmbientRibbons";
import AppHeader from "@/components/AppHeader";
import "./globals.css";

const interTight = Inter_Tight({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-display",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-body",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "CineRisk: Pre-Release Content Risk Audit",
  description:
    "Audit scripts for cultural sensitivity, defamation, and IP risk before you publish. Every flag is backed by a real, cited source.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${interTight.variable} ${inter.variable} ${jetbrainsMono.variable}`}>
      <body className="min-h-screen font-body text-ink-primary antialiased">
        {/* Fixed behind every page -- ground color, dot-grid, and ambient
            glow all live here (see .ambient-bg in globals.css) rather than
            on body itself, so cards and sections can layer visibly on top
            of one continuous atmosphere instead of flat black. */}
        <div className="ambient-bg" aria-hidden>
          <AmbientRibbons />
          <div className="vignette" />
        </div>
        <AppHeader />
        {children}
      </body>
    </html>
  );
}
