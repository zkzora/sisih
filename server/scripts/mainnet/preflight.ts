/**
 * Mainnet preflight: READ ONLY. It never signs, broadcasts or writes configuration.
 *
 *   SISIH_ENV_FILE=.env.mainnet pnpm --filter @sisih/server exec tsx scripts/mainnet/preflight.ts [--estimate] [--write <file>]
 *
 * Through Tatum's Sui Mainnet gateway only:
 * - chain identity and checkpoint (GetServiceInfo);
 * - the configured USDC coin type's metadata (GetCoinMetadata: symbol, decimals);
 * - SUI and USDC balances of the public role addresses (owner, operator, agent, facilitator);
 * - the reference gas price.
 * With --estimate it also builds the package locally (`sui move build --build-env mainnet`) and
 * SIMULATES the publish with a mocked gas coin (checksEnabled: false), so it works for an unfunded
 * owner. create_vault, deposit and the later calls cannot be simulated before the package exists;
 * the report says so instead of inventing a number.
 * Prints and (with --write) saves public data only: addresses, balances, gas, coin metadata.
 */
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { Transaction } from "@mysten/sui/transactions";
import { env, loadedEnvFiles, REPO_ROOT, suiNetwork } from "../../src/lib/env";
import { referenceGasPrice, suiClient } from "../../src/lib/tatum";
import { address, type WalletRole } from "../../src/lib/wallets";

/** Native USDC on Sui Mainnet (Circle), checked against the chain's coin metadata below. */
export const NATIVE_USDC_MAINNET = "0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC";

const args = process.argv.slice(2);
if (args.includes("--help") || args.includes("-h")) {
  console.log("Read-only Mainnet preflight. Options: --estimate (simulate the publish), --write <file> (save the public report). Never broadcasts.");
  process.exit(0);
}
const network = suiNetwork();
if (network !== "mainnet") {
  console.error(`Refusing: SUI_NETWORK is ${network}. Select the Mainnet config with SISIH_ENV_FILE=.env.mainnet (the repo-root .env is the Testnet demo).`);
  process.exit(2);
}

const sui = (mist: bigint) => (Number(mist) / 1e9).toFixed(6);
const usdc = (base: bigint) => (Number(base) / 1e6).toFixed(6);
const report: Record<string, unknown> = { generated_at: new Date().toISOString(), network: "sui:mainnet", config_files: loadedEnvFiles.map((f) => f.replace(REPO_ROOT, ".")), rpc: "Tatum Sui Mainnet gRPC" };
const problems: string[] = [];

const client = suiClient("mainnet");
const info = await client.ledgerService.getServiceInfo({});
report.chain = { chain_id: info.response.chainId, checkpoint: String(info.response.checkpointHeight), epoch: String(info.response.epoch) };

const coinType = env("USDC_COIN_TYPE") ?? "";
if (coinType !== NATIVE_USDC_MAINNET) problems.push(`USDC_COIN_TYPE is not native Mainnet USDC (${NATIVE_USDC_MAINNET})`);
const meta = (await client.getCoinMetadata({ coinType })).coinMetadata;
report.usdc = { coin_type: coinType, symbol: meta?.symbol ?? null, decimals: meta?.decimals ?? null, name: meta?.name ?? null };
if (!meta || meta.symbol !== "USDC" || meta.decimals !== 6) problems.push("USDC coin metadata is not symbol USDC with 6 decimals");

const gasPrice = await referenceGasPrice("mainnet");
report.reference_gas_price_mist = gasPrice.toString();

const roles: WalletRole[] = ["owner", "operator", "agent", "facilitator"];
const balances: Record<string, unknown> = {};
for (const r of roles) {
  let addr: string;
  try {
    addr = address(r);
  } catch {
    problems.push(`${r}: no address configured`);
    continue;
  }
  const [s, u] = await Promise.all([client.getBalance({ owner: addr }), client.getBalance({ owner: addr, coinType })]);
  balances[r] = { address: addr, sui: sui(BigInt(s.balance.balance)), usdc: usdc(BigInt(u.balance.balance)) };
}
report.balances = balances;

for (const k of ["SISIH_PACKAGE_ID", "VAULT_ID", "OPERATOR_CAP_ID"]) report[k.toLowerCase()] = env(k) ?? null;
report.deployed = Boolean(env("SISIH_PACKAGE_ID") && env("VAULT_ID"));
if (!env("DATABASE_URL")) problems.push("DATABASE_URL is not set (Mainnet needs its own database; it never falls back to the Testnet PGlite)");
const ns = env("MEMWAL_NAMESPACE_PREFIX") ?? "";
if (!ns || /^sisih-(hosted|local)/.test(ns)) problems.push("MEMWAL_NAMESPACE_PREFIX must be a Mainnet-proof prefix, not a Testnet demo prefix");

if (args.includes("--estimate")) {
  const contracts = resolve(REPO_ROOT, "contracts/sisih");
  const out = execFileSync("sui", ["move", "build", "--dump-bytecode-as-base64", "--build-env", "mainnet"], { cwd: contracts, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  const build = JSON.parse(out.slice(out.indexOf("{"))) as { modules: string[]; dependencies: string[] };
  const owner = address("owner");
  const tx = new Transaction();
  tx.setSender(owner);
  tx.setGasPrice(gasPrice);
  tx.setGasBudget(500_000_000n);
  tx.setGasPayment([]); // mocked gas coin in simulation (checks disabled)
  const [cap] = tx.publish({ modules: build.modules, dependencies: build.dependencies });
  tx.transferObjects([cap!], owner);
  try {
    const sim = await client.simulateTransaction({ transaction: tx, checksEnabled: false, include: { effects: true } });
    const t = sim.Transaction ?? sim.FailedTransaction;
    const g = t.effects.gasUsed;
    const net = BigInt(g.computationCost) + BigInt(g.storageCost) - BigInt(g.storageRebate);
    report.publish_estimate = {
      simulated: true,
      success: t.status.success,
      computation_mist: g.computationCost,
      storage_mist: g.storageCost,
      rebate_mist: g.storageRebate,
      net_sui: sui(net),
      note: "Simulated with a mocked gas coin through Tatum; not broadcast. Actual cost can differ with the gas price at execution.",
    };
  } catch (err) {
    report.publish_estimate = { simulated: false, error: (err as Error).message.slice(0, 300) };
    problems.push("publish simulation failed; see publish_estimate.error");
  }
  report.not_estimable_before_publish = [
    "create_vault (needs the published package)",
    "deposit, add_obligation x N, set_agent_policy (need the vault)",
    "release_to_agent, x402 settle, pause_agent (need funded vault and agent)",
  ];
}

report.problems = problems;
const text = JSON.stringify(report, null, 2);
console.log(text);
const w = args.indexOf("--write");
if (w >= 0 && args[w + 1]) {
  writeFileSync(resolve(REPO_ROOT, args[w + 1]!), `${text}\n`);
  console.error(`wrote ${args[w + 1]} (public data only)`);
}
process.exit(0);
