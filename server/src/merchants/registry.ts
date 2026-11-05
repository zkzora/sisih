/**
 * Demo merchants (labeled demo everywhere). The category always comes from this registry,
 * never from the agent, so an agent cannot relabel a purchase to match a rule.
 */
import { env } from "../lib/env";
import type { Category } from "../domain/types";

export interface Merchant {
  slug: "datamart" | "searchbox" | "reportlab";
  name: "DataMart" | "SearchBox" | "ReportLab";
  item: string;
  path: string;
  category: Category;
  price: bigint;
  demo: true;
  addressEnv: string;
}

export const MERCHANTS: readonly Merchant[] = [
  { slug: "datamart", name: "DataMart", item: "Historical token prices", path: "/merchants/datamart/token-history", category: "data", price: 500_000n, demo: true, addressEnv: "MERCHANT_DATAMART_ADDRESS" },
  { slug: "searchbox", name: "SearchBox", item: "Premium search", path: "/merchants/searchbox/premium-search", category: "search", price: 1_200_000n, demo: true, addressEnv: "MERCHANT_SEARCHBOX_ADDRESS" },
  { slug: "reportlab", name: "ReportLab", item: "Onchain research report", path: "/merchants/reportlab/onchain-report", category: "research", price: 3_000_000n, demo: true, addressEnv: "MERCHANT_REPORTLAB_ADDRESS" },
];

export function findMerchant(nameOrSlug: string): Merchant | undefined {
  const k = nameOrSlug.trim().toLowerCase();
  return MERCHANTS.find((m) => m.slug === k || m.name.toLowerCase() === k);
}

export function merchantAddress(m: Merchant): string | undefined {
  return env(m.addressEnv);
}

export const CATEGORY_LABEL: Record<Category, string> = {
  data: "Data",
  search: "Search",
  inference: "Inference",
  research: "Research",
};
