/** Sisih server: policy engine, Tatum, Walrus Memory, REST + SSE. */
import { serve } from "@hono/node-server";
import { createApp } from "./api/app.js";
import { readVault } from "./chain/vault.js";
import { formatUsdc, suiNetwork } from "./lib/env.js";
import { namespace } from "./memory/memwal.js";
import { cachedRules, currentSession } from "./services/state.js";

const port = Number(process.env.PORT ?? 8787);

const session = currentSession();
const rules = cachedRules();
try {
  const v = await readVault(); // the one boot-time read; afterwards only after transactions
  console.log(`vault ${v.vaultId} (${suiNetwork()}, via Tatum): total ${formatUsdc(v.total)} committed ${formatUsdc(v.reserved)} free ${formatUsdc(v.free)}`);
} catch (err) {
  console.error("initial vault read failed (will retry on first request):", (err as Error).message);
}
console.log(`session ${session}, ${rules.length} cached rules, memory namespace ${namespace()}`);

serve({ fetch: createApp().fetch, port, hostname: process.env.HOST ?? "127.0.0.1" }, (info) => {
  console.log(`sisih server on http://${info.address}:${info.port}`);
});
