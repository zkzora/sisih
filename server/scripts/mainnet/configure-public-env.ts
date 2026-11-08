/** Apply the audited signer-free Mainnet environment; values go only over stdin to Vercel. */
import { readFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { parse } from "dotenv";
const root = resolve(import.meta.dirname, "../../..");
if (!process.argv.includes("--execute")) { console.log("configure-public-env.ts --execute. Replaces production runtime config with the isolated signer-free Mainnet config. Never submits a Sui transaction."); process.exit(0); }
const values = parse(readFileSync(resolve(root, ".env.mainnet.public")));
const previous = parse(readFileSync(resolve(root, ".env.vercel.production.previous")));
if (values.SUI_NETWORK !== "mainnet" || values.MAINNET_READ_ONLY !== "true" || values.DATABASE_SCHEMA !== "sisih_mainnet_proof_20261107" || values.PUBLIC_BASE_URL !== "https://sisih-azure.vercel.app" || Object.keys(values).some(k => k.includes("PRIVATE_KEY"))) throw new Error("Public environment differs from reviewed signer-free target");
const cli = resolve(process.env.APPDATA!, "npm/node_modules/vercel/dist/vc.js");
const scrub = (value: string) => [...Object.values(values), ...Object.values(previous)].filter(secret => secret.length > 8).reduce((text, secret) => text.split(secret).join("[REDACTED]"), value);
const run = (args: string[], input?: string) => new Promise<void>((done, reject) => {
  const child = spawn(process.execPath, [cli, ...args], { cwd: root, windowsHide: true, stdio: ["pipe", "pipe", "pipe"] });
  let output = "";
  child.stdout.on("data", data => { output += data; }); child.stderr.on("data", data => { output += data; });
  child.stdin.end(input);
  child.on("error", reject);
  child.on("close", code => code === 0 ? done() : reject(new Error(`Vercel ${args[1]} ${args[2]} failed (exit ${code}): ${scrub(output).slice(-1600)}`)));
});
for (const key of Object.keys(previous).filter(k => !process.argv.includes("--resume") && /PRIVATE_KEY|TESTNET|^DEMO_|^MEMWAL_NAMESPACE$/.test(k))) {
  await run(["env", "rm", key, "production", "--yes"]);
  console.log(`Removed production ${key}`);
}
for (const [key, value] of Object.entries(values)) {
  if (process.argv.includes("--resume") && !["PUBLIC_BASE_URL", "WEB_ORIGIN", "NEXT_PUBLIC_SUI_NETWORK", "NEXT_PUBLIC_DEV_STATES"].includes(key)) continue;
  await run(["env", "add", key, "production", "--force", "--yes"], value);
  console.log(`Configured production ${key} (value withheld)`);
}
console.log("Production Mainnet environment configured. No wallet signing key uploaded. Deploy the reviewed source next.");
