import type { Metadata } from "next";
import { Bricolage_Grotesque, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";

const display = Bricolage_Grotesque({ variable: "--font-display", subsets: ["latin"], display: "swap" });
const mono = JetBrains_Mono({ variable: "--font-mono-face", subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  title: "RECEIPTS — every crypto call gets a receipt",
  description:
    "Fact-check any crypto price call against live prediction-market odds (Cournot) and CoinMarketCap data, then anchor a tamper-proof receipt on BNB Chain.",
  openGraph: {
    title: "RECEIPTS — every crypto call gets a receipt",
    description: "Paste a call. Get the odds. Receipt anchored on BNB Chain forever.",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${display.variable} ${mono.variable} grain min-h-dvh`}>
        <Nav />
        <main className="relative">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
