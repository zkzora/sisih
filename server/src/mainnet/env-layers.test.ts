import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, unlinkSync, rmdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";

const dir = mkdtempSync(join(tmpdir(), "sisih-env-fixture-"));
const first = join(dir, "owner.env");
const second = join(dir, "deployment.env");
const conflict = join(dir, "conflict.env");
writeFileSync(first, "SUI_NETWORK=mainnet\nSISIH_PACKAGE_ID=\nOWNER_PRIVATE_KEY=fake-owner-fixture\n");
writeFileSync(second, "SISIH_PACKAGE_ID=0xfixture\n");
writeFileSync(conflict, "OWNER_PRIVATE_KEY=fake-other-fixture\n");
const cli = fileURLToPath(new URL("../../node_modules/tsx/dist/cli.mjs", new URL("../", import.meta.url)));
const module = fileURLToPath(new URL("../lib/env.ts", import.meta.url)).replaceAll("\\", "/");
const run = (selection: string, inherited: Record<string, string> = {}) => {
  const clean = Object.fromEntries(Object.entries(process.env).filter(([key]) => !/SUI_NETWORK|PRIVATE_KEY|TOKEN|SISIH_|VAULT_ID|OPERATOR_CAP|MEMWAL|DATABASE|USDC|TATUM/.test(key)));
  return spawnSync(process.execPath, [cli, "-e", `import { suiNetwork, env } from ${JSON.stringify(module)}; console.log(suiNetwork(), env('SISIH_PACKAGE_ID'));`], { env: { ...clean, SISIH_ENV_FILE: selection, ...inherited }, encoding: "utf8" });
};
afterAll(() => { [first, second, conflict].forEach(unlinkSync); rmdirSync(dir); });

describe("real configuration loading in fresh processes", () => {
  it("loads a blank deployment ID from the later file without loading Testnet root config", () => {
    const result = run(`${first},${second}`);
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout.trim()).toBe("mainnet 0xfixture");
  });
  it("fails on a missing explicitly selected file", () => {
    const result = run(`${first},${join(dir, "missing.env")}`);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toMatch(/does not exist/);
  });
  it("refuses mixed secret identities rather than silently replacing them", () => {
    const result = run(`${first},${conflict}`);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toMatch(/Conflicting OWNER_PRIVATE_KEY/);
    expect(result.stderr).not.toContain("fake-other-fixture");
  });
});
