/**
 * HTTP API + SSE for the dashboard. Served entirely from caches (SQLite + the cached vault).
 * The only Tatum calls a request can trigger are the 2 reads after a recorded transaction,
 * or the very first vault read when the cache is empty.
 */
import { desc, eq } from "drizzle-orm";
import { Hono, type Context } from "hono";
import { cors } from "hono/cors";
import { streamSSE } from "hono/streaming";
import { activityRows, explorerObjectUrl, explorerTxUrl } from "../chain/activity.js";
import { operatorCapId, vaultId } from "../chain/sisih.js";
import { cachedVault, readVault, recordTx, vaultReadError, vaultState } from "../chain/vault.js";
import { db, schema } from "../db/index.js";
import { jsonSafe, since, subscribe } from "../lib/bus.js";
import { suiNetwork } from "../lib/env.js";
import { tatumGrpcHost, tatumStats } from "../lib/tatum.js";
import { delegatePublicKey, memwalHealth, namespace, pendingMemoryCount, remember, retryMemory, RELAYER_URL } from "../memory/memwal.js";
import { MERCHANTS } from "../merchants/registry.js";
import { acceptSuggestion, listSuggestions, onVaultEvents, rejectSuggestion } from "../services/chainEvents.js";
import { insights } from "../services/insights.js";
import { paymentExecutor } from "../services/payments.js";
import { ApiError, getRequest, listRequests, ownerDecision, requestView, ruleDraft, submitRequest, type OwnerDecision } from "../services/requests.js";
import { sessionStats, startSession } from "../services/sessions.js";
import { addLocalRule, cachedRule, cachedRules, currentSession, kvRead, setRuleActive } from "../services/state.js";
import { isScenario, runTask, SCENARIOS } from "../agent/runner.js";
import { advanceCycle, clock, resetDemo } from "../demo/controls.js";
import { merchantRoutes } from "../x402/merchants.js";

export const walrusBlobUrl = (blobId: string) => `https://walruscan.com/mainnet/blob/${blobId}`;

const ok = (c: Context, body: unknown, status: 200 | 201 = 200) => c.json(jsonSafe(body) as object, status);

