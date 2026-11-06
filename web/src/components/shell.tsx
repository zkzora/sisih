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
import { ConnectButton } from "@mysten/dapp-kit";
import { DEMO_OWNER_LABEL, useSisih } from "./context";
import { Badge, Button, Overlay, Skeleton } from "./ui";
import { freeFunds, money } from "@/lib/engine";
import { TatumDot, useNow } from "./live-bits";
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
  const { state, ready, act, storageError, retryStorage, loadError, refreshVault, ownerSigner } = useSisih();
  const now = useNow(5000);
  const free = freeFunds(state);
  const live = state.live;
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
          <span className="sidebar-version">SISIH · SUI {state.preferences.network.toUpperCase()}</span>
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
              className={`available-meter ${free <= 0 ? "empty" : free < 1_000_000 ? "low" : ""}`}
              title="Free funds the agent may spend"
            >
              <span className="status-dot" />
              <span>
                {money(free)} <small>USDC available to agent</small>
              </span>
            </div>
            <Badge>
              <span className="status-dot" />
              Sui {state.preferences.network}
            </Badge>
            <span title={`Walrus Memory on mainnet · namespace ${live?.memory.namespace ?? ""}`}>
              <Badge tone="memory">
                Walrus Memory<span className="walrus-net"> · Mainnet</span> · {live?.memory.stored ?? 0} {live?.memory.stored === 1 ? "memory" : "memories"}
                {live?.memory.writing ? ` · ${live.memory.writing} writing` : ""}
              </Badge>
            </span>
            <TatumDot tatum={live?.tatum} now={now} onRetry={() => void refreshVault()} />
            <span className="topbar-session" title={`Session ${state.session}`}>
              <span className="session-long">Session </span>
              <span className="session-short">S</span>
              {state.session}
            </span>
            {ownerSigner === "demo" && (
              <span title="No owner wallet connected: deposits, reserve suggestions, pause and resume are signed on the server with the demo owner key. Testnet only.">
                <Badge tone="warning">{DEMO_OWNER_LABEL}</Badge>
              </span>
            )}
            <span className="wallet-connect">
              <Wallet size={14} />
              <ConnectButton connectText="Connect wallet" />
            </span>
          </div>
        </header>
        <main id="main-content" className="main-content">
          {state.preferences.demoBanner && (
            <div className="demo-banner">
              <FlaskConical size={13} />
              <span>
                Demo workspace{" "}
                <span className="demo-banner-detail">
                  · DataMart, SearchBox and ReportLab are demo merchants run by the Sisih team. Sui {state.preferences.network}; income is simulated and demo funds are recycled.
                </span>
              </span>
              <button onClick={() => setHelp(true)}>
                About this demo
                <ChevronRight size={12} />
              </button>
            </div>
          )}
          {loadError && (
            <div className="banner banner-danger">
              <AlertCircle size={17} />
              <span>Cannot reach the Sisih server: {loadError}</span>
              <Button variant="ghost" onClick={() => location.reload()}>
                Retry
              </Button>
            </div>
          )}
          {live?.tatum.level === "red" && (
            <div className="banner banner-danger">
              <AlertCircle size={17} />
              <span>Tatum RPC is not responding. Showing the last verified vault state.</span>
              <Button variant="ghost" onClick={() => void refreshVault()}>
                Retry
              </Button>
            </div>
          )}
          {storageError && (
            <div className="banner banner-warning">
              <AlertCircle size={17} />
              <span>
                Browser storage is unavailable. Your theme and banner preferences will not be kept.
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
                {state.agentStatus === "paused"
                  ? "Agent paused. All requests are denied."
                  : "Agent permission revoked. New spending requests are blocked."}
              </span>
              {state.agentStatus === "paused" ? (
                <Button
                  variant="ghost"
                  onClick={() =>
                    void act({ type: "agent-status", status: "active" })
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
            <span>
              Sui {state.preferences.network} · vault read through Tatum · memory on Walrus mainnet
            </span>
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
            Live on Sui {state.preferences.network}: the Move vault locks reserves, Tatum reads and verifies every transaction, Walrus Memory stores decisions and rules, and the agent pays demo merchants over x402. Income is simulated and demo funds are recycled.
          </p>
        </div>
      </Overlay>
    </div>
  );
}
