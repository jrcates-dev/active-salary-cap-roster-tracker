import type { Metadata } from "next";
import { Barlow_Condensed, Inter } from "next/font/google";
import { BottomTabs } from "@/components/site/BottomTabs";
import { Footer } from "@/components/site/Footer";
import { Header } from "@/components/site/Header";
import { ScrollMemory } from "@/components/site/ScrollMemory";
import { getSnapshot } from "@/lib/data";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
/** The display face: titles and standalone figures, set like a scoreboard. */
const barlow = Barlow_Condensed({ subsets: ["latin"], weight: ["500", "600", "700"], variable: "--font-barlow", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Cap Tracker", template: "%s · Cap Tracker" },
  description:
    "Where every NFL team's salary cap goes, by unit and position group, and how much of it is on the field this week.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const snapshot = await getSnapshot();
  return (
    <html lang="en" className={`${inter.variable} ${barlow.variable}`}>
      <body className="flex min-h-screen flex-col pb-[calc(3.5rem+env(safe-area-inset-bottom))] antialiased sm:pb-0">
        <ScrollMemory />
        <Header snapshot={snapshot} />
        <div className="flex-1">{children}</div>
        <Footer snapshot={snapshot} />
        <BottomTabs />
      </body>
    </html>
  );
}
