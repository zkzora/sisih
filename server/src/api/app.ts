/**
 * HTTP API for the dashboard. Served entirely from caches (Postgres + the cached vault snapshot).
 * The only Tatum calls a request can trigger are the 2 reads after a recorded transaction,
 * or the very first vault read when the cache is empty. Runs as a long-lived Node server
 * locally and inside Next.js route handlers on Vercel (web/src/app/api/[...path]/route.ts).
 * Live updates: GET /api/events?after=<id> (polling; every event is stored in Postgres).
 */
import { desc, eq } from "drizzle-orm";
import { Hono, type Context } from "hono";
import { cors } from "hono/cors";
import { activityRows, explorerObjectUrl, explorerTxUrl } from "../chain/activity";
import { operatorCapId, usdcType } from "../chain/sisih";
import { cachedVault, readVault, recordTx, vaultReadError, vaultState } from "../chain/vault";
import { db, initDb, schema } from "../db/index";
import { jsonSafe, latestEventId, pruneEvents, since } from "../lib/bus";
import { suiNetwork } from "../lib/env";
import { suiClient, tatumGrpcHost, tatumStats } from "../lib/tatum";
import { address as walletAddress } from "../lib/wallets";
import { delegatePublicKey, memwalHealth, namespace, pendingMemoryCount, reconcilePendingMemories, remember, retryMemory, RELAYER_URL } from "../memory/memwal";
import { MERCHANTS } from "../merchants/registry";
import { acceptSuggestion, listSuggestions, onVaultEvents, rejectSuggestion } from "../services/chainEvents";
import { insights } from "../services/insights";
import { paymentExecutor } from "../services/payments";
import { ApiError, getRequest, listRequests, ownerDecision, requestView, ruleDraft, submitRequest, type OwnerDecision } from "../services/requests";
import { sessionStats, startSession } from "../services/sessions";
import { addLocalRule, cachedRule, cachedRules, currentSession, defaultThreshold, kvRead, kvSet, setRuleActive, type CachedRule } from "../services/state";
import { isScenario, runTask, SCENARIOS } from "../agent/runner";
import { advanceCycle, clock, resetDemo } from "../demo/controls";
import { merchantRoutes } from "../x402/merchants";
import { actionLock, allowedOrigins, DEMO_CLIENT_HEADER, DEMO_TOKEN_HEADER, demoGuard, demoRunStatus, releaseDemoRun } from "./guard";
import { background } from "../lib/background";
import { demoOwnerAction, isDemoOwnerAction } from "../demo/owner";

export const walrusBlobUrl = (blobId: string) => `https://walruscan.com/mainnet/blob/${blobId}`;

const ok = (c: Context, body: unknown, status: 200 | 201 = 200) => c.json(jsonSafe(body) as object, status);

/**
 * Tatum health. Call stats are per process; on a fresh serverless instance that has not called
 * Tatum yet, the last successful vault read (shared snapshot) stands in for "last OK".
 */
function tatumStatus(lastVerifiedAt: number | null = null) {
  const s = tatumStats;
  const now = Date.now();
  const lastOkAt = s.lastOkAt ?? lastVerifiedAt;
  const recentError = s.lastError && (!lastOkAt || s.lastError.at > lastOkAt) && now - s.lastError.at < 120_000;
  const level = recentError ? "red" : s.lastLatencyMs !== null && s.lastLatencyMs > 2000 ? "yellow" : lastOkAt ? "green" : "yellow";
  return { level, host: tatumGrpcHost(), network: suiNetwork(), lastOkAt, lastLatencyMs: s.lastLatencyMs, calls: s.calls, failures: s.failures, retries: s.retries, byMethod: s.byMethod, lastError: s.lastError };
}

function memoryView(m: typeof schema.memories.$inferSelect) {
  return {
    id: m.id,
    type: m.type,
    text: m.text,
    payload: JSON.parse(m.payload),
    session: m.session,
    status: m.status,
    jobId: m.jobId,
    blobId: m.blobId,
    walrusUrl: m.blobId ? walrusBlobUrl(m.blobId) : null,
    namespace: m.namespace,
    error: m.error,
    usedInDecisions: JSON.parse(m.usedInDecisions) as string[],
    createdAt: m.createdAt,
    storedAt: m.storedAt,
  };
}

