/** Read-only chain reconciliation; updates DB state but never signs, broadcasts or retries. */
import { initDb } from "../../src/db/index";
import { suiNetwork } from "../../src/lib/env";
import { paymentRecovery, reconcilePaymentRecovery } from "../../src/services/payments";

const requestId = process.argv[2];
if (!requestId || process.argv.includes("--help")) {
  console.log("reconcile-payment.ts <request-id>. Reads Tatum/DB only; never sends a transaction.");
  process.exit(requestId ? 0 : 2);
}
if (suiNetwork() !== "mainnet") throw new Error("Select the Mainnet environment before reconciling Mainnet evidence");
await initDb();
const before = await paymentRecovery(requestId);
const after = await reconcilePaymentRecovery(requestId);
console.log(JSON.stringify({ request_id: requestId, before, after, resolved_to_paid: Boolean(before && !after) }, null, 2));
