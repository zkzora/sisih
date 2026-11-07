/**
 * The Sisih owner CLI: configure commitments and the agent's authority, decide held requests,
 * inspect evidence, from a terminal. An alternative owner interface to the owner MCP tools, on the
 * same domain: owner changes go to POST /api/owner/actions with the owner credential
 * (Authorization: Bearer). The agent's credential is never used or accepted here.
 *
 * Signing model:
 * - Sui Testnet demo: owner transactions are signed on the server by the demo owner key and
 *   labeled "Demo owner (server-signed, testnet)".
 * - Mainnet (and Testnet with SISIH_OWNER_SIGNING=local): each owner action returns an intent. This
 *   CLI is the owner's local signer: `pnpm sisih sign <intent-id> --yes` checks the intent against
 *   the local config, builds and signs with the local owner key, and submits. Add --yes to an owner
 *   command to sign its intent right away.
 */
import { COMMANDS, VERSION, type CommandSpec } from "./spec";
import { parseArgs, toBaseUnits, usageLine } from "./parse";
import { checkIntent, describeIntent, type IntentForSigning, type OwnerSigner } from "./signer";

export const EXIT = { ok: 0, failed: 1, usage: 2, auth: 3, busy: 4, notFound: 5 } as const;
const DEFAULT_URL = "https://sisih-azure.vercel.app";
const SIGNING = 'Owner actions are signed on the server by "Demo owner (server-signed, testnet)", not by your own wallet.';
const LOCAL_SIGNING = "On Mainnet, owner actions are signed locally with your owner key (pnpm sisih sign <intent-id> --yes); the server never holds it.";

export interface Deps {
  fetch: typeof fetch;
  env: (name: string) => string | undefined;
  out: (line: string) => void;
  err: (line: string) => void;
  /** The local owner signer (owner key from the local env); loaded only when a command signs. */
  signer?: () => Promise<OwnerSigner | null>;
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
/** Base units -> decimal USDC string with 6 decimals ("1500000" -> "1.500000"). */
const dec = (base: string | boolean | null | undefined) => {
  if (typeof base !== "string") return undefined;
  const n = BigInt(base);
  return `${n / 1_000_000n}.${(n % 1_000_000n).toString().padStart(6, "0")}`;
};
const date = (ms: number | null | undefined) => (ms ? new Date(ms).toISOString().replace("T", " ").slice(0, 16) + " UTC" : "-");
let explorerNetwork = "testnet";
const tx = (d: string) => `https://suiscan.xyz/${explorerNetwork}/tx/${d}`;
const pad = (s: string, n: number) => (s.length >= n ? s : s + " ".repeat(n - s.length));

function helpText(topic?: CommandSpec): string {
  if (topic) return [`Usage: ${usageLine(topic)}`, "", topic.summary, topic.mutates ? "Changes state: needs the owner credential (SISIH_OWNER_TOKEN)." : "Read only.", "", "Options: --json (machine-readable), --url <deployment>, --hold (keep the shared demo run after a change), --yes (sign a Mainnet intent locally right away)"].join("\n");
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
    "  SISIH_OWNER_TOKEN   owner credential for changes (Testnet: the demo token); never give it to the agent",
    "  SISIH_ENV_FILE      local owner config for signing, e.g. .env.mainnet,.env.mainnet.deployment",
    "",
    SIGNING,
    LOCAL_SIGNING,
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
  const token = deps.env("SISIH_OWNER_TOKEN") ?? deps.env("SISIH_OWNER_MCP_TOKEN") ?? deps.env("DEMO_TOKEN");
  const client = deps.env("SISIH_CLIENT_ID") ?? "owner-cli";
  explorerNetwork = deps.env("SUI_NETWORK") === "mainnet" ? "mainnet" : "testnet";
  if (p.spec.mutates && !token) {
    deps.err("Error: this command changes state and needs the owner credential. Set SISIH_OWNER_TOKEN (from a private channel).");
    return EXIT.auth;
  }

  const call = async <T = any>(method: "GET" | "POST" | "PATCH", path: string, body?: unknown): Promise<T> => {
    const headers: Record<string, string> = {};
    if (body !== undefined) headers["content-type"] = "application/json";
    if (token && (method !== "GET" || path.startsWith("/api/owner/"))) {
      // Owner routes read the bearer credential; the legacy Testnet demo routes read x-demo-token.
      Object.assign(headers, { authorization: `Bearer ${token}`, "x-demo-token": token, "x-demo-client": client });
    }
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
      const code =
        res.status === 401 || res.status === 403 || res.status === 503
          ? EXIT.auth
          : res.status === 404
            ? EXIT.notFound
            : res.status === 409 || res.status === 423 || res.status === 429
              ? EXIT.busy
              : res.status === 400
                ? EXIT.usage
                : EXIT.failed;
      throw new CliError(msg, code, json);
    }
    return json as T;
  };

