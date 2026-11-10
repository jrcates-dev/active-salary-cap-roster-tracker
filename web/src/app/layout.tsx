import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Footer } from "@/components/site/Footer";
import { Header } from "@/components/site/Header";
import { ScrollMemory } from "@/components/site/ScrollMemory";
import { getSnapshot } from "@/lib/data";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Cap Tracker", template: "%s · Cap Tracker" },
  description:
    "Where every NFL team's salary cap goes, by unit and position group, and how much of it is on the field this week.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const snapshot = await getSnapshot();
  return (
    <html lang="en" className={inter.variable}>
      <body className="flex min-h-screen flex-col antialiased">
        <ScrollMemory />
        <Header snapshot={snapshot} />
        <div className="flex-1">{children}</div>
        <Footer snapshot={snapshot} />
      </body>
    </html>
  );
}