function tatumStatus() {
  const s = tatumStats;
  const now = Date.now();
  const recentError = s.lastError && (!s.lastOkAt || s.lastError.at > s.lastOkAt) && now - s.lastError.at < 120_000;
  const level = recentError ? "red" : s.lastLatencyMs !== null && s.lastLatencyMs > 2000 ? "yellow" : s.lastOkAt ? "green" : "yellow";
  return { level, host: tatumGrpcHost(), network: suiNetwork(), lastOkAt: s.lastOkAt, lastLatencyMs: s.lastLatencyMs, calls: s.calls, failures: s.failures, retries: s.retries, byMethod: s.byMethod, lastError: s.lastError };
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

function ruleView(r: ReturnType<typeof cachedRules>[number]) {
  const mem = r.sourceMemoryId ? db().select().from(schema.memories).where(eq(schema.memories.id, r.sourceMemoryId)).get() : undefined;
  const blobId = r.sourceBlobId ?? mem?.blobId ?? null;
  return { ...r, sourceBlobId: blobId, walrusUrl: blobId ? walrusBlobUrl(blobId) : null, sourceMemoryStatus: mem?.status ?? (blobId ? "stored" : null) };
}

export function createApp() {
  const app = new Hono();
  app.use("/api/*", cors({ origin: (o) => o ?? "*", allowMethods: ["GET", "POST", "PATCH", "OPTIONS"] }));

  app.onError((err, c) => {
    if (err instanceof ApiError) return c.json({ error: err.message, code: err.code }, err.status);
    if (err instanceof SyntaxError) return c.json({ error: "Invalid JSON body", code: "bad_json" }, 400);
    console.error(err);
    return c.json({ error: (err as Error).message.slice(0, 300), code: "internal" }, 500);
  });

  // --- health & state ---------------------------------------------------------------
  app.get("/api/health", async (c) => {
    const [mem, agentId] = await Promise.all([memwalHealth(), delegatePublicKey().catch(() => null)]);
    return ok(c, {
      tatum: tatumStatus(),
      vaultRead: { lastReadAtMs: cachedVault()?.readAtMs ?? null, error: vaultReadError() },
      memwal: { ...mem, relayer: RELAYER_URL, namespace: namespace(), agentId, pending: pendingMemoryCount() },
      payments: { executor: paymentExecutor().name },
    });
  });

  app.get("/api/state", async (c) => {
    const vault = await vaultState();
    const mem = db().select().from(schema.memories).all();
    const held = db().select().from(schema.requests).where(eq(schema.requests.status, "held")).all().length;
    return ok(c, {
      network: suiNetwork(),
      vault: { ...vault, explorerUrl: explorerObjectUrl(vault.vaultId), operatorCapId: operatorCapId() },
      verifiedVia: "Tatum Sui gRPC",
      readAtMs: vault.readAtMs,
      session: currentSession(),
      heldRequests: held,
      memory: { namespace: namespace(), stored: mem.filter((m) => m.status === "stored").length, writing: mem.filter((m) => m.status === "writing").length, failed: mem.filter((m) => m.status === "failed").length },
      tatum: tatumStatus(),
      demo: { merchants: MERCHANTS.map((m) => ({ name: m.name, demo: true })) },
    });
  });

  /** Force one fresh vault read (the dashboard's "Refresh" button). */
  app.post("/api/state/refresh", async (c) => ok(c, await readVault()));

  // --- obligations --------------------------------------------------------------------
  app.get("/api/obligations", async (c) => {
    const vault = await vaultState();
    const open = listSuggestions().filter((s) => s.status === "open");
    return ok(c, vault.obligations.map((o) => ({ ...o, suggestion: open.find((s) => s.obligationId === o.id) ?? null })));
  });

  app.get("/api/obligations/:id", async (c) => {
    const id = Number(c.req.param("id"));
    const vault = await vaultState();
    const o = vault.obligations.find((x) => x.id === id);
    const activity = activityRows(500).filter((r) => (r.kind === "Pay obligation" || r.kind === "Reserve" || r.kind === "Change reserve") && (r.to === o?.name || r.from === o?.name || r.to === `Obligation #${id}`));
    const memories = db().select().from(schema.memories).all().filter((m) => {
      const p = JSON.parse(m.payload);
      return p.obligationId === id || (o && p.name === o.name);
    });
    if (!o && activity.length === 0) throw new ApiError(404, `No obligation ${id}`, "not_found");
    return ok(c, { obligation: o ?? null, removed: !o, activity, memories: memories.map(memoryView), suggestions: listSuggestions().filter((s) => s.obligationId === id) });
  });

  // --- requests -----------------------------------------------------------------------
  app.get("/api/requests", (c) => {
    const status = c.req.query("status");
    const category = c.req.query("category");
    const session = c.req.query("session");
    let rows = listRequests().map(requestView);
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

  app.get("/api/requests/:id", (c) => {
    const r = requestView(getRequest(c.req.param("id")));
    const rules = r.matchedRuleIds.map((id) => cachedRule(id)).filter(Boolean).map((x) => ruleView(x!));
    const decisions = db().select().from(schema.decisions).where(eq(schema.decisions.requestId, r.id)).all();
    const txs = db().select().from(schema.txLog).where(eq(schema.txLog.requestId, r.id)).all().map((t) => ({ digest: t.digest, status: t.status, label: t.label, explorerUrl: explorerTxUrl(t.digest) }));
    return ok(c, { ...r, rules, decisions, transactions: txs });
  });

  app.get("/api/requests/:id/rule-draft", (c) => {
    const action = c.req.query("action");
    return ok(c, ruleDraft(c.req.param("id"), action === "deny" || action === "allow" ? action : undefined));
  });

  app.post("/api/requests/:id/decision", async (c) => {
    const body = await c.req.json<{ action: OwnerDecision; rule?: Parameters<typeof ownerDecision>[2] }>();
    const kinds: OwnerDecision[] = ["approve_once", "approve_and_remember", "deny", "deny_and_remember"];
    if (!kinds.includes(body.action)) throw new ApiError(400, `action must be one of ${kinds.join(", ")}`);
    return ok(c, await ownerDecision(c.req.param("id"), body.action, body.rule));
  });

  // --- rules --------------------------------------------------------------------------
  app.get("/api/rules", (c) => ok(c, cachedRules().map(ruleView)));

  app.patch("/api/rules/:id", async (c) => {
    const id = c.req.param("id");
    const rule = cachedRule(id);
    if (!rule) throw new ApiError(404, `No rule ${id}`, "not_found");
    const { active } = await c.req.json<{ active: boolean }>();
    if (active === rule.active) return ok(c, ruleView(rule));
    if (!active) {
      const mem = remember("rule_disabled", `Rule disabled: ${rule.sentence}`, { ruleId: id }, { session: currentSession() });
      setRuleActive(id, false);
      return ok(c, { ...ruleView(cachedRule(id)!), disabledMemoryId: mem.id });
    }
    // Re-enabling writes the rule again under a new id (Walrus memories are never deleted).
    const mem = remember(
      "rule",
      rule.sentence,
      { ruleId: `${id}-r`, merchant: rule.merchant, category: rule.category, maxAmount: rule.maxAmount.toString(), action: rule.action, expiresMs: rule.expiresMs },
      { session: currentSession() },
    );
    const copy = addLocalRule({ merchant: rule.merchant, category: rule.category, maxAmount: rule.maxAmount, action: rule.action, expiresMs: rule.expiresMs, sentence: rule.sentence }, mem.id, `${id}-r`);
    return ok(c, ruleView(copy));
  });

  // --- memory -------------------------------------------------------------------------
  app.get("/api/memories", (c) => {
    const type = c.req.query("type");
    const session = c.req.query("session");
    let rows = db().select().from(schema.memories).orderBy(desc(schema.memories.createdAt)).all();
    if (type) rows = rows.filter((m) => m.type === type);
    if (session) rows = rows.filter((m) => m.session === Number(session));
    return ok(c, rows.map(memoryView));
  });

  app.get("/api/memories/:id", (c) => {
    const m = db().select().from(schema.memories).where(eq(schema.memories.id, c.req.param("id"))).get();
    if (!m) throw new ApiError(404, "No such memory", "not_found");
    const v = memoryView(m);
    const usedBy = v.usedInDecisions.map((id) => db().select().from(schema.requests).where(eq(schema.requests.id, id)).get()).filter(Boolean).map((r) => requestView(r!));
    return ok(c, { ...v, decisions: usedBy });
  });

  app.post("/api/memories/:id/retry", (c) => {
    if (!retryMemory(c.req.param("id"))) throw new ApiError(409, "Only failed memories can be retried", "not_failed");
    return ok(c, { retrying: true });
  });

  app.get("/api/recall/last", (c) => {
    const raw = kvRead("last_recall");
    if (!raw) return ok(c, null);
    const last = JSON.parse(raw) as { requestId: string };
    const r = db().select().from(schema.requests).where(eq(schema.requests.id, last.requestId)).get();
    return ok(c, { ...last, request: r ? requestView(r) : null });
  });

  // --- insights, activity, transactions -----------------------------------------------
  app.get("/api/insights", (c) => ok(c, insights()));

  app.get("/api/activity", (c) => {
    const kind = c.req.query("kind");
    let rows = activityRows(Number(c.req.query("limit") ?? 200));
    if (kind) rows = rows.filter((r) => r.kind === kind);
    return ok(c, rows);
  });

  app.get("/api/tx/:digest", (c) => {
    const t = db().select().from(schema.txLog).where(eq(schema.txLog.digest, c.req.param("digest"))).get();
    if (!t) throw new ApiError(404, "Unknown digest. POST it to /api/tx first.", "not_found");
    return ok(c, { ...t, events: t.events ? JSON.parse(t.events) : [], explorerUrl: explorerTxUrl(t.digest) });
  });

  /** A digest signed elsewhere (browser wallet, scripts): prove it through Tatum and log it. */
  app.post("/api/tx", async (c) => {
    const body = await c.req.json<{ digest: string; label?: string; source?: "owner" | "import" }>();
    if (!/^[1-9A-HJ-NP-Za-km-z]{32,50}$/.test(body.digest ?? "")) throw new ApiError(400, "digest must be a base58 transaction digest");
    const rec = await recordTx(body.digest, { source: body.source ?? "owner", label: body.label });
    onVaultEvents(rec);
    return ok(c, { ...rec, explorerUrl: explorerTxUrl(rec.digest) }, 201);
  });

  // --- suggestions --------------------------------------------------------------------
  app.get("/api/suggestions", (c) => ok(c, listSuggestions()));
  app.post("/api/suggestions/:id/accept", async (c) => {
    const { digest } = await c.req.json<{ digest: string }>();
    return ok(c, await acceptSuggestion(c.req.param("id"), digest));
  });
  app.post("/api/suggestions/:id/reject", (c) => ok(c, rejectSuggestion(c.req.param("id"))));

  // --- sessions -----------------------------------------------------------------------
  app.get("/api/sessions", (c) =>
    ok(c, db().select().from(schema.sessions).orderBy(schema.sessions.n).all().map((s) => ({ ...s, stats: sessionStats(s.n) }))),
  );
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

  // --- SSE ----------------------------------------------------------------------------
  app.get("/api/events", (c) =>
    streamSSE(c, async (stream) => {
      const lastId = Number(c.req.header("Last-Event-ID") ?? 0);
      for (const ev of since(lastId)) await stream.writeSSE({ id: String(ev.id), event: ev.type, data: JSON.stringify(ev.data) });
      const unsubscribe = subscribe((ev) => {
        void stream.writeSSE({ id: String(ev.id), event: ev.type, data: JSON.stringify(ev.data) });
      });
      stream.onAbort(unsubscribe);
      await stream.writeSSE({ event: "hello", data: JSON.stringify({ session: currentSession(), vaultId: vaultId() }) });
      while (!stream.aborted) {
        await stream.sleep(15_000);
        await stream.writeSSE({ event: "ping", data: String(Date.now()) });
      }
      unsubscribe();
    }),
  );

  // Demo merchants (x402): /merchants/datamart/token-history, /merchants/searchbox/premium-search,
  // /merchants/reportlab/onchain-report
  app.route("/", merchantRoutes());

  return app;
}
