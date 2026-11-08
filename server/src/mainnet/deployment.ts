import { normalizeStructTag, normalizeSuiAddress } from "@mysten/sui/utils";
import { parseVault } from "../chain/vault";
import { suiClient } from "../lib/tatum";
import type { MainnetManifest } from "./manifest";

export interface MainnetIds { packageId: string; vaultId: string; operatorCapId: string; upgradeCapId?: string }
export async function verifyMainnetObjects(manifest: MainnetManifest, ids: MainnetIds) {
  const client = suiClient("mainnet");
  const same = (a: string, b: string) => normalizeSuiAddress(a) === normalizeSuiAddress(b);
  const chain = await client.ledgerService.getServiceInfo({});
  if (chain.response.chainId !== manifest.chain_id) throw new Error("Connected chain differs from reviewed Mainnet");
  const metadata = (await client.getCoinMetadata({ coinType: manifest.asset.coin_type })).coinMetadata;
  if (metadata?.symbol !== "USDC" || metadata.decimals !== 6) throw new Error("Native USDC metadata mismatch");
  const { object: vault } = await client.getObject({ objectId: ids.vaultId, include: { json: true } });
  const expectedType = `${ids.packageId}::vault::Vault<${manifest.asset.coin_type}>`;
  if (vault.owner.$kind !== "Shared" || normalizeStructTag(vault.type) !== normalizeStructTag(expectedType)) throw new Error("Vault type or shared ownership mismatch");
  const fields = vault.json as Record<string, unknown>;
  if (!same(String(fields.owner), manifest.roles.owner.address) || !same(String(fields.operator_cap_id), ids.operatorCapId)) throw new Error("Vault owner or operator capability mismatch");
  const { object: cap } = await client.getObject({ objectId: ids.operatorCapId, include: { json: true } });
  if (cap.owner.$kind !== "AddressOwner" || !same(cap.owner.AddressOwner, manifest.roles.operator.address)) throw new Error("OperatorCap is not owned by the reviewed operator");
  if (normalizeStructTag(cap.type) !== normalizeStructTag(`${ids.packageId}::vault::OperatorCap`) || !same(String((cap.json as Record<string, unknown>).vault_id), ids.vaultId)) throw new Error("OperatorCap type or vault binding mismatch");
  if (ids.upgradeCapId) {
    const { object: upgrade } = await client.getObject({ objectId: ids.upgradeCapId, include: { json: true } });
    if (upgrade.owner.$kind !== "AddressOwner" || !same(upgrade.owner.AddressOwner, manifest.roles.owner.address)) throw new Error("UpgradeCap custody differs from reviewed owner");
    if (!same(String((upgrade.json as Record<string, unknown>).package), ids.packageId)) throw new Error("UpgradeCap package binding mismatch");
  }
  return { checkpoint: String(chain.response.checkpointHeight), state: parseVault(vault.objectId, fields), ids };
}
