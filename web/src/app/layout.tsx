import type { Metadata } from "next";
import { DM_Sans, Geist_Mono } from "next/font/google";
import { SisihProvider } from "@/components/context";
import { Shell } from "@/components/shell";
import "./globals.css";
import "./live.css";
const sans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
  display: "swap",
});
const mono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
  display: "swap",
});
export const metadata: Metadata = {
  title: "Sisih — Protect commitments. Give your agent room.",
  description:
    "A spending workspace that separates committed funds from money your AI agent can use. Live on Sui testnet: Move vault, Tatum Sui RPC, Walrus Memory, x402.",
  icons: { icon: "/brand/sisih-icon.png" },
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${sans.variable} ${mono.variable}`}>
        <SisihProvider>
          <Shell>{children}</Shell>
        </SisihProvider>
      </body>
    </html>
  );
}
