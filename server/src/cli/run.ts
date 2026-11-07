/**
 * The Sisih owner CLI: configure commitments and the agent's authority, decide held requests,
 * inspect evidence, from a terminal. It calls the deployment's HTTP API with the owner token
 * (x-demo-token); the agent's MCP credential is never used or accepted here.
 *
 * Signing model (testnet demo): owner transactions are signed on the server by the demo owner key
 * and labeled "Demo owner (server-signed, testnet)". A user-controlled wallet is the dashboard path.
 */
import { COMMANDS, VERSION, type CommandSpec } from "./spec";
import { parseArgs, toBaseUnits, usageLine } from "./parse";

export const EXIT = { ok: 0, failed: 1, usage: 2, auth: 3, busy: 4, notFound: 5 } as const;
const DEFAULT_URL = "https://sisih-azure.vercel.app";
const SIGNING = 'Owner actions are signed on the server by "Demo owner (server-signed, testnet)", not by your own wallet.';

export interface Deps {
  fetch: typeof fetch;
  env: (name: string) => string | undefined;
  out: (line: string) => void;
  err: (line: string) => void;
}

class CliError extends Error {
  constructor(message: string, public code: number, public data?: unknown) {
    super(message);
  }
}

const usd = (base: string | number | bigint | null | undefined) => {
  if (base === null || base === undefined || base === "") return "-";
  const n = BigInt(base);
  const neg = n < 0n;
  const a = neg ? -n : n;
  return `${neg ? "-" : ""}${a / 1_000_000n}.${(a % 1_000_000n).toString().padStart(6, "0").slice(0, 2)}`;
};
const date = (ms: number | null | undefined) => (ms ? new Date(ms).toISOString().replace("T", " ").slice(0, 16) + " UTC" : "-");
const tx = (d: string) => `https://suiscan.xyz/testnet/tx/${d}`;
const pad = (s: string, n: number) => (s.length >= n ? s : s + " ".repeat(n - s.length));

function helpText(topic?: CommandSpec): string {
  if (topic) return [`Usage: ${usageLine(topic)}`, "", topic.summary, topic.mutates ? "Changes state: needs the owner token (SISIH_OWNER_TOKEN)." : "Read only.", "", "Options: --json (machine-readable), --url <deployment>, --hold (keep the shared demo run after a change)"].join("\n");
  const groups = [...new Set(COMMANDS.map((c) => c.group))];
  const lines = [
    `sisih ${VERSION}: Sisih owner CLI. Your agent spends only money you haven't promised.`,
    "",
    "Usage: pnpm sisih <command> [arguments] [--json]",
    "",
  ];
  for (const g of groups) {
    lines.push(`${g}:`);
    for (const c of COMMANDS.filter((x) => x.group === g)) lines.push(`  ${pad(usageLine(c).replace(/^sisih /, ""), 58)} ${c.summary}`);
    lines.push("");
  }
  lines.push(
    "Environment:",
    "  SISIH_URL           deployment (default https://sisih-azure.vercel.app)",
    "  SISIH_OWNER_TOKEN   owner token for changes (the demo token); never give it to the agent",
    "",
    SIGNING,
    "Help, version and invalid arguments never send a request.",
  );
  return lines.join("\n");
}

