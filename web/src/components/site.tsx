"use client";
/**
 * Public site chrome: header (Home, Connect, Proof), footer, theme toggle and copyable code.
 * No dashboard providers, wallet, deposit controls or task dock: the public site only explains,
 * connects and shows recorded evidence.
 */
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { Check, Copy, Moon, Sun } from "lucide-react";

export const NETWORK_LABEL = "Sui Testnet · Walrus Memory Mainnet";
const PREFS_KEY = "sisih-prefs-v1"; // the theme preference visitors already had

const NAV = [
  { href: "/", label: "Home" },
  { href: "/connect", label: "Connect" },
  { href: "/proof", label: "Proof" },
];

function readTheme(): "light" | "dark" {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    const t = raw ? (JSON.parse(raw) as { theme?: string }).theme : undefined;
    if (t === "dark" || t === "light") return t;
  } catch {
    // storage unavailable: fall back to the system setting
  }
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark" | null>(null);
  useEffect(() => setTheme(readTheme()), []);
  const toggle = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.classList.toggle("dark", next === "dark");
    try {
      const raw = localStorage.getItem(PREFS_KEY);
      localStorage.setItem(PREFS_KEY, JSON.stringify({ ...(raw ? JSON.parse(raw) : {}), theme: next }));
    } catch {
      // not persisted; the toggle still works for this page
    }
  };
  return (
    <button type="button" className="icon-btn" onClick={toggle} aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"} title="Theme">
      {theme === "dark" ? <Sun size={16} aria-hidden /> : <Moon size={16} aria-hidden />}
    </button>
  );
}

export function SiteHeader() {
  const path = usePathname() ?? "/";
  const active = (href: string) => (href === "/" ? path === "/" : path.startsWith(href) || (href === "/proof" && path.startsWith("/receipts")));
  return (
    <header className="site-header">
      <div className="site-header-inner">
        <Link href="/" className="brand" aria-label="Sisih home">
          <img src="/brand/sisih-icon.png" alt="" width={28} height={28} />
          <span>Sisih</span>
        </Link>
        <nav aria-label="Primary">
          <ul>
            {NAV.map((n) => (
              <li key={n.href}>
                <Link href={n.href} aria-current={active(n.href) ? "page" : undefined}>
                  {n.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="site-header-end">
          <span className="network-badge" title="The networks of the hosted demo">
            {NETWORK_LABEL}
          </span>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <p>
          Hosted demo: {NETWORK_LABEL}. Testnet USDC has no monetary value. All merchants are operated by the Sisih project; ChainScope returns live onchain data and
          the others return labeled examples. A hackathon build, not audited.
        </p>
        <nav aria-label="Footer">
          <Link href="/connect">Connect</Link>
          <Link href="/proof">Proof</Link>
          <a href="/skills/sisih/SKILL.md">Agent skill</a>
        </nav>
      </div>
    </footer>
  );
}

export function CopyButton({ value, label }: { value: string; label: string }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  return (
    <button
      type="button"
      className="copy-btn"
      aria-label={state === "copied" ? `${label}: copied` : label}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setState("copied");
        } catch {
          setState("failed");
        }
        setTimeout(() => setState("idle"), 1800);
      }}
    >
      {state === "copied" ? <Check size={14} aria-hidden /> : <Copy size={14} aria-hidden />}
      <span aria-live="polite">{state === "copied" ? "Copied" : state === "failed" ? "Select and copy" : "Copy"}</span>
    </button>
  );
}

export function Code({ children, label, lang }: { children: string; label: string; lang?: string }) {
  return (
    <div className="code-block">
      <div className="code-head">
        <span>{lang ?? ""}</span>
        <CopyButton value={children} label={`Copy ${label}`} />
      </div>
      <pre tabIndex={0} aria-label={label}>
        <code>{children}</code>
      </pre>
    </div>
  );
}

/** Tabs for Bash / PowerShell (keyboard: arrow keys move between tabs). */
export function ShellTabs({ bash, powershell, label }: { bash: string; powershell: string; label: string }) {
  const [tab, setTab] = useState<"powershell" | "bash">("powershell");
  const tabs = [
    { id: "powershell" as const, name: "PowerShell" },
    { id: "bash" as const, name: "Bash / zsh" },
  ];
  return (
    <div className="shell-tabs">
      <div role="tablist" aria-label={`${label}: shell`}>
        {tabs.map((t, i) => (
          <button
            key={t.id}
            role="tab"
            type="button"
            id={`${label}-${t.id}`}
            aria-selected={tab === t.id}
            tabIndex={tab === t.id ? 0 : -1}
            onClick={() => setTab(t.id)}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
                const next = tabs[(i + (e.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length]!;
                setTab(next.id);
                document.getElementById(`${label}-${next.id}`)?.focus();
              }
            }}
          >
            {t.name}
          </button>
        ))}
      </div>
      <div role="tabpanel" aria-labelledby={`${label}-${tab}`}>
        <Code label={`${label} (${tab === "bash" ? "Bash" : "PowerShell"})`} lang={tab === "bash" ? "bash" : "powershell"}>
          {tab === "bash" ? bash : powershell}
        </Code>
      </div>
    </div>
  );
}

export function Section({ id, eyebrow, title, children, intro }: { id?: string; eyebrow?: string; title: string; intro?: ReactNode; children?: ReactNode }) {
  return (
    <section className="section" id={id} aria-labelledby={id ? `${id}-title` : undefined}>
      {eyebrow && <p className="eyebrow">{eyebrow}</p>}
      <h2 id={id ? `${id}-title` : undefined}>{title}</h2>
      {intro && <div className="section-intro">{intro}</div>}
      {children}
    </section>
  );
}
