import type { Metadata } from "next";
import { Barlow_Condensed, Inter } from "next/font/google";
import { Nav } from "@/components/Nav";
import { getSnapshot } from "@/lib/data";
import "./globals.css";

const display = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-barlow-condensed",
});
const body = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "NFL Salary Cap Tracker",
  description:
    "Where every NFL team's salary cap goes, by unit and position group, and how much of it is on the field this week.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const snapshot = await getSnapshot();
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body className="min-h-screen antialiased">
        <Nav snapshot={snapshot} />
        {children}
        <footer className="mx-auto max-w-7xl border-t border-border px-4 py-6 text-xs text-fg-faint sm:px-6">
          Data from nflverse (CC BY 4.0), contract data sourced from OverTheCap. Personal project, not
          affiliated with the NFL.
        </footer>
      </body>
    </html>
  );
}