  const lines: string[] = [];
  const say = (l = "") => lines.push(l);
  try {
    const data = await handlers[p.spec.path.join(" ")]!({ args: p.args, flags: p.flags, call, say, signer: deps.signer });
    if (p.spec.mutates && !p.hold && p.spec.path.join(" ") !== "release") await call("POST", "/api/owner/release").catch(() => {});
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
  signer?: () => Promise<OwnerSigner | null>;
};

/** Legacy Testnet demo route, used only by `demo deposit`. */
const demoOwnerRoute = (c: Ctx, body: Record<string, unknown>) => c.call("POST", "/api/demo/owner-action", body);

const receiptLine = (c: Ctx, r: { action?: string; digest?: string; verification?: string; signer?: string; status?: string; explorer_url?: string } | null | undefined) => {
  if (!r) return;
  if (r.status === "executed" && r.digest) return; // already printed by signIntent
  c.say(`${r.action ?? "owner action"}: ${r.verification === "verified" ? "verified through Tatum" : (r.verification ?? "submitted")} · ${r.digest ? tx(r.digest) : "no digest"}`);
  if (r.signer) c.say(SIGNING);
};

/**
 * One owner action through the shared owner domain. Returns the effect's result, or (on a
 * local-signing deployment) the intent to sign: signed right away with --yes, else printed.
 */
async function ownerAct(c: Ctx, action: string, params: Record<string, unknown>): Promise<{ done: boolean; result: any; raw: any }> {
  const r = await c.call("POST", "/api/owner/actions", { action, params });
  if (r?.status === "owner_signature_required") {
    c.say(`Owner signature required: ${r.summary}`);
    c.say(`  intent ${r.intent_id} · ${r.network} · expires ${r.expires_at}`);
    if (c.flags.yes === true) {
      const signed = await signIntent(c, r.intent_id, true);
      return { done: signed?.status === "executed", result: signed?.result ?? signed, raw: { ...r, submitted: signed } };
    }
    c.say(`  Nothing has changed. Sign it locally: ${r.sign_with}`);
    return { done: false, result: null, raw: r };
  }
  return { done: true, result: r?.signer ? { ...r.result, signer: r.signer } : r?.result, raw: r };
}

/** Must match owner/intents.ts authorizationText exactly (the server verifies this text). */
const normalizeAddr = (a: string) => `0x${a.replace(/^0x/, "").toLowerCase().padStart(64, "0")}`;
export function authorizationTextFor(i: IntentForSigning): string {
  return [
    "Sisih owner authorization",
    `intent: ${i.id}`,
    `network: sui:${i.target.network}`,
    `package: ${i.target.packageId}`,
    `vault: ${i.target.vaultId}`,
    `owner: ${normalizeAddr(i.target.ownerAddress)}`,
    `action: ${JSON.stringify(i.action)}`,
    `summary: ${i.summary}`,
    `nonce: ${i.nonce}`,
    `expires: ${new Date(i.expires_at).toISOString()}`,
  ].join("\n");
}

/** The owner's local signer: check the intent against local config, build and sign locally, submit. */
async function signIntent(c: Ctx, id: string, yes: boolean): Promise<any> {
  const intent = (await c.call("GET", `/api/owner/intents/${encodeURIComponent(id)}`)) as IntentForSigning;
  for (const l of describeIntent(intent)) c.say(l);
  const signer = c.signer ? await c.signer() : null;
  if (!signer) throw new CliError("No local owner key. Run with SISIH_ENV_FILE pointing at your owner config (OWNER_PRIVATE_KEY); the key never leaves this machine.", EXIT.auth);
  const problems = checkIntent(intent, signer.address(), signer.config());
  if (problems.length) throw new CliError(`Refusing to sign ${id}: ${problems.join("; ")}`, EXIT.failed, { problems });
  if (!yes) {
    c.say("Checked against your local config. Not signed: re-run with --yes to sign and submit.");
    return { status: "not_signed", intent_id: id };
  }
  const body = intent.kind === "onchain" ? await signer.signCall(intent.target, intent.call!, BigInt(intent.gas_cap_mist)) : { signature: await signer.signText(authorizationTextFor(intent)) };
  const res = await c.call("POST", `/api/owner/intents/${encodeURIComponent(id)}/submit`, body);
  c.say(`${id}: ${res.status}${res.digest ? ` · ${res.explorer_url ?? tx(res.digest)}` : ""}`);
  if (res.status === "unknown") c.say(`  ${res.error}`);
  if (res.status === "failed") c.say(`  failed: ${res.error}`);
  return res;
}

function requestBlock(c: Ctx, r: any) {
  if (!r) return;
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
    if (s.network === "mainnet" || s.network === "testnet") explorerNetwork = s.network;
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
    c.say(`These are enforced by the Move vault on Sui ${s.network === "mainnet" ? "Mainnet" : "Testnet"}; no preference can raise them.`);
    return p;
  },
  async suggestions(c) {
    const list = (await c.call<any[]>("GET", "/api/suggestions")).filter((s) => s.status === "open");
    if (!list.length) c.say("No open reserve suggestions.");
    for (const s of list) c.say(`${s.id} · ${s.obligationName} ${usd(s.currentTarget)} → ${usd(s.suggestedTarget)} · ${s.reason} → pnpm sisih suggestions accept ${s.id}`);
    return list;
  },

