/**
 * Research Agent runner (AGENT_PRIVATE_KEY). One task = call a demo merchant, receive its 402,
 * ask Sisih for payment. Sisih decides from its caches:
 *   auto_allow -> the x402 executor releases from the vault and pays with that exact coin
 *   hold       -> returns held; the owner's decision (API/UI) triggers the same payment path
 *   auto_deny  -> logged, nothing is paid
 * The category always comes from the merchant registry, never from the agent.
 */
import { findMerchant } from "../merchants/registry.js";
import { submitRequest } from "../services/requests.js";
import { fetchInvoice } from "../x402/agentPay.js";
import { baseUrl } from "../x402/merchants.js";

export const SCENARIOS = {
  cheap_data: { merchant: "datamart", task: "Research SUI token price: fetch historical prices" },
  new_merchant_search: { merchant: "searchbox", task: "Research SUI token price: search recent news" },
  expensive_report: { merchant: "reportlab", task: "Research SUI token price: buy an onchain research report" },
} as const;

export type Scenario = keyof typeof SCENARIOS;

export function isScenario(s: string): s is Scenario {
  return s in SCENARIOS;
}

export async function runTask(scenario: Scenario) {
  const s = SCENARIOS[scenario];
  const m = findMerchant(s.merchant)!;
  const invoice = await fetchInvoice(`${baseUrl()}${m.path}`); // step 1: 402 invoice
  return submitRequest({ merchant: m.name, taskContext: s.task, invoice });
}
