import type { Metadata } from "next";
import { DM_Sans, Geist_Mono } from "next/font/google";
import { SiteFooter, SiteHeader } from "@/components/site";
import "./tokens.css";
import "./site.css";

const sans = DM_Sans({ subsets: ["latin"], variable: "--font-dm-sans", display: "swap" });
const mono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono", display: "swap" });

export const metadata: Metadata = {
  title: "Sisih: your agent spends only money you haven't promised",
  description:
    "Sisih protects committed funds while an agent buys services. Verified Sui Mainnet x402 payments, owner preferences on Walrus Memory, and a reserve boundary that memory cannot override.",
  icons: { icon: "/brand/sisih-icon.png" },
};

// Applies the saved (or system) theme before paint, so there is no light flash in dark mode.
const THEME_SCRIPT = `try{var p=JSON.parse(localStorage.getItem("sisih-prefs-v1")||"{}");var d=p.theme?p.theme==="dark":matchMedia("(prefers-color-scheme: dark)").matches;if(d)document.documentElement.classList.add("dark")}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className={`${sans.variable} ${mono.variable}`}>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <SiteHeader />
        <main id="main" tabIndex={-1}>
          {children}
        </main>
        <SiteFooter />
      </body>
    </html>
  );
}
