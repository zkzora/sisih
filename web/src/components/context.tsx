"use client";
/**
 * Live dashboard state. Screens keep reading `state: DemoState`; it is now assembled from the
 * Sisih server (REST via TanStack Query) and kept fresh by ONE SSE connection. Nothing here
 * polls Tatum: the server caches vault state and pushes changes.
 *
 * Owner actions: the server-side route /api/sui-rpc builds the transaction through Tatum, the
 * connected wallet only SIGNS it, /api/sui-rpc executes the signed bytes through Tatum, and the
 * digest is posted to the server, which verifies it and refreshes the vault (lag-safe).
 */
import { createNetworkConfig, SuiClientProvider, useCurrentAccount, useSignTransaction, WalletProvider } from "@mysten/dapp-kit";
import { QueryClient, QueryClientProvider, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, CheckCircle2, ExternalLink, X } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import "@mysten/dapp-kit/dist/index.css";
import { buildState } from "@/lib/adapt";
import { api, ApiFailure, API_URL, demoToken, setDemoToken, type LiveActivity, type LiveClock, type LiveHealth, type LiveInsights, type LiveMemory, type LiveRecall, type LiveRequest, type LiveRule, type LiveSession, type LiveState, type LiveSuggestion } from "@/lib/live";
import type { Action, DemoState, Outcome } from "@/lib/types";
import { Spinner } from "./ui";

export type X402Step = "invoice_received" | "funds_released" | "payment_sent" | "settle_verified" | "failed";

type Toast = {
  id: number;
  message: string;
  error?: boolean;
  pending?: boolean;
  link?: { href: string; label: string };
  retry?: () => void;
};

type ContextValue = {
  state: DemoState;
  ready: boolean;
  /** No server data yet, or the last state read failed. */
  loadError: string | null;
  act: (action: Action) => Promise<Outcome>;
  reset: () => Promise<void>;
  notify: (message: string, error?: boolean) => void;
  moneyModal: "deposit" | "withdraw" | null;
  setMoneyModal: (v: "deposit" | "withdraw" | null) => void;
  storageError: boolean;
  retryStorage: () => void;
  unlocked: boolean;
  unlock: (token: string) => Promise<boolean>;
  lock: () => void;
  isOwner: boolean;
  walletAddress: string | null;
  x402Steps: Record<string, X402Step[]>;
  newRequestIds: Set<string>;
  refreshVault: () => Promise<void>;
  busy: string | null;
};

const SisihContext = createContext<ContextValue | null>(null);

const { networkConfig } = createNetworkConfig({
  // dapp-kit requires a JSON-RPC config; signing a pre-built transaction string never uses it.
  // No public fullnode: all Sui traffic goes through /api/sui-rpc -> Tatum.
  testnet: { url: "/api/sui-rpc/unused", network: "testnet" },
  mainnet: { url: "/api/sui-rpc/unused", network: "mainnet" },
});

const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: 1, refetchOnWindowFocus: false } } });

export function SisihProvider({ children }: { children: ReactNode }) {
  const network = (process.env.NEXT_PUBLIC_SUI_NETWORK === "mainnet" ? "mainnet" : "testnet") as "testnet" | "mainnet";
  return (
    <QueryClientProvider client={queryClient}>
      <SuiClientProvider networks={networkConfig} defaultNetwork={network}>
        <WalletProvider autoConnect>
          <LiveProvider>{children}</LiveProvider>
        </WalletProvider>
      </SuiClientProvider>
    </QueryClientProvider>
  );
}

const SCENARIO: Record<string, string> = { DataMart: "cheap_data", SearchBox: "new_merchant_search", ReportLab: "expensive_report" };

const EVENT_KEYS: [RegExp, string[]][] = [
  [/^request\./, ["requests", "insights", "state"]],
  [/^request\.recall/, ["recall"]],
  [/^x402\./, ["requests", "activity"]],
  [/^memory\./, ["memories", "state", "insights"]],
  [/^tx\./, ["activity"]],
  [/^state\./, ["state"]],
  [/^suggestion\./, ["suggestions", "state"]],
  [/^rule\./, ["rules", "insights"]],
  [/^session\./, ["sessions", "rules", "state", "insights", "clock", "memories"]],
  [/^demo\.(cycle_done|reset_done)/, ["state", "requests", "rules", "memories", "activity", "insights", "sessions", "suggestions", "clock", "recall"]],
];

