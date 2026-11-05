/** Sisih server: policy engine, Tatum, Walrus Memory, REST + SSE. */
import { serve } from "@hono/node-server";
import { createApp } from "./api/app";
import { readVault } from "./chain/vault";
import { initDb } from "./db/index";
import { formatUsdc, suiNetwork } from "./lib/env";
import { namespace } from "./memory/memwal";
import { cachedRules, currentSession } from "./services/state";

const port = Number(process.env.PORT ?? 8787);

// The hosted server must never hold a mainnet owner key; owner actions there are signed in the browser.
if (suiNetwork() === "mainnet" && process.env.OWNER_PRIVATE_KEY) {
  console.error("Refusing to start: OWNER_PRIVATE_KEY is set while SUI_NETWORK=mainnet. Remove it from this environment.");
  process.exit(1);
}
if (!process.env.DEMO_TOKEN) console.warn("DEMO_TOKEN is not set: mutating endpoints are open (local development only).");

await initDb();
const session = await currentSession();
const rules = await cachedRules();
try {
  const v = await readVault(); // the one boot-time read; afterwards only after transactions
  console.log(`vault ${v.vaultId} (${suiNetwork()}, via Tatum): total ${formatUsdc(v.total)} committed ${formatUsdc(v.reserved)} free ${formatUsdc(v.free)}`);
} catch (err) {
  console.error("initial vault read failed (will retry on first request):", (err as Error).message);
}
console.log(`session ${session}, ${rules.length} cached rules, memory namespace ${await namespace()}`);

serve({ fetch: createApp().fetch, port, hostname: process.env.HOST ?? "127.0.0.1" }, (info) => {
  console.log(`sisih server on http://${info.address}:${info.port}`);
});
