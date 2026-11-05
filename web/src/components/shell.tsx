"use client";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import {
  LayoutDashboard,
  CalendarRange,
  Bot,
  Brain,
  ChartNoAxesCombined,
  ArrowLeftRight,
  Settings2,
  ChevronDown,
  ChevronRight,
  Menu,
  X,
  LockKeyhole,
  FlaskConical,
  CircleHelp,
  ExternalLink,
  Wallet,
  Pause,
  AlertCircle,
} from "lucide-react";
import { useSisih } from "./context";
import { Badge, Button, Overlay, Skeleton } from "./ui";
import { freeFunds, money, short, address } from "@/lib/engine";
import { MoneyDialog } from "./money-dialog";
import { DemoDock } from "./demo-dock";
const navigation = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/obligations", label: "Commitments", icon: CalendarRange },
  { href: "/agent", label: "Agent & requests", icon: Bot },
  { href: "/memory", label: "Memory", icon: Brain },
  { href: "/learning", label: "Learning impact", icon: ChartNoAxesCombined },
  { href: "/activity", label: "Onchain activity", icon: ArrowLeftRight },
  { href: "/settings", label: "Settings", icon: Settings2 },
];
export function Shell({ children }: { children: ReactNode }) {
  const { state, ready, act, storageError, retryStorage } = useSisih();
  const pathname = usePathname();
  const [mobile, setMobile] = useState(false);
  const [help, setHelp] = useState(false);
  const current = navigation.find((n) => n.href === pathname) || navigation[0];
  const held = state.requests.filter((r) => r.status === "held").length;
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      {mobile && (
        <button
          className="mobile-backdrop"
          aria-label="Close navigation"
          onClick={() => setMobile(false)}
        />
      )}
      <aside className={`sidebar ${mobile ? "mobile-open" : ""}`}>
        <div className="sidebar-brand">
          <Link href="/" aria-label="Sisih overview">
            <Image
              src="/brand/sisih-logo.png"
              alt="sisih"
              width={120}
              height={40}
              priority
            />
          </Link>
          <button
            className="icon-button mobile-close"
            aria-label="Close navigation"
            onClick={() => setMobile(false)}
          >
            <X size={20} />
          </button>
        </div>
        <button className="workspace-picker" onClick={() => setHelp(true)}>
          <span className="workspace-icon">
            <Wallet size={17} />
          </span>
          <span>
            <strong>Personal vault</strong>
            <small>Research Agent</small>
          </span>
          <ChevronDown size={14} />
        </button>
        <div className="nav-heading">WORKSPACE</div>
        <nav aria-label="Main navigation">
          {navigation.map((n) => (
            <Link
              href={n.href}
              key={n.href}
              className={`nav-link ${pathname === n.href ? "active" : ""}`}
              aria-current={pathname === n.href ? "page" : undefined}
              onClick={() => setMobile(false)}
            >
              <n.icon size={18} strokeWidth={1.7} />
              <span>{n.label}</span>
              {n.href === "/agent" && held > 0 && (
                <span className="nav-count">{held}</span>
              )}
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-rule">
            <LockKeyhole size={18} />
            <span>
              Your money has a purpose.
              <br />
              <strong>Your agent has a limit.</strong>
            </span>
          </div>
          <button className="sidebar-help" onClick={() => setHelp(true)}>
            <CircleHelp size={16} />
            How Sisih works
            <ExternalLink size={12} />
          </button>
          <span className="sidebar-version">SISIH / DEMO WORKSPACE</span>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-button mobile-menu"
              aria-label="Open navigation"
              onClick={() => setMobile(true)}
            >
              <Menu size={20} />
            </button>
            <span className="muted">Workspace</span>
            <ChevronRight size={13} />
            <span>{current.label}</span>
          </div>
          <div className="topbar-right">
            <div
              className={`available-meter ${freeFunds(state) < 1_000_000 ? "low" : ""}`}
            >
              <span className="status-dot" />
              <span>
                {money(freeFunds(state))} <small>USDC available</small>
              </span>
            </div>
            <span className="topbar-session">Session {state.session}</span>
            <Badge>
              <span className="status-dot" />
              Demo · {state.preferences.network}
            </Badge>
            <button
              className="wallet-button"
              onClick={() =>
                act({ type: "wallet", connected: !state.walletConnected })
              }
            >
              <Wallet size={14} />
              {state.walletConnected ? short(address) : "Demo wallet"}
              <span className="avatar">YO</span>
            </button>
          </div>
        </header>
        <main id="main-content" className="main-content">
          {state.preferences.demoBanner && (
            <div className="demo-banner">
              <FlaskConical size={13} />
              <span>
                Demo workspace{" "}
                <span className="demo-banner-detail">
                  · Simulated USDC, payments, and memory. No live wallet
                  connection.
                </span>
              </span>
              <button onClick={() => setHelp(true)}>
                About this demo
                <ChevronRight size={12} />
              </button>
            </div>
          )}
          {storageError && (
            <div className="banner banner-warning">
              <AlertCircle size={17} />
              <span>
                Browser storage is unavailable. Changes may not survive a
                reload.
              </span>
              <Button variant="ghost" onClick={retryStorage}>
                Retry save
              </Button>
            </div>
          )}
          {state.agentStatus !== "active" && (
            <div className="banner banner-warning">
              <Pause size={16} />
              <span>
                Agent{" "}
                {state.agentStatus === "paused"
                  ? "paused"
                  : "permission revoked"}
                . New spending requests are blocked.
              </span>
              {state.agentStatus === "paused" ? (
                <Button
                  variant="ghost"
                  onClick={() =>
                    act({ type: "agent-status", status: "active" })
                  }
                >
                  Resume agent
                </Button>
              ) : (
                <Link href="/settings" className="text-button">
                  Manage permission
                </Link>
              )}
            </div>
          )}
          {ready ? children : <Skeleton />}
          <footer className="page-footer">
            <span>
              <LockKeyhole size={12} />
              Committed funds stay out of reach.
            </span>
            <span>Local demo · No Mainnet transactions</span>
          </footer>
        </main>
      </div>
      <MoneyDialog />
      <DemoDock />
      <Overlay
        open={help}
        onClose={() => setHelp(false)}
        title="A little space for your agent."
        description="Sisih separates money you have committed from money your agent can spend."
        kind="modal"
      >
        <div className="help-steps">
          <div>
            <span>01</span>
            <h3>Set money aside</h3>
            <p>
              Reserve funds for onchain commitments such as API subscriptions,
              hosting, and savings.
            </p>
          </div>
          <div>
            <span>02</span>
            <h3>Give your agent room</h3>
            <p>
              Only uncommitted funds are available. Review unfamiliar merchants
              and remember your preferences.
            </p>
          </div>
          <div>
            <span>03</span>
            <h3>Keep the boundary</h3>
            <p>
              A remembered rule never overrides reserve, daily, or per-request
              limits.
            </p>
          </div>
        </div>
        <div className="info-box">
          <FlaskConical size={18} />
          <p>
            This is a working frontend demo. Balances, payments, and memories
            stay in your browser. Sui, Tatum, Walrus, and x402 are not
            connected.
          </p>
        </div>
      </Overlay>
    </div>
  );
}
