/** Sisih server: policy engine, Tatum, Walrus Memory, REST + SSE. */
import { serve } from "@hono/node-server";
import { createApp } from "./api/app";
import { readVault } from "./chain/vault";
import { initDb } from "./db/index";
import { formatUsdc, suiNetwork } from "./lib/env";
import { namespace } from "./memory/memwal";
import { cachedRules, currentSession } from "./services/state";
import { assertRuntimeBudgetsReady } from "./mainnet/runtime";
import { credentialConfig } from "./auth/context";
import { proofManifest } from "./mainnet/proof-policy";
import { suiClient } from "./lib/tatum";

const port = Number(process.env.PORT ?? 8787);

// The server never holds a Mainnet owner key; owner intents are signed by the local helper.
if (suiNetwork() === "mainnet" && process.env.OWNER_PRIVATE_KEY) {
  console.error("Refusing to start: OWNER_PRIVATE_KEY is set while SUI_NETWORK=mainnet. Remove it from this environment.");
  process.exit(1);
}
if (suiNetwork() === "mainnet") {
  const credentials = credentialConfig("mainnet");
  if (credentials.error || !credentials.agent || !credentials.owner) throw new Error(credentials.error ?? "Both Mainnet role credentials must be configured");
}

await initDb();
await assertRuntimeBudgetsReady();
if (suiNetwork() === "mainnet") {
  const plan = await proofManifest();
  const info = await suiClient("mainnet").ledgerService.getServiceInfo({});
  if (info.response.chainId !== plan.chain_id) throw new Error("Connected chain differs from the reviewed Mainnet plan");
}
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