  async "commitment add"(c) {
    const r = await ownerAct(c, "add_commitment", {
      name: c.flags.name,
      payee: c.flags.payee,
      amount_usdc: dec(c.flags.amount),
      recurring: c.flags.once !== true,
      usage: c.flags.usage === true,
      important: c.flags.important === true,
      cadence: typeof c.flags.cadence === "string" ? c.flags.cadence : undefined,
    });
    if (r.done) receiptLine(c, r.result);
    return r.raw;
  },
  async "reserve set"(c) {
    const r = await ownerAct(c, "set_reserve", { commitment_id: Number(c.args[0]), amount_usdc: dec(toBaseUnits(c.args[1]!)) });
    if (r.done) receiptLine(c, r.result);
    return r.raw;
  },
  async "limits set"(c) {
    const r = await ownerAct(c, "set_limits", { per_request_usdc: dec(c.flags["per-request"]), per_day_usdc: dec(c.flags["per-day"]), days: c.flags.days ? Number(c.flags.days) : undefined });
    if (r.done) receiptLine(c, r.result);
    return r.raw;
  },
  async "threshold set"(c) {
    const r = await ownerAct(c, "set_threshold", { max_usdc: dec(toBaseUnits(c.args[0]!)) });
    if (r.done) c.say(`Automatic approval threshold: ${usd(r.result?.defaultThreshold)} USDC (for merchants without a preference; hard limits still apply).`);
    return r.raw;
  },
  async "prefs add"(c) {
    const r = await ownerAct(c, "add_preference", { action: c.args[0], merchant: c.args[1], max_usdc: dec(c.flags.max), days: c.flags.days ? Number(c.flags.days) : undefined });
    if (r.done && r.result?.ruleId) {
      c.say(`Saved ${r.result.ruleId}: ${r.result.sentence}`);
      c.say(`Rule memory ${r.result.memoryId} is being written to Walrus Memory Mainnet (about 20 s). A preference never raises a hard limit.`);
    }
    return r.raw;
  },
  async "prefs disable"(c) {
    const r = await ownerAct(c, "set_preference_enabled", { rule_id: c.args[0], enabled: false });
    if (r.done) c.say(`Disabled ${c.args[0]}.`);
    return r.raw;
  },
  async "prefs enable"(c) {
    const r = await ownerAct(c, "set_preference_enabled", { rule_id: c.args[0], enabled: true });
    if (r.done) c.say(`Enabled ${r.result?.ruleId ?? c.args[0]}.`);
    return r.raw;
  },

  async approve(c) {
    return decide(c, true);
  },
  async deny(c) {
    return decide(c, false);
  },
  async "suggestions accept"(c) {
    const r = await ownerAct(c, "accept_suggestion", { suggestion_id: c.args[0] });
    if (r.done && r.result) {
      if (r.result.newTarget) c.say(`Reserve changed to ${usd(r.result.newTarget)} USDC; reserve_change memory ${r.result.memoryId} is being written to Walrus.`);
      receiptLine(c, { action: "accept_suggestion", digest: r.result.digest, verification: r.result.verification, signer: r.result.signer });
    }
    return r.raw;
  },
  async "suggestions reject"(c) {
    const r = await ownerAct(c, "reject_suggestion", { suggestion_id: c.args[0] });
    if (r.done) c.say(`Rejected ${c.args[0]}; remembered.`);
    return r.raw;
  },

