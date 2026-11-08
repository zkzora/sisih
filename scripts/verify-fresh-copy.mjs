/** Verify the current source in a local clone with no developer env/config/database files. */
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, mkdirSync, copyFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve, join, dirname, basename } from "node:path";
const root = process.cwd();
const cli = process.env.SISIH_PNPM_CLI;
if (!cli || !existsSync(cli)) throw new Error("Set SISIH_PNPM_CLI to the installed pnpm bin/pnpm.mjs");
const clean = Object.fromEntries(Object.entries(process.env).filter(([key]) => !/SUI_NETWORK|PRIVATE_KEY|TOKEN|^SISIH_|VAULT_ID|OPERATOR_CAP|MEMWAL|DATABASE_URL|POSTGRES_URL|USDC|TATUM|PUBLIC_BASE_URL/.test(key)));
const reuseAt = process.argv.indexOf("--reuse");
const target = reuseAt < 0 ? mkdtempSync(join(tmpdir(), "sisih-fresh-")) : resolve(process.argv[reuseAt + 1]);
if (!target.startsWith(resolve(tmpdir())) || !basename(target).startsWith("sisih-fresh-")) throw new Error("Isolated target must be an explicitly named sisih-fresh directory in the temporary folder");
const git = (args, cwd = root, input) => {
  const result = spawnSync("git", args, { cwd, input, env: clean, maxBuffer: 128 * 1024 * 1024 });
  if (result.status !== 0) throw new Error(`git ${args[0]} failed: ${result.stderr.toString()}`);
  return result.stdout;
};
if (reuseAt < 0) {
  git(["clone", "--no-hardlinks", root, target]);
  const patch = git(["diff", "--binary", "HEAD"]);
  if (patch.length) git(["apply", "--whitespace=nowarn", "-"], target, patch);
}
const extra = git(reuseAt < 0 ? ["ls-files", "--others", "--exclude-standard", "-z"] : ["ls-files", "--cached", "--others", "--exclude-standard", "-z"]).toString().split("\0").filter(Boolean);
for (const file of extra) {
  if ((/^\.env/.test(file) && file !== ".env.example") || file.startsWith(".sisih-mainnet/")) throw new Error("A private config unexpectedly appears in the copy list");
  if (!existsSync(resolve(root, file))) continue;
  const dest = resolve(target, file);
  if (!dest.startsWith(target + "\\") && !dest.startsWith(target + "/")) throw new Error("Copy path escaped the isolated directory");
  mkdirSync(dirname(dest), { recursive: true });
  copyFileSync(resolve(root, file), dest);
}
if ([".env", ".env.mainnet", ".env.mainnet.server", ".env.mainnet.runtime"].some((file) => existsSync(resolve(target, file)))) throw new Error("Fresh clone contains local secrets");
console.log(`Fresh isolated source copy: ${target}`);
const run = (args) => new Promise((done, reject) => {
  const child = spawn(process.execPath, [cli, ...args], { cwd: target, env: clean, stdio: "inherit" });
  child.on("error", reject);
  child.on("exit", (code) => code === 0 ? done() : reject(new Error(`pnpm ${args.join(" ")} exited ${code}`)));
});
await run(["install", "--frozen-lockfile", "--offline"]);
await run(["test"]);
await run(["typecheck"]);
await run(["--filter", "@sisih/web", "build"]);
await run(["sisih", "--help"]);
for (const script of ["publish.ts", "mainnet/preflight.ts", "mainnet/manifest.ts", "mainnet/setup.ts", "mainnet/verify-evidence.ts", "mainnet/server-env.ts", "mainnet/init-budget.ts", "mainnet/simulate-reserve.ts", "mainnet/verify-deployment.ts", "mainnet/preflight-memory.ts", "mainnet/inspect-primitives.ts", "mainnet/run-agent.ts", "mainnet/capture-proof.ts", "mainnet/build-proof-spec.ts", "mainnet/capture-ledger.ts"]) {
  await run(["--filter", "@sisih/server", "exec", "tsx", `scripts/${script}`, "--help"]);
}
console.log(JSON.stringify({ fresh_copy: target, secrets_copied: false, dependency_install: "offline frozen lockfile", verified: ["tests", "typecheck", "production build", "owner CLI help", "Mainnet command help without local secrets"] }, null, 2));