export async function main(argv: string[], deps: Deps): Promise<number> {
  const p = parseArgs(argv);
  if (p.kind === "help") {
    deps.out(helpText(p.topic));
    return EXIT.ok;
  }
  if (p.kind === "version") {
    deps.out(`sisih ${VERSION}`);
    return EXIT.ok;
  }
  if (p.kind === "usage_error") {
    deps.err(`Error: ${p.message}`);
    deps.err(p.topic ? `Usage: ${usageLine(p.topic)}` : "Run `pnpm sisih help` for the commands.");
    return EXIT.usage;
  }

  const base = (p.url ?? deps.env("SISIH_URL") ?? DEFAULT_URL).replace(/\/$/, "");
  const token = deps.env("SISIH_OWNER_TOKEN") ?? deps.env("DEMO_TOKEN");
  const client = deps.env("SISIH_CLIENT_ID") ?? "owner-cli";
  if (p.spec.mutates && !token) {
    deps.err("Error: this command changes state and needs the owner token. Set SISIH_OWNER_TOKEN (the demo token, from a private channel).");
    return EXIT.auth;
  }

  const call = async <T = any>(method: "GET" | "POST" | "PATCH", path: string, body?: unknown): Promise<T> => {
    const headers: Record<string, string> = {};
    if (body !== undefined) headers["content-type"] = "application/json";
    if (method !== "GET" && token) Object.assign(headers, { "x-demo-token": token, "x-demo-client": client });
    let res: Response;
    try {
      res = await deps.fetch(`${base}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    } catch (e) {
      throw new CliError(`Could not reach ${base}: ${(e as Error).message}`, EXIT.failed);
    }
    const text = await res.text();
    let json: any = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = { error: text.slice(0, 200) };
    }
    if (!res.ok) {
      const msg = json?.error ?? `${method} ${path} failed (${res.status})`;
      const code = res.status === 401 || res.status === 503 ? EXIT.auth : res.status === 404 ? EXIT.notFound : res.status === 409 || res.status === 423 || res.status === 429 ? EXIT.busy : res.status === 400 ? EXIT.usage : EXIT.failed;
      throw new CliError(msg, code, json);
    }
    return json as T;
  };

  const lines: string[] = [];
  const say = (l = "") => lines.push(l);
  try {
    const data = await handlers[p.spec.path.join(" ")]!({ args: p.args, flags: p.flags, call, say });
    if (p.spec.mutates && !p.hold && p.spec.path.join(" ") !== "release") await call("POST", "/api/demo/release").catch(() => {});
    if (p.json) deps.out(JSON.stringify({ ok: true, command: p.spec.path.join(" "), data }, null, 2));
    else deps.out(lines.join("\n"));
    return EXIT.ok;
  } catch (e) {
    const ce = e instanceof CliError ? e : new CliError((e as Error).message, EXIT.failed);
    if (p.json) deps.out(JSON.stringify({ ok: false, command: p.spec.path.join(" "), error: ce.message, exit: ce.code, data: ce.data ?? null }, null, 2));
    else deps.err(`Error: ${ce.message}`);
    return ce.code;
  }
}

type Ctx = {
  args: string[];
  flags: Record<string, string | boolean>;
  call: <T = any>(method: "GET" | "POST" | "PATCH", path: string, body?: unknown) => Promise<T>;
  say: (line?: string) => void;
};

const ownerAction = (c: Ctx, body: Record<string, unknown>) => c.call("POST", "/api/demo/owner-action", body);
const receiptLine = (c: Ctx, r: { action: string; digest?: string; verification?: string }) => {
  c.say(`${r.action}: ${r.verification === "verified" ? "verified through Tatum" : (r.verification ?? "submitted")} · ${r.digest ? tx(r.digest) : "no digest"}`);
  c.say(SIGNING);
};

function requestBlock(c: Ctx, r: any) {
  const digests = (r.paymentDigests ?? []) as { step: string; digest: string; verified: boolean }[];
  c.say(`${r.id} · session ${r.session} · ${r.merchant} (demo) ${r.item} · ${usd(r.amount)} USDC`);
  c.say(`  decision: ${r.status} (${r.code})${r.automatic ? " automatically" : ""}; payment: ${r.paymentStatus}`);
  for (const reason of r.reasons ?? []) c.say(`  reason: ${reason}`);
  if (r.taskContext) c.say(`  task: ${r.taskContext}`);
  for (const d of digests) c.say(`  ${d.step === "release" ? "vault release" : "x402 settle"}: ${tx(d.digest)}${d.verified ? " (verified)" : ""}`);
  if (r.status === "held") {
    if (r.allowDisabled) c.say("  Approving is not possible: it would use committed funds. Deny it, or free funds first.");
    else c.say(`  Decide: pnpm sisih approve ${r.id} --remember   or   pnpm sisih deny ${r.id}`);
  }
}

const handlers: Record<string, (c: Ctx) => Promise<unknown>> = {
  async status(c) {
    const [s, reqs, rules] = await Promise.all([c.call("GET", "/api/state"), c.call<any[]>("GET", "/api/requests"), c.call<any[]>("GET", "/api/rules")]);
    const v = s.vault;
    const p = v.policy;
    const held = reqs.filter((r) => r.status === "held");
    c.say(`Sisih · Sui ${s.network === "mainnet" ? "Mainnet" : "Testnet"} (vault, x402, via Tatum) · Walrus Memory Mainnet · session ${s.session}`);
    c.say(`Vault        total ${usd(v.total)} · committed ${usd(v.reserved)} · free ${usd(v.free)} USDC (the agent can only spend free funds)`);
    c.say(p ? `Agent        ${p.paused ? "PAUSED" : p.expiresMs < Date.now() ? "EXPIRED" : "active"} · ${usd(p.maxPerRequest)} per request · ${usd(p.maxPerDay)} per day (spent ${usd(p.spentInWindow)}) · expires ${date(p.expiresMs)}` : "Agent        permission revoked");
    c.say(`Commitments  ${v.obligations.map((o: any) => `${o.name} ${usd(o.reserve)}/${usd(o.target)}`).join(" · ") || "none"}`);
    c.say(`Memory       namespace ${s.memory.namespace}: ${s.memory.stored} stored${s.memory.writing ? `, ${s.memory.writing} writing` : ""}${s.memory.failed ? `, ${s.memory.failed} failed` : ""}`);
    c.say(`Preferences  ${rules.filter((r) => r.active).map((r) => `${r.action} ${r.merchant} up to ${usd(r.maxAmount)}`).join(" · ") || "none"}`);
    c.say(held.length ? `Held         ${held.length} request(s) waiting for you:` : "Held         nothing is waiting for you");
    for (const r of held) c.say(`  ${r.id} ${r.merchant} ${usd(r.amount)} · ${r.reasons[0] ?? ""} → ${r.allowDisabled ? `pnpm sisih deny ${r.id}` : `pnpm sisih approve ${r.id} --remember`}`);
    return { state: s, held, rules };
  },
  async commitments(c) {
    const list = await c.call<any[]>("GET", "/api/obligations");
    c.say(`${pad("id", 5)}${pad("name", 18)}${pad("target", 9)}${pad("reserved", 10)}${pad("cadence", 10)}next due`);
    for (const o of list) {
      c.say(`${pad(String(o.id), 5)}${pad(o.name, 18)}${pad(usd(o.target), 9)}${pad(usd(o.reserve), 10)}${pad(o.cadenceLabel, 10)}${date(o.nextDueMs)}${o.status === "underfunded" ? "  UNDERFUNDED" : ""}`);
      if (o.suggestion) c.say(`     suggestion ${o.suggestion.id}: ${o.suggestion.reason} → pnpm sisih suggestions accept ${o.suggestion.id}`);
    }
    c.say("Change a reserve: pnpm sisih reserve set <id> <amount>");
    return list;
  },
  async requests(c) {
    let list = await c.call<any[]>("GET", "/api/requests");
    if (c.flags.held) list = list.filter((r) => r.status === "held");
    if (!list.length) c.say(c.flags.held ? "Nothing is waiting for you." : "No requests yet.");
    for (const r of list) c.say(`${pad(r.id, 18)} S${r.session} ${pad(r.merchant, 11)} ${pad(usd(r.amount), 6)} ${pad(r.status, 13)} ${pad(r.paymentStatus, 8)} ${(r.reasons[0] ?? "").slice(0, 70)}`);
    return list;
  },
  async request(c) {
    const r = await c.call("GET", `/api/requests/${encodeURIComponent(c.args[0]!)}`);
    requestBlock(c, r);
    return r;
  },
  async prefs(c) {
    const rules = await c.call<any[]>("GET", "/api/rules");
    if (!rules.length) c.say("No preferences yet. Approve or deny with --remember, or: pnpm sisih prefs add allow <merchant> --max <usdc>");
    for (const r of rules) c.say(`${pad(r.id, 15)} ${r.active ? "active  " : "disabled"} ${r.sentence}${r.sourceBlobId ? ` · walrus ${r.sourceBlobId}` : ""}${r.origin ? ` · from ${r.origin}` : ""}`);
    return rules;
  },
  async limits(c) {
    const s = await c.call("GET", "/api/state");
    const p = s.vault.policy;
    c.say(p ? `Per request ${usd(p.maxPerRequest)} · per day ${usd(p.maxPerDay)} (spent ${usd(p.spentInWindow)} in the current 24 h) · ${p.paused ? "paused" : "active"} · expires ${date(p.expiresMs)}` : "Permission revoked. Grant it again: pnpm sisih limits set --per-request <usdc> --per-day <usdc>");
    c.say("These are enforced by the Move vault on Sui Testnet; no preference can raise them.");
    return p;
  },
  async suggestions(c) {
    const list = (await c.call<any[]>("GET", "/api/suggestions")).filter((s) => s.status === "open");
    if (!list.length) c.say("No open reserve suggestions.");
    for (const s of list) c.say(`${s.id} · ${s.obligationName} ${usd(s.currentTarget)} → ${usd(s.suggestedTarget)} · ${s.reason} → pnpm sisih suggestions accept ${s.id}`);
    return list;
  },

  async "commitment add"(c) {
    const r = await ownerAction(c, {
      action: "add_commitment",
      name: c.flags.name,
      payee: c.flags.payee,
      amount: c.flags.amount,
      recurring: c.flags.once !== true,
      kind: c.flags.usage ? "usage" : "fixed",
      priority: c.flags.important ? "important" : "must",
      cadence: typeof c.flags.cadence === "string" ? c.flags.cadence : undefined,
    });
    receiptLine(c, r);
    return r;
  },
  async "reserve set"(c) {
    const r = await ownerAction(c, { action: "set_reserve", obligationId: Number(c.args[0]), amount: toBaseUnits(c.args[1]!) });
    receiptLine(c, r);
    return r;
  },
  async "limits set"(c) {
    const r = await ownerAction(c, { action: "set_limits", maxPerRequest: c.flags["per-request"], maxPerDay: c.flags["per-day"], days: c.flags.days ? Number(c.flags.days) : undefined });
    receiptLine(c, r);
    return r;
  },
  async "threshold set"(c) {
    const r = await c.call("PATCH", "/api/settings", { defaultThreshold: toBaseUnits(c.args[0]!) });
    c.say(`Automatic approval threshold: ${usd(r.defaultThreshold)} USDC (for merchants without a preference; hard limits still apply).`);
    return r;
  },
  async "prefs add"(c) {
    const r = await c.call("POST", "/api/rules", { action: c.args[0], merchant: c.args[1], maxAmount: c.flags.max, days: c.flags.days ? Number(c.flags.days) : undefined });
    c.say(`Saved ${r.ruleId}: ${r.sentence}`);
    c.say(`Rule memory ${r.memoryId} is being written to Walrus Memory Mainnet (about 20 s). A preference never raises a hard limit.`);
    return r;
  },
  async "prefs disable"(c) {
    const r = await c.call("PATCH", `/api/rules/${encodeURIComponent(c.args[0]!)}`, { active: false });
    c.say(`Disabled ${r.id}: ${r.sentence}`);
    return r;
  },
  async "prefs enable"(c) {
    const r = await c.call("PATCH", `/api/rules/${encodeURIComponent(c.args[0]!)}`, { active: true });
    c.say(`Enabled ${r.id}: ${r.sentence}`);
    return r;
  },

  async approve(c) {
    return decide(c, true);
  },
  async deny(c) {
    return decide(c, false);
  },
  async "suggestions accept"(c) {
    const r = await ownerAction(c, { action: "accept_suggestion", suggestionId: c.args[0] });
    c.say(`Reserve changed to ${usd(r.newTarget)} USDC; reserve_change memory ${r.memoryId} is being written to Walrus.`);
    receiptLine(c, { action: "accept_suggestion", digest: r.digest, verification: r.verification });
    return r;
  },
  async "suggestions reject"(c) {
    const r = await c.call("POST", `/api/suggestions/${encodeURIComponent(c.args[0]!)}/reject`);
    c.say(`Rejected ${c.args[0]}; remembered.`);
    return r;
  },

  async pause(c) {
    const r = await ownerAction(c, { action: "pause_agent" });
    c.say("Agent paused: the vault refuses every release until you resume.");
    receiptLine(c, r);
    return r;
  },
  async resume(c) {
    const r = await ownerAction(c, { action: "resume_agent" });
    c.say("Agent resumed.");
    receiptLine(c, r);
    return r;
  },
  async revoke(c) {
    const r = await ownerAction(c, { action: "revoke_agent" });
    c.say("Agent permission revoked. Grant it again with: pnpm sisih limits set --per-request <usdc> --per-day <usdc>");
    receiptLine(c, r);
    return r;
  },

  async "session next"(c) {
    const r = await c.call("POST", "/api/demo/new-session");
    c.say(`Session ${r.session} started. Rules rebuilt from Walrus recall: ${r.rules.loaded} (${r.rules.active} active) from ${r.rules.recalled} recalled memories in ${r.rules.ms} ms.`);
    if (r.rules.warning) c.say(`Note: ${r.rules.warning}`);
    return r;
  },
  async release(c) {
    await c.call("POST", "/api/demo/release");
    c.say("The shared demo run is free for the next visitor or agent (only a run held by this CLI is released).");
    return { released: true };
  },

  async evidence(c) {
    const [act, mem] = await Promise.all([c.call<any[]>("GET", "/api/activity"), c.call("GET", "/api/memories")]);
    const memories = (Array.isArray(mem) ? mem : mem.memories) as any[];
    c.say("Recent transactions (Sui Testnet, verified through Tatum):");
    for (const a of act.slice(0, 8)) c.say(`  ${pad(a.kind, 18)} ${pad(a.amount ? usd(a.amount) : "", 6)} ${pad(a.verification, 9)} ${a.explorerUrl}${a.label ? ` · ${a.label.slice(0, 60)}` : ""}`);
    const stored = memories.filter((m) => m.status === "stored");
    c.say(`Memories (Walrus Mainnet): ${stored.length} stored of ${memories.length}`);
    for (const m of stored.slice(0, 8)) c.say(`  ${pad(m.type, 18)} ${m.walrusUrl}`);
    c.say("More: pnpm sisih evidence tx · pnpm sisih evidence memories");
    return { activity: act, memories };
  },
  async "evidence tx"(c) {
    const act = await c.call<any[]>("GET", "/api/activity");
    for (const a of act) c.say(`${date(a.timestampMs)} ${pad(a.kind, 18)} ${pad(a.amount ? usd(a.amount) : "", 6)} ${pad(a.verification, 9)} ${pad(a.source ?? "", 10)} ${a.explorerUrl}`);
    return act;
  },
  async "evidence memories"(c) {
    const mem = await c.call("GET", "/api/memories");
    const memories = (Array.isArray(mem) ? mem : mem.memories) as any[];
    for (const m of memories) c.say(`${pad(m.status, 8)} S${m.session} ${pad(m.type, 18)} ${m.blobId ?? "(no blob yet)"} · ${m.text.replace(/^\[sisih:v1:[a-z_]+\]\s*/, "").replace(/\s*\{.*$/, "").slice(0, 80)}`);
    return memories;
  },
  async tx(c) {
    const t = await c.call("GET", `/api/tx/${encodeURIComponent(c.args[0]!)}`);
    c.say(`${t.digest} · ${t.status} · ${t.label ?? ""} · source ${t.source}`);
    c.say(`  ${t.explorerUrl}`);
    for (const e of t.events ?? []) c.say(`  event ${String(e.type).split("::").pop()}`);
    return t;
  },

  async "demo reset"(c) {
    c.say("Resetting the shared testnet demo (emergency withdraw, sweeps, reseed, new Walrus namespace)…");
    const r = await c.call("POST", "/api/demo/reset");
    c.say(`Done: namespace ${r.namespace} · vault ${usd(r.vault.total)} / ${usd(r.vault.reserved)} / ${usd(r.vault.free)} · seed ${tx(r.seed)}`);
    return r;
  },
  async "demo cycle"(c) {
    const r = await c.call("POST", "/api/demo/advance-cycle");
    if (r.advanced === false) {
      c.say(`No bill is due yet. Next due in ${r.secondsToNextDue} s. Nothing was changed.`);
      return r;
    }
    for (const pmt of r.payments ?? []) c.say(`  paid ${pmt.name} ${usd(pmt.bill)} ${pmt.ok ? tx(pmt.digest) : `FAILED ${pmt.reason}`}`);
    c.say(`Simulated income ${usd(r.income.amount)} (demo) ${tx(r.income.digest)}; reserves funded.`);
    return r;
  },
  async "demo deposit"(c) {
    const r = await ownerAction(c, { action: "deposit", amount: toBaseUnits(c.args[0]!) });
    receiptLine(c, r);
    return r;
  },
};

async function decide(c: Ctx, approve: boolean) {
  const id = c.args[0]!;
  const remember = c.flags.remember === true;
  const action = approve ? (remember ? "approve_and_remember" : "approve_once") : remember ? "deny_and_remember" : "deny";
  const rule = remember && (c.flags.max || c.flags.days) ? { maxAmount: c.flags.max, expiresMs: c.flags.days ? Date.now() + Number(c.flags.days) * 86_400_000 : undefined } : undefined;
  if (approve) c.say(`Approving ${id}; Sisih pays the same request now (release from free funds, x402 settle, Tatum verification)…`);
  const r = await c.call("POST", `/api/requests/${encodeURIComponent(id)}/decision`, { action, rule });
  requestBlock(c, r.request);
  if (r.ruleId) c.say(`  preference saved: ${r.ruleId} (rule memory ${r.ruleMemoryId}, writing to Walrus Memory Mainnet)`);
  if (approve && r.request.paymentStatus !== "paid" && r.request.paymentStatus !== "failed") c.say(`  Payment still processing: pnpm sisih request ${id}`);
  c.say("The agent continues with get_request_status on the same request; it never pays twice.");
  return r;
}