const PREFS_KEY = "sisih-prefs-v1";

function LiveProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const account = useCurrentAccount();
  const { mutateAsync: signTransaction } = useSignTransaction();
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [moneyModal, setMoneyModal] = useState<"deposit" | "withdraw" | null>(null);
  const [prefs, setPrefs] = useState<{ theme: "light" | "dark"; demoBanner: boolean }>({ theme: "light", demoBanner: true });
  const [storageError, setStorageError] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [sseConnected, setSseConnected] = useState(false);
  const [x402Steps, setX402Steps] = useState<Record<string, X402Step[]>>({});
  const [newRequestIds, setNewRequestIds] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const toastId = useRef(0);

  // --- toasts ------------------------------------------------------------------------
  const pushToast = useCallback((t: Omit<Toast, "id">, ttl = 6000): number => {
    const id = ++toastId.current;
    setToasts((old) => [...old.slice(-3), { ...t, id }]);
    if (!t.pending) setTimeout(() => setToasts((old) => old.filter((x) => x.id !== id)), ttl);
    return id;
  }, []);
  const replaceToast = useCallback((id: number, t: Omit<Toast, "id">, ttl = 8000) => {
    setToasts((old) => old.map((x) => (x.id === id ? { ...t, id } : x)));
    if (!t.pending) setTimeout(() => setToasts((old) => old.filter((x) => x.id !== id)), ttl);
  }, []);
  const notify = useCallback((message: string, error = false) => void pushToast({ message, error }), [pushToast]);

  // --- local prefs + token -----------------------------------------------------------
  useEffect(() => {
    try {
      const raw = localStorage.getItem(PREFS_KEY);
      if (raw) setPrefs((p) => ({ ...p, ...JSON.parse(raw) }));
    } catch {
      setStorageError(true);
    }
    setUnlocked(Boolean(demoToken()));
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
    } catch {
      setStorageError(true);
    }
    document.documentElement.classList.toggle("dark", prefs.theme === "dark");
  }, [prefs]);

  // --- queries -----------------------------------------------------------------------
  const q = {
    state: useQuery({ queryKey: ["state"], queryFn: () => api<LiveState>("/api/state") }),
    requests: useQuery({ queryKey: ["requests"], queryFn: () => api<LiveRequest[]>("/api/requests") }),
    rules: useQuery({ queryKey: ["rules"], queryFn: () => api<LiveRule[]>("/api/rules") }),
    memories: useQuery({ queryKey: ["memories"], queryFn: () => api<LiveMemory[]>("/api/memories") }),
    activity: useQuery({ queryKey: ["activity"], queryFn: () => api<LiveActivity[]>("/api/activity") }),
    insights: useQuery({ queryKey: ["insights"], queryFn: () => api<LiveInsights>("/api/insights") }),
    sessions: useQuery({ queryKey: ["sessions"], queryFn: () => api<LiveSession[]>("/api/sessions") }),
    suggestions: useQuery({ queryKey: ["suggestions"], queryFn: () => api<LiveSuggestion[]>("/api/suggestions") }),
    clock: useQuery({ queryKey: ["clock"], queryFn: () => api<LiveClock>("/api/demo/clock") }),
    health: useQuery({ queryKey: ["health"], queryFn: () => api<LiveHealth>("/api/health"), refetchInterval: 30_000, staleTime: 15_000 }),
    recall: useQuery({ queryKey: ["recall"], queryFn: () => api<LiveRecall | null>("/api/recall/last") }),
    settings: useQuery({ queryKey: ["settings"], queryFn: () => api<{ defaultThreshold: string }>("/api/settings") }),
  };

  // --- one SSE connection ------------------------------------------------------------
  useEffect(() => {
    let es: EventSource | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const pending = new Set<string>();
    const flush = () => {
      for (const k of pending) void qc.invalidateQueries({ queryKey: [k] });
      pending.clear();
    };
    const queue = (keys: string[]) => {
      keys.forEach((k) => pending.add(k));
      clearTimeout(timer);
      timer = setTimeout(flush, 250);
    };
    const onEvent = (type: string, raw: string) => {
      for (const [re, keys] of EVENT_KEYS) if (re.test(type)) queue(keys);
      if (type.startsWith("x402.") || type === "request.created") {
        try {
          const d = JSON.parse(raw) as { id?: string };
          if (!d.id) return;
          if (type === "request.created") {
            setNewRequestIds((s) => new Set(s).add(d.id!));
            setTimeout(() => setNewRequestIds((s) => {
              const n = new Set(s);
              n.delete(d.id!);
              return n;
            }), 4000);
            return;
          }
          const step = type.replace("x402.", "") as X402Step;
          if (step === ("settled" as X402Step)) return;
          setX402Steps((m) => ({ ...m, [d.id!]: [...new Set([...(m[d.id!] ?? []), step])] }));
        } catch {
          /* ignore malformed event */
        }
      }
    };
    const types = [
      "request.created", "request.updated", "request.payment", "request.recall", "request.recall_failed",
      "x402.invoice_received", "x402.funds_released", "x402.payment_sent", "x402.settled", "x402.settle_verified", "x402.failed",
      "memory.writing", "memory.stored", "memory.failed", "tx.pending", "tx.confirmed", "tx.failed",
      "state.changed", "state.verified", "state.error", "state.lagging", "suggestion.created", "suggestion.accepted", "suggestion.rejected",
      "rule.created", "session.starting", "session.started", "demo.cycle_done", "demo.reset_done", "demo.reset_progress",
    ];
    const connect = () => {
      es = new EventSource(`${API_URL}/api/events`);
      es.onopen = () => setSseConnected(true);
      es.onerror = () => setSseConnected(false);
      for (const t of types) es.addEventListener(t, (e) => onEvent(t, (e as MessageEvent).data));
    };
    connect();
    return () => {
      clearTimeout(timer);
      es?.close();
    };
  }, [qc]);

  // --- assembled state ---------------------------------------------------------------
  const ready = Boolean(q.state.data);
  const state = useMemo<DemoState | null>(() => {
    if (!q.state.data) return null;
    return buildState({
      state: q.state.data,
      requests: q.requests.data ?? [],
      rules: q.rules.data ?? [],
      memories: q.memories.data ?? [],
      activity: q.activity.data ?? [],
      insights: q.insights.data ?? null,
      sessions: q.sessions.data ?? [],
      suggestions: q.suggestions.data ?? [],
      clock: q.clock.data ?? null,
      health: q.health.data ?? null,
      recall: q.recall.data ?? null,
      defaultThreshold: Number(q.settings.data?.defaultThreshold ?? 500000),
      prefs,
      walletAddress: account?.address ?? null,
      sseConnected,
    });
  }, [q.state.data, q.requests.data, q.rules.data, q.memories.data, q.activity.data, q.insights.data, q.sessions.data, q.suggestions.data, q.clock.data, q.health.data, q.recall.data, q.settings.data, prefs, account?.address, sseConnected]);

  const owner = q.state.data?.vault.owner ?? null;
  const isOwner = Boolean(account?.address && owner && account.address.toLowerCase() === owner.toLowerCase());
  const network = q.state.data?.network ?? "testnet";
  const explorerTx = (d: string) => `https://suiscan.xyz/${network}/tx/${d}`;

  // --- demo token --------------------------------------------------------------------
  const unlock = async (token: string) => {
    setDemoToken(token.trim());
    try {
      await api("/api/demo/token-check", { method: "POST" });
      setUnlocked(true);
      notify("Demo controls unlocked for this browser session.");
      return true;
    } catch {
      setDemoToken(null);
      setUnlocked(false);
      notify("That demo token was not accepted.", true);
      return false;
    }
  };
  const lock = () => {
    setDemoToken(null);
    setUnlocked(false);
  };

  // --- owner transactions ------------------------------------------------------------
  const sigRpc = async <T,>(body: unknown): Promise<T> => {
    const headers: Record<string, string> = { "content-type": "application/json" };
    const t = demoToken();
    if (t) headers["x-demo-token"] = t;
    const res = await fetch("/api/sui-rpc", { method: "POST", headers, body: JSON.stringify(body) });
    const json = await res.json();
    if (!res.ok) throw new ApiFailure(res.status, json.error ?? "Sui request failed", json.code ?? "error");
    return json as T;
  };

  const ownerTx = async (kind: string, args: Record<string, unknown>, label: string, after?: (digest: string) => Promise<void>): Promise<Outcome> => {
    const fail = (message: string): Outcome => ({ state: state!, message, error: true });
    if (!account) return fail("Connect the owner wallet to sign this action.");
    if (!isOwner) return fail("Connect the owner wallet to sign. This wallet is not the vault owner.");
    if (!unlocked) return fail("Demo controls are locked. Enter the demo token first.");
    const retry = () => void ownerTx(kind, args, label, after);
    const tid = pushToast({ message: `${label}: preparing transaction…`, pending: true });
    try {
      const { txJson } = await sigRpc<{ txJson: string }>({ op: "build", kind, args, sender: account.address });
      replaceToast(tid, { message: `${label}: waiting for your wallet signature…`, pending: true });
      const signed = await signTransaction({ transaction: txJson });
      replaceToast(tid, { message: `${label}: waiting for Sui confirmation…`, pending: true });
      const exec = await sigRpc<{ digest: string; success: boolean; error: string | null }>({ op: "execute", bytes: signed.bytes, signature: signed.signature });
      if (!exec.success) {
        replaceToast(tid, { message: `${label} failed on chain: ${exec.error ?? "rejected"}`, error: true, link: { href: explorerTx(exec.digest), label: "View transaction" }, retry });
        return fail(`${label} failed on chain.`);
      }
      // The server proves the digest through Tatum and refreshes the vault once it serves the new version.
      if (after) await after(exec.digest);
      else await api("/api/tx", { method: "POST", body: { digest: exec.digest, label } });
      replaceToast(tid, { message: `${label} confirmed and verified via Tatum.`, link: { href: explorerTx(exec.digest), label: exec.digest.slice(0, 10) + "…" } });
      return { state: state!, message: `${label} confirmed.` };
    } catch (err) {
      const message = err instanceof ApiFailure ? err.message : (err as Error).message ?? String(err);
      replaceToast(tid, { message: `${label} failed: ${message}`, error: true, retry });
      return fail(message);
    }
  };

  // --- actions -----------------------------------------------------------------------
  const call = async (label: string, fn: () => Promise<string>): Promise<Outcome> => {
    setBusy(label);
    try {
      const message = await fn();
      notify(message);
      return { state: state!, message };
    } catch (err) {
      const message = err instanceof ApiFailure ? (err.code === "demo_locked" ? "Demo controls are locked. Enter the demo token first." : err.message) : (err as Error).message;
      notify(message, true);
      return { state: state!, message, error: true };
    } finally {
      setBusy(null);
    }
  };

  const act = async (action: Action): Promise<Outcome> => {
    if (!state) return { state: state!, message: "Still loading.", error: true };
    const s = state;
    switch (action.type) {
      case "deposit":
        return ownerTx("deposit", { amount: String(action.amount) }, `Deposit ${(action.amount / 1e6).toFixed(2)} USDC`);
      case "withdraw":
        return ownerTx("withdraw_free", { amount: String(action.amount) }, `Withdraw ${(action.amount / 1e6).toFixed(2)} USDC`);
      case "emergency-withdraw":
        return ownerTx("emergency_withdraw_all", {}, "Emergency withdraw");
      case "request":
        return call("run-task", async () => {
          const r = await api<LiveRequest>("/api/demo/run-task", { method: "POST", body: { scenario: SCENARIO[action.merchant] } });
          return r.status === "held" ? `${r.merchant} request held: ${r.reasons[0] ?? ""}` : r.status === "auto_allowed" ? `${r.merchant}: approved automatically and paid over x402.` : `${r.merchant}: ${r.reasons[0] ?? "denied"}`;
        });
      case "decide": {
        const kind = action.decision === "approve" ? (action.remember ? "approve_and_remember" : "approve_once") : action.remember ? "deny_and_remember" : "deny";
        return call("decide", async () => {
          const rule = action.remember ? { maxAmount: String(action.remember.maxAmount), expiresMs: Date.parse(`${action.remember.expires}T23:59:59Z`) } : undefined;
          await api(`/api/requests/${action.requestId}/decision`, { method: "POST", body: { action: kind, rule } });
          return kind.startsWith("approve") ? (action.remember ? "Approved and remembered. Paying over x402." : "Approved once. Paying over x402.") : action.remember ? "Denied and remembered." : "Denied. No funds were released.";
        });
      }
      case "save-obligation": {
        const o = action.obligation;
        const existing = s.obligations.find((x) => x.id === o.id);
        if (existing) {
          if (existing.name !== o.name || existing.recipient !== o.recipient || existing.type !== o.type || existing.cycle !== o.cycle || existing.priority !== o.priority) {
            return { state: s, message: "On chain only the amount of a commitment can change. Remove it and add a new one to change other fields.", error: true };
          }
          return ownerTx("set_obligation_target", { id: Number(o.id), target: String(o.amount) }, `Update ${o.name}`);
        }
        const cycleMs = o.cycle === "Once" ? 0 : (s.live?.clock?.cycleMs ?? 120_000);
        const due = Date.parse(`${o.due}T00:00:00Z`);
        const firstDue = Number.isNaN(due) || due < Date.now() ? Date.now() + (cycleMs || 120_000) : due;
        return ownerTx(
          "add_obligation",
          { name: o.name, payee: o.recipient, target: String(o.amount), kind: o.type === "Usage-based" ? 1 : 0, cycleMs: String(cycleMs), firstDueMs: String(firstDue), priority: o.priority === "Essential" ? 0 : 1, cadenceLabel: o.cycle === "Once" ? "One-time" : o.cycle },
          `Add ${o.name}`,
        );
      }
      case "delete-obligation":
        return ownerTx("remove_obligation", { id: Number(action.id) }, "Remove commitment");
      case "pay-obligation": {
        const o = s.obligations.find((x) => x.id === action.id);
        return ownerTx("pay_obligation", { id: Number(action.id), bill: String(o?.amount ?? 0) }, `Pay ${o?.name ?? "commitment"}`);
      }
      case "accept-reserve": {
        const o = s.obligations.find((x) => x.id === action.id);
        const sid = o?.suggestionId;
        if (!sid) return { state: s, message: "No open suggestion for this commitment.", error: true };
        return ownerTx("set_obligation_target", { id: Number(action.id), target: String(action.amount) }, `Reserve ${o.name} ${(action.amount / 1e6).toFixed(2)} USDC`, async (digest) => {
          await api(`/api/suggestions/${sid}/accept`, { method: "POST", body: { digest } });
        });
      }
      case "dismiss-suggestion": {
        const sid = s.obligations.find((x) => x.id === action.id)?.suggestionId;
        if (!sid) return { state: s, message: "No open suggestion.", error: true };
        return call("dismiss", async () => {
          await api(`/api/suggestions/${sid}/reject`, { method: "POST" });
          return "Suggestion rejected and remembered.";
        });
      }
      case "toggle-rule": {
        const r = s.rules.find((x) => x.id === action.id);
        return call("rule", async () => {
          await api(`/api/rules/${action.id}`, { method: "PATCH", body: { active: !r?.active } });
          return r?.active ? "Rule disabled. A rule_disabled memory is being written." : "Rule enabled again.";
        });
      }
      case "agent-status": {
        if (action.status === "paused") return ownerTx("pause_agent", {}, "Pause agent");
        if (action.status === "revoked") return ownerTx("revoke_agent", {}, "Revoke agent permission");
        if (s.agentStatus === "paused") return ownerTx("resume_agent", {}, "Resume agent");
        return ownerTx(
          "set_agent_policy",
          { agent: q.state.data?.agentAddress, maxPerRequest: String(s.preferences.perRequest), maxPerDay: String(s.preferences.perDay), expiresMs: String(Date.now() + 30 * 86_400_000) },
          "Grant agent permission",
        );
      }
      case "wallet":
        return { state: s, message: action.connected ? "Use Connect wallet to choose a wallet." : "Disconnect from the wallet menu." };
      case "settings": {
        const p = action.preferences;
        setPrefs({ theme: p.theme, demoBanner: p.demoBanner });
        if (p.defaultThreshold !== s.preferences.defaultThreshold) {
          await call("settings", async () => {
            await api("/api/settings", { method: "PATCH", body: { defaultThreshold: String(p.defaultThreshold) } });
            return "Default threshold saved.";
          });
        }
        const limitsChanged = p.perRequest !== s.preferences.perRequest || p.perDay !== s.preferences.perDay || p.expires !== s.preferences.expires;
        if (limitsChanged) {
          return ownerTx(
            "set_agent_policy",
            { agent: s.live?.policy?.agent ?? q.state.data?.agentAddress, maxPerRequest: String(p.perRequest), maxPerDay: String(p.perDay), expiresMs: String(Date.parse(`${p.expires}T23:59:59Z`)) },
            "Update hard limits",
          );
        }
        return { state: s, message: "Preferences saved in this browser." };
      }
      case "advance-cycle":
        return call("advance-cycle", async () => {
          const r = await api<{ advanced: boolean; secondsToNextDue?: number; payments?: { name: string }[] }>("/api/demo/advance-cycle", { method: "POST" });
          return r.advanced ? `Cycle advanced: simulated income deposited, ${r.payments?.length ?? 0} commitments paid, reserves refilled.` : `Nothing is due yet. Next bills in ${r.secondsToNextDue ?? "?"} s (2-minute demo cycle).`;
        });
      case "new-session":
        return call("new-session", async () => {
          const r = await api<{ session: number; rules: { loaded: number } }>("/api/demo/new-session", { method: "POST" });
          return `Session ${r.session} started. ${r.rules.loaded} rules rebuilt from Walrus Memory.`;
        });
      default:
        return { state: s, message: "Not available in the live workspace.", error: true };
    }
  };

  const reset = async () => {
    const tid = pushToast({ message: "Resetting the demo vault on testnet (2-3 minutes)…", pending: true });
    setBusy("reset");
    try {
      const r = await api<{ namespace: string }>("/api/demo/reset", { method: "POST" });
      replaceToast(tid, { message: `Demo reset. Fresh vault and memory namespace ${r.namespace}.` });
      setX402Steps({});
    } catch (err) {
      replaceToast(tid, { message: `Reset failed: ${(err as Error).message}`, error: true });
    } finally {
      setBusy(null);
    }
  };

  const refreshVault = async () => {
    try {
      await api("/api/state/refresh", { method: "POST" });
      await qc.invalidateQueries({ queryKey: ["state"] });
    } catch (err) {
      notify((err as Error).message, true);
    }
  };

  const retryStorage = () => {
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
      setStorageError(false);
    } catch {
      setStorageError(true);
    }
  };

  const loadError = q.state.error ? (q.state.error as Error).message : null;

  return (
    <SisihContext.Provider
      value={{
        state: state ?? PLACEHOLDER,
        ready,
        loadError,
        act,
        reset,
        notify,
        moneyModal,
        setMoneyModal,
        storageError,
        retryStorage,
        unlocked,
        unlock,
        lock,
        isOwner,
        walletAddress: account?.address ?? null,
        x402Steps,
        newRequestIds,
        refreshVault,
        busy,
      }}
    >
      {children}
      <ToastStack toasts={toasts} onDismiss={(id) => setToasts((old) => old.filter((v) => v.id !== id))} />
    </SisihContext.Provider>
  );
}

