/**
 * Contract check behind scripts/gate-release.ts: the operator releases 0.50 to the agent (must
 * succeed), then an amount above free funds (must abort onchain with EExceedsFree). The second
 * transaction bypasses the server's policy engine, so only the Move vault refuses it.
 *
 * Arguments are parsed strictly BEFORE anything else: --help, unknown options, a bad amount or a
 * missing --yes return without calling any transaction function (2026-11-07 fix: an unknown
 * "--help" used to fall through and run both releases).
 */
export type GateArgs =
  | { kind: "help" }
  | { kind: "error"; message: string }
  | { kind: "plan"; successRelease: boolean; refusedAmount: string }
  | { kind: "run"; successRelease: boolean; refusedAmount: string };

export const GATE_USAGE = `Usage: tsx scripts/gate-release.ts --yes [--skip-success] [--amount <usdc>]
  Sends real testnet transactions from the operator:
    1. release 0.50 USDC to the agent (skipped with --skip-success)
    2. release <amount> (default 5.00), which must abort onchain with EExceedsFree
  --yes is required; without it the script only prints what it would do.`;

export function parseGateArgs(argv: string[]): GateArgs {
  let successRelease = true;
  let refusedAmount = "5.00";
  let yes = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === "--help" || a === "-h") return { kind: "help" };
    else if (a === "--skip-success") successRelease = false;
    else if (a === "--yes") yes = true;
    else if (a === "--amount" || a.startsWith("--amount=")) {
      const v = a === "--amount" ? argv[++i] : a.slice("--amount=".length);
      if (!v || !/^\d{1,6}(\.\d{1,6})?$/.test(v) || Number(v) <= 0) return { kind: "error", message: "--amount must be a positive USDC amount such as 1.20" };
      refusedAmount = v;
    } else return { kind: "error", message: `Unknown argument "${a}".` };
  }
  return yes ? { kind: "run", successRelease, refusedAmount } : { kind: "plan", successRelease, refusedAmount };
}

export interface GateDeps {
  release: (amountUsdc: string, requestId: string, unsimulated: boolean) => Promise<{ digest: string; success: boolean; error?: string | null }>;
  verify: (digest: string) => Promise<{ success: boolean }>;
  agentUsdc: () => Promise<bigint>;
  abortName: (error: string | null | undefined) => string | null;
  log: (line: string) => void;
}

/** Returns the exit code. Only kind "run" ever calls deps.release. */
export async function runGateRelease(argv: string[], deps: GateDeps): Promise<number> {
  const a = parseGateArgs(argv);
  if (a.kind === "help") {
    deps.log(GATE_USAGE);
    return 0;
  }
  if (a.kind === "error") {
    deps.log(`Error: ${a.message}\n${GATE_USAGE}`);
    return 2;
  }
  if (a.kind === "plan") {
    deps.log(`Would send: ${a.successRelease ? "release 0.50, then " : ""}release ${a.refusedAmount} (must abort with EExceedsFree). Nothing sent; add --yes to run.`);
    return 2;
  }
  let okPass = true;
  if (a.successRelease) {
    const before = await deps.agentUsdc();
    const ok = await deps.release("0.50", "gate-0.50", false);
    const okV = await deps.verify(ok.digest);
    const after = await deps.agentUsdc();
    deps.log(`release 0.50: ${ok.digest} success=${ok.success} verified=${okV.success} agent USDC delta ${Number(after - before) / 1e6}`);
    okPass = ok.success && okV.success && after - before === 500_000n;
  }
  const bad = await deps.release(a.refusedAmount, `gate-${a.refusedAmount}`, true);
  const badV = await deps.verify(bad.digest);
  deps.log(`release ${a.refusedAmount}: ${bad.digest} success=${bad.success} verified-on-chain=${!badV.success ? "failed as expected" : "UNEXPECTED SUCCESS"}`);
  deps.log(`  abort: ${deps.abortName(bad.error)}  raw: ${String(bad.error ?? "").slice(0, 300)}`);
  const pass = okPass && !bad.success && !badV.success && deps.abortName(bad.error) === "EExceedsFree";
  deps.log(pass ? "PASS" : "FAIL");
  return pass ? 0 : 1;
}
