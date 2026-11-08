/** Exact local-secret and structural scans; prints counts/paths only, never matched values. */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
const git = (args, input) => {
  const r = spawnSync("git", args, { input, maxBuffer: 512 * 1024 * 1024 });
  if (r.status !== 0) throw new Error(`git ${args[0]} failed`);
  return r.stdout;
};
const secretValues = [];
for (const file of [".env", ".env.mainnet", ".env.mainnet.server", ".env.mainnet.public", ".env.vercel.production.previous"]) {
  if (!existsSync(file)) continue;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = /^([A-Z0-9_]+)=(.*)$/.exec(line);
    if (!match || !/PRIVATE_KEY|API_KEY|MEMWAL_KEY|(?:^|_)TOKEN$|DATABASE_URL|POSTGRES_URL/.test(match[1])) continue;
    const value = match[2].trim().replace(/^(["'])(.*)\1$/, "$2");
    if (value.length >= 12 && !value.startsWith("pglite:")) secretValues.push(Buffer.from(value));
  }
}
const patterns = [/suiprivkey1[a-z0-9]{50,}/, /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/, /(?:ghp_|github_pat_)[A-Za-z0-9_]{30,}/, /postgres(?:ql)?:\/\/[^\s:"'<>]+:[^\s@"'<>]+@/];
const findings = [];
const inspect = (data, label) => {
  if (secretValues.some((value) => data.includes(value))) findings.push({ label, type: "exact-local-secret" });
  if (patterns.some((pattern) => pattern.test(data.toString("utf8")))) findings.push({ label, type: "secret-pattern" });
};
const files = [...new Set(git(["ls-files", "--cached", "--others", "--exclude-standard", "-z"]).toString().split("\0").filter(Boolean))];
for (const file of files) if (existsSync(file)) inspect(readFileSync(file), file);
const objects = git(["rev-list", "--objects", "--all"]).toString().trim().split("\n").map((line) => line.split(" ")[0]);
const batch = git(["cat-file", "--batch"], objects.join("\n") + "\n");
let cursor = 0, scanned = 0;
while (cursor < batch.length) {
  const end = batch.indexOf(10, cursor);
  if (end < 0) break;
  const [sha, type, size] = batch.subarray(cursor, end).toString().split(" ");
  const length = Number(size);
  if (!Number.isFinite(length)) throw new Error("Malformed Git object batch");
  const body = batch.subarray(end + 1, end + 1 + length);
  if (type === "blob") { inspect(body, `history-blob:${sha}`); scanned++; }
  cursor = end + 1 + length + 1;
}
// Public address positive control proves bytes from historical content were actually inspected.
const control = Buffer.from("0x37a5513a911110d00b9c795390d1af5b04a3873e6df4856b54ede7e74ba886e9");
const positiveControl = batch.includes(control);
let buildFiles = 0;
const scanBuild = (dir) => {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) scanBuild(path);
    else if (entry.isFile()) { inspect(readFileSync(path), path); buildFiles++; }
  }
};
scanBuild("web/.next/static");
scanBuild("web/.next/server");
console.log(JSON.stringify({ working_files: files.length, history_blobs: scanned, production_artifacts: buildFiles, secret_values_checked: secretValues.length, positive_public_id_control: positiveControl, findings }, null, 2));
process.exitCode = findings.length || !positiveControl ? 1 : 0;