export function ToastStack({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: number) => void }) {
  return (
    <div className="toast-stack" aria-live="polite" aria-atomic="false">
      {toasts.map((t) => (
        <div className={`toast ${t.error ? "toast-error" : ""}`} key={t.id}>
          {t.pending ? <Spinner label="" /> : t.error ? <AlertCircle size={19} /> : <CheckCircle2 size={19} />}
          <span>
            {t.message}
            {t.link && (
              <a className="toast-link" href={t.link.href} target="_blank" rel="noreferrer">
                {t.link.label} <ExternalLink size={11} />
              </a>
            )}
          </span>
          {t.retry && (
            <button className="text-button" onClick={t.retry}>
              Retry
            </button>
          )}
          <button aria-label="Dismiss notification" className="icon-button" onClick={() => onDismiss(t.id)}>
            <X size={15} />
          </button>
        </div>
      ))}
    </div>
  );
}

/** Rendered only before the first server response (the shell shows a skeleton then). */
const PLACEHOLDER: DemoState = {
  version: 1,
  balance: 0,
  session: 1,
  day: 0,
  agentStatus: "active",
  walletConnected: false,
  obligations: [],
  requests: [],
  memories: [],
  rules: [],
  activities: [],
  sessions: [],
  preferences: { defaultAction: "hold", defaultThreshold: 500000, perRequest: 5000000, perDay: 10000000, expires: "2026-12-05", network: "Testnet", theme: "light", demoBanner: true },
  cycle: 1,
  cycleAdvanced: false,
};

export function useSisih() {
  const context = useContext(SisihContext);
  if (!context) throw new Error("SisihProvider is required");
  return context;
}