  async pause(c) {
    const r = await ownerAct(c, "set_agent_permission", { state: "pause" });
    if (r.done) {
      c.say("Agent paused: the vault refuses every release until you resume.");
      receiptLine(c, r.result);
    }
    return r.raw;
  },
  async resume(c) {
    const r = await ownerAct(c, "set_agent_permission", { state: "resume" });
    if (r.done) {
      c.say("Agent resumed.");
      receiptLine(c, r.result);
    }
    return r.raw;
  },
  async revoke(c) {
    const r = await ownerAct(c, "set_agent_permission", { state: "revoke" });
    if (r.done) {
      c.say("Agent permission revoked. Grant it again with: pnpm sisih limits set --per-request <usdc> --per-day <usdc>");
      receiptLine(c, r.result);
    }
    return r.raw;
  },

  async "session next"(c) {
    const out = await ownerAct(c, "start_next_session", {});
    const r = out.result;
    if (out.done && r?.rules) {
      c.say(`Session ${r.session} started. Rules rebuilt from Walrus recall: ${r.rules.loaded} (${r.rules.active} active) from ${r.rules.recalled} recalled memories in ${r.rules.ms} ms.`);
      if (r.rules.warning) c.say(`Note: ${r.rules.warning}`);
    }
    return out.raw;
  },
  async release(c) {
    await c.call("POST", "/api/owner/release");
    c.say("The shared demo run is free for the next visitor or agent (only a run held by this CLI is released).");
    return { released: true };
  },
  async sign(c) {
    return signIntent(c, c.args[0]!, c.flags.yes === true);
  },
  async intent(c) {
    const i = (await c.call("GET", `/api/owner/intents/${encodeURIComponent(c.args[0]!)}`)) as IntentForSigning & { digest?: string; error?: string };
    for (const l of describeIntent(i)) c.say(l);
    c.say(`  status ${i.status}${i.digest ? ` · ${tx(i.digest)}` : ""}${i.error ? ` · ${i.error}` : ""}`);
    return i;
  },
  async reconcile(c) {
    const r = await c.call("POST", `/api/owner/intents/${encodeURIComponent(c.args[0]!)}/reconcile`);
    c.say(`${r.intent_id}: ${r.status}${r.digest ? ` · ${r.explorer_url}` : ""}${r.error ? ` · ${r.error}` : ""}`);
    return r;
  },
  async "credential agent"(c) {
    const r = await c.call("POST", "/api/owner/agent-credential");
    c.say(`MCP endpoint: ${r.endpoint}`);
    c.say(`Agent credential (set it as SISIH_AGENT_TOKEN in the agent's terminal only): ${r.token ?? "(not configured on this deployment)"}`);
    c.say("Keep it out of screenshots, logs and source control. It cannot approve, configure or sign anything.");
    return { endpoint: r.endpoint, configured: Boolean(r.token) };
  },

  async evidence(c) {
    const [act, mem] = await Promise.all([c.call<any[]>("GET", "/api/activity"), c.call("GET", "/api/memories")]);
    const memories = (Array.isArray(mem) ? mem : mem.memories) as any[];
    c.say(`Recent transactions (Sui ${explorerNetwork === "mainnet" ? "Mainnet" : "Testnet"}, verified through Tatum):`);
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
    const r = await demoOwnerRoute(c, { action: "deposit", amount: toBaseUnits(c.args[0]!) });
    receiptLine(c, r);
    return r;
  },
};

async function decide(c: Ctx, approve: boolean) {
  const id = c.args[0]!;
  const remember = c.flags.remember === true;
  if (approve) c.say(`Approving ${id}; Sisih pays the same request once (release from free funds, x402 settle, Tatum verification)…`);
  const out = await ownerAct(c, "decide_request", {
    request_id: id,
    decision: approve ? "approve" : "deny",
    remember,
    ...(remember && c.flags.max ? { max_usdc: dec(c.flags.max) } : {}),
    ...(remember && c.flags.days ? { days: Number(c.flags.days) } : {}),
  });
  if (!out.done) return out.raw;
  const r = out.result;
  requestBlock(c, r?.request);
  if (r?.ruleId) c.say(`  preference saved: ${r.ruleId} (rule memory ${r.ruleMemoryId}, writing to Walrus Memory Mainnet)`);
  if (approve && r?.request && r.request.paymentStatus !== "paid" && r.request.paymentStatus !== "failed") c.say(`  Payment still processing: pnpm sisih request ${id}`);
  c.say("The agent continues with get_request_status on the same request; it never pays twice.");
  return out.raw;
}