async function ruleView(r: CachedRule) {
  const [mem] = r.sourceMemoryId ? await db().select().from(schema.memories).where(eq(schema.memories.id, r.sourceMemoryId)) : [];
  const blobId = r.sourceBlobId ?? mem?.blobId ?? null;
  return { ...r, sourceBlobId: blobId, walrusUrl: blobId ? walrusBlobUrl(blobId) : null, sourceMemoryStatus: mem?.status ?? (blobId ? "stored" : null) };
}

/** Housekeeping on reads, at most every 20 s per instance: finish orphaned memory jobs, prune old events. */
let lastHousekeeping = 0;
function housekeeping(): void {
  if (Date.now() - lastHousekeeping < 20_000) return;
  lastHousekeeping = Date.now();
  // Tracked with background() so after() keeps the function alive until these queries finish.
  // Left untracked, Vercel suspended instances mid-query and the Supabase pooler kept those
  // backends pinned ("active / ClientRead") until every API call hung (2026-11-06).
  background(() => reconcilePendingMemories().catch((err) => console.error("reconcile memories:", (err as Error).message)));
  background(() => pruneEvents().catch(() => {}));
}

export function createApp() {
  const app = new Hono();
  const origins = allowedOrigins();
  app.use(
    "/api/*",
    cors({
      origin: (o) => (o && origins.includes(o.replace(/\/$/, "")) ? o : null),
      allowMethods: ["GET", "POST", "PATCH", "OPTIONS"],
      allowHeaders: ["content-type", DEMO_TOKEN_HEADER, DEMO_CLIENT_HEADER],
      maxAge: 600,
    }),
  );
  app.use("*", async (_c, next) => {
    await initDb();
    await next();
  });
  app.use("/api/*", demoGuard());
  // Fund-moving and long actions run one at a time across all instances (POST only).
  for (const p of ["/api/demo/run-task", "/api/demo/advance-cycle", "/api/demo/new-session", "/api/demo/reset", "/api/demo/owner-action", "/api/requests", "/api/requests/:id/decision", "/api/suggestions/:id/accept", "/api/sessions"]) {
    app.use(p, actionLock());
  }

  app.onError((err, c) => {
    if (err instanceof ApiError) return c.json({ error: err.message, code: err.code }, err.status);
    if (err instanceof SyntaxError) return c.json({ error: "Invalid JSON body", code: "bad_json" }, 400);
    console.error(err);
    return c.json({ error: (err as Error).message.slice(0, 300), code: "internal" }, 500);
  });

  // --- health & state ---------------------------------------------------------------
  app.get("/api/health", async (c) => {
    const [mem, agentId, cached, readError, ns, pending] = await Promise.all([
      memwalHealth(),
      delegatePublicKey().catch(() => null),
      cachedVault(),
      vaultReadError(),
      namespace(),
      pendingMemoryCount(),
    ]);
    return ok(c, {
      tatum: tatumStatus(cached?.readAtMs ?? null),
      vaultRead: { lastReadAtMs: cached?.readAtMs ?? null, error: readError },
      memwal: { ...mem, relayer: RELAYER_URL, namespace: ns, agentId, pending },
      payments: { executor: paymentExecutor().name },
    });
  });

  app.get("/api/state", async (c) => {
    housekeeping();
    const [vault, mem, held, session, ns] = await Promise.all([
      vaultState(),
      db().select({ status: schema.memories.status }).from(schema.memories),
      db().select({ id: schema.requests.id }).from(schema.requests).where(eq(schema.requests.status, "held")),
      currentSession(),
      namespace(),
    ]);
    return ok(c, {
      network: suiNetwork(),
      vault: { ...vault, explorerUrl: explorerObjectUrl(vault.vaultId), operatorCapId: operatorCapId() },
      verifiedVia: "Tatum Sui gRPC",
      agentAddress: walletAddress("agent"),
      readAtMs: vault.readAtMs,
      session,
      heldRequests: held.length,
      memory: { namespace: ns, stored: mem.filter((m) => m.status === "stored").length, writing: mem.filter((m) => m.status === "writing").length, failed: mem.filter((m) => m.status === "failed").length },
      tatum: tatumStatus(vault.readAtMs),
      demo: { merchants: MERCHANTS.map((m) => ({ name: m.name, demo: true })) },
    });
  });

  /** USDC + SUI balance of an address (deposit dialog). Cached 10 s per address. */
  const walletCache = new Map<string, { at: number; value: unknown }>();
  app.get("/api/wallet/:address", async (c) => {
    const addr = c.req.param("address");
    if (!/^0x[0-9a-fA-F]{1,64}$/.test(addr)) throw new ApiError(400, "Not a Sui address");
    const hit = walletCache.get(addr);
    if (hit && Date.now() - hit.at < 10_000) return ok(c, hit.value);
    const [u, s] = await Promise.all([
      suiClient().core.getBalance({ owner: addr, coinType: usdcType() }),
      suiClient().core.getBalance({ owner: addr, coinType: "0x2::sui::SUI" }),
    ]);
    const value = { address: addr, usdc: u.balance.balance, sui: s.balance.balance, readAtMs: Date.now() };
    walletCache.set(addr, { at: Date.now(), value });
    return ok(c, value);
  });

  app.get("/api/settings", async (c) => ok(c, { defaultThreshold: (await defaultThreshold()).toString() }));
  app.patch("/api/settings", async (c) => {
    const body = await c.req.json<{ defaultThreshold?: string }>();
    if (body.defaultThreshold !== undefined) {
      if (!/^\d+$/.test(body.defaultThreshold)) throw new ApiError(400, "defaultThreshold must be base units");
      await kvSet("default_threshold", body.defaultThreshold);
    }
    return ok(c, { defaultThreshold: (await defaultThreshold()).toString() });
  });

  /** Force one fresh vault read (the dashboard's "Refresh" button). */
  app.post("/api/state/refresh", async (c) => ok(c, await readVault()));

  // --- obligations --------------------------------------------------------------------
  app.get("/api/obligations", async (c) => {
    const [vault, suggestions] = await Promise.all([vaultState(), listSuggestions()]);
    const open = suggestions.filter((s) => s.status === "open");
    return ok(c, vault.obligations.map((o) => ({ ...o, suggestion: open.find((s) => s.obligationId === o.id) ?? null })));
  });

  app.get("/api/obligations/:id", async (c) => {
    const id = Number(c.req.param("id"));
    const [vault, allActivity, allMemories, suggestions] = await Promise.all([vaultState(), activityRows(500), db().select().from(schema.memories), listSuggestions()]);
    const o = vault.obligations.find((x) => x.id === id);
    const activity = allActivity.filter(
      (r) => (r.kind === "Pay obligation" || r.kind === "Reserve" || r.kind === "Change reserve") && (r.to === o?.name || r.from === o?.name || r.to === `Obligation #${id}`),
    );
    const memories = allMemories.filter((m) => {
      const p = JSON.parse(m.payload);
      return p.obligationId === id || (o && p.name === o.name);
    });
    if (!o && activity.length === 0) throw new ApiError(404, `No obligation ${id}`, "not_found");
    return ok(c, { obligation: o ?? null, removed: !o, activity, memories: memories.map(memoryView), suggestions: suggestions.filter((s) => s.obligationId === id) });
  });

  // --- requests -----------------------------------------------------------------------
  app.get("/api/requests", async (c) => {
    const status = c.req.query("status");
    const category = c.req.query("category");
    const session = c.req.query("session");
    let rows = (await listRequests()).map(requestView);
    if (status === "held") rows = rows.filter((r) => r.status === "held");
    else if (status === "automatic") rows = rows.filter((r) => r.automatic);
    else if (status === "denied") rows = rows.filter((r) => r.status === "denied" || r.status === "auto_denied");
    if (category) rows = rows.filter((r) => r.category === category);
    if (session) rows = rows.filter((r) => r.session === Number(session));
    return ok(c, rows);
  });

  app.post("/api/requests", async (c) => {
    const body = await c.req.json<{ merchant: string; amount?: string; item?: string; taskContext?: string }>();
    return ok(c, await submitRequest(body), 201);
  });

  app.get("/api/requests/:id", async (c) => {
    const r = requestView(await getRequest(c.req.param("id")));
    const found = await Promise.all(r.matchedRuleIds.map((id) => cachedRule(id)));
    const rules = await Promise.all(found.filter((x): x is CachedRule => !!x).map(ruleView));
    const decisions = await db().select().from(schema.decisions).where(eq(schema.decisions.requestId, r.id));
    const txs = (await db().select().from(schema.txLog).where(eq(schema.txLog.requestId, r.id))).map((t) => ({
      digest: t.digest,
      status: t.status,
      label: t.label,
      explorerUrl: explorerTxUrl(t.digest),
    }));
    return ok(c, { ...r, rules, decisions, transactions: txs });
  });

  app.get("/api/requests/:id/rule-draft", async (c) => {
    const action = c.req.query("action");
    return ok(c, await ruleDraft(c.req.param("id"), action === "deny" || action === "allow" ? action : undefined));
  });

  app.post("/api/requests/:id/decision", async (c) => {
    const body = await c.req.json<{ action: OwnerDecision; rule?: Parameters<typeof ownerDecision>[2] }>();
    const kinds: OwnerDecision[] = ["approve_once", "approve_and_remember", "deny", "deny_and_remember"];
    if (!kinds.includes(body.action)) throw new ApiError(400, `action must be one of ${kinds.join(", ")}`);
    return ok(c, await ownerDecision(c.req.param("id"), body.action, body.rule));
  });

  // --- rules --------------------------------------------------------------------------
  app.get("/api/rules", async (c) => ok(c, await Promise.all((await cachedRules()).map(ruleView))));

  app.patch("/api/rules/:id", async (c) => {
    const id = c.req.param("id");
    const rule = await cachedRule(id);
    if (!rule) throw new ApiError(404, `No rule ${id}`, "not_found");
    const { active } = await c.req.json<{ active: boolean }>();
    if (active === rule.active) return ok(c, await ruleView(rule));
    const session = await currentSession();
    if (!active) {
      const mem = await remember("rule_disabled", `Rule disabled: ${rule.sentence}`, { ruleId: id }, { session });
      await setRuleActive(id, false);
      return ok(c, { ...(await ruleView((await cachedRule(id))!)), disabledMemoryId: mem.id });
    }
    // Re-enabling writes the rule again under a new id (Walrus memories are never deleted).
    const mem = await remember(
      "rule",
      rule.sentence,
      { ruleId: `${id}-r`, merchant: rule.merchant, category: rule.category, maxAmount: rule.maxAmount.toString(), action: rule.action, expiresMs: rule.expiresMs },
      { session },
    );
    const copy = await addLocalRule(
      { merchant: rule.merchant, category: rule.category, maxAmount: rule.maxAmount, action: rule.action, expiresMs: rule.expiresMs, sentence: rule.sentence },
      mem.id,
      `${id}-r`,
    );
    return ok(c, await ruleView(copy));
  });

  // --- memory -------------------------------------------------------------------------
  app.get("/api/memories", async (c) => {
    housekeeping();
    const type = c.req.query("type");
    const session = c.req.query("session");
    let rows = await db().select().from(schema.memories).orderBy(desc(schema.memories.createdAt));
    if (type) rows = rows.filter((m) => m.type === type);
    if (session) rows = rows.filter((m) => m.session === Number(session));
    return ok(c, rows.map(memoryView));
  });

  app.get("/api/memories/:id", async (c) => {
    const [m] = await db().select().from(schema.memories).where(eq(schema.memories.id, c.req.param("id")));
    if (!m) throw new ApiError(404, "No such memory", "not_found");
    const v = memoryView(m);
    const usedBy = [];
    for (const id of v.usedInDecisions) {
      const [r] = await db().select().from(schema.requests).where(eq(schema.requests.id, id));
      if (r) usedBy.push(requestView(r));
    }
    return ok(c, { ...v, decisions: usedBy });
  });

  app.post("/api/memories/:id/retry", async (c) => {
    if (!(await retryMemory(c.req.param("id")))) throw new ApiError(409, "Only failed memories can be retried", "not_failed");
    return ok(c, { retrying: true });
  });

  app.get("/api/recall/last", async (c) => {
    const raw = await kvRead("last_recall");
    if (!raw) return ok(c, null);
    const last = JSON.parse(raw) as { requestId: string };
    const [r] = await db().select().from(schema.requests).where(eq(schema.requests.id, last.requestId));
    return ok(c, { ...last, request: r ? requestView(r) : null });
  });

  // --- insights, activity, transactions -----------------------------------------------
  app.get("/api/insights", async (c) => ok(c, await insights()));

  app.get("/api/activity", async (c) => {
    const kind = c.req.query("kind");
    let rows = await activityRows(Number(c.req.query("limit") ?? 200));
    if (kind) rows = rows.filter((r) => r.kind === kind);
    return ok(c, rows);
  });

  app.get("/api/tx/:digest", async (c) => {
    const [t] = await db().select().from(schema.txLog).where(eq(schema.txLog.digest, c.req.param("digest")));
    if (!t) throw new ApiError(404, "Unknown digest. POST it to /api/tx first.", "not_found");
    return ok(c, { ...t, events: t.events ? JSON.parse(t.events) : [], explorerUrl: explorerTxUrl(t.digest) });
  });

  /** A digest signed elsewhere (browser wallet, scripts): prove it through Tatum and log it. */
  app.post("/api/tx", async (c) => {
    const body = await c.req.json<{ digest: string; label?: string; source?: "owner" | "import" }>();
    if (!/^[1-9A-HJ-NP-Za-km-z]{32,50}$/.test(body.digest ?? "")) throw new ApiError(400, "digest must be a base58 transaction digest");
    // Clients may only claim owner (wallet) or import; demo_owner is set by the server when it signs.
    const rec = await recordTx(body.digest, { source: body.source === "import" ? "import" : "owner", label: body.label });
    await onVaultEvents(rec);
    return ok(c, { ...rec, explorerUrl: explorerTxUrl(rec.digest) }, 201);
  });

  // --- suggestions --------------------------------------------------------------------
  app.get("/api/suggestions", async (c) => ok(c, await listSuggestions()));
  app.post("/api/suggestions/:id/accept", async (c) => {
    const { digest } = await c.req.json<{ digest: string }>();
    return ok(c, await acceptSuggestion(c.req.param("id"), digest));
  });
  app.post("/api/suggestions/:id/reject", async (c) => ok(c, await rejectSuggestion(c.req.param("id"))));

  // --- sessions -----------------------------------------------------------------------
  app.get("/api/sessions", async (c) => {
    const rows = await db().select().from(schema.sessions).orderBy(schema.sessions.n);
    return ok(c, await Promise.all(rows.map(async (s) => ({ ...s, stats: await sessionStats(s.n) }))));
  });
  app.post("/api/sessions", async (c) => ok(c, await startSession(), 201));

  // --- demo controls (demo plumbing: demo merchants, simulated income, 2-minute cycles) -
  app.post("/api/demo/run-task", async (c) => {
    const { scenario } = await c.req.json<{ scenario: string }>();
    if (!isScenario(scenario)) throw new ApiError(400, `scenario must be one of ${Object.keys(SCENARIOS).join(", ")}`);
    return ok(c, await runTask(scenario), 201);
  });
  app.post("/api/demo/advance-cycle", async (c) => ok(c, await advanceCycle()));
  app.post("/api/demo/new-session", async (c) => ok(c, await startSession(), 201));
  app.post("/api/demo/reset", async (c) => ok(c, await resetDemo()));
  app.get("/api/demo/clock", async (c) => ok(c, await clock()));
  /** The guard already checked x-demo-token; this confirms it and says whether another visitor holds the demo. */
  app.post("/api/demo/token-check", async (c) => ok(c, { ok: true, ...(await demoRunStatus((n) => c.req.header(n))) }));
  /** The dock's Lock button: free the demo-run lease held by this caller only. */
  app.post("/api/demo/release", async (c) => {
    await releaseDemoRun((n) => c.req.header(n));
    return ok(c, { ok: true });
  });
  /**
   * Owner actions for judges (testnet only): signed by the demo owner key on the server, labeled
   * "Demo owner (server-signed, testnet)". A connected owner wallet signs through /api/sui-rpc instead.
   */
  app.post("/api/demo/owner-action", async (c) => {
    const body = await c.req.json<{ action: string; amount?: string; suggestionId?: string }>();
    if (!isDemoOwnerAction(body.action)) throw new ApiError(400, "action must be deposit, accept_suggestion, pause_agent or resume_agent");
    return ok(c, await demoOwnerAction(body.action, body), 201);
  });

  // --- live events (polling) ------------------------------------------------------------
  /**
   * GET /api/events?after=<id>: stored events newer than id (oldest first, up to 200) plus the
   * newest id seen. Without `after` it returns no events, only the newest id to start from.
   */
  app.get("/api/events", async (c) => {
    housekeeping();
    const after = c.req.query("after");
    if (after === undefined || !/^\d+$/.test(after)) return ok(c, { events: [], latest: await latestEventId() });
    const events = await since(Number(after));
    return ok(c, { events, latest: events.at(-1)?.id ?? Number(after) });
  });

  // Demo merchants (x402): /merchants/datamart/token-history, /merchants/searchbox/premium-search,
  // /merchants/reportlab/onchain-report
  app.route("/", merchantRoutes());

  return app;
}
