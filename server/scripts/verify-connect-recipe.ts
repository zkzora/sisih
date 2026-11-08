/** Verify the rendered Codex configuration with a real harmless hosted MCP check. */
import { spawn, execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { parse } from "dotenv";

const root = resolve(import.meta.dirname, "../..");
const folder = process.argv[2];
if (!folder || folder === "--help") {
  console.log("verify-connect-recipe.ts <browser-report-directory>. Executes the rendered Mainnet Codex CLI setup with reads only. No purchase tools or owner credentials.");
  process.exit(folder === "--help" ? 0 : 2);
}
const out = resolve(root, folder);
const snippets = JSON.parse(readFileSync(resolve(out, "connect-powershell-snippets.json"), "utf8")) as string[];
const snippet = snippets.find(value => value.includes("codex @options"));
if (!snippet) throw new Error("Rendered Codex snippet missing");
const options = snippet.split("\ncodex @options")[0]!;
const args = [...options.matchAll(/'([^']*)'/g)].map(hit => hit[1]!);
const prompt = /codex @options "([^"]+)"/.exec(snippet)?.[1];
if (!prompt || !prompt.includes("Do not buy anything")) throw new Error("Expected harmless prompt");
const urlIndex = args.findIndex(value => value.startsWith("mcp_servers.sisih.url="));
if (urlIndex < 0) throw new Error("MCP URL missing");
const renderedUrl = args[urlIndex]!.split("=").slice(1).join("=");
// A local browser report verifies the same recipe against the actual public Mainnet endpoint.
if (renderedUrl !== "http://127.0.0.1:3000/api/mcp" && renderedUrl !== "https://sisih-azure.vercel.app/api/mcp") throw new Error("Unexpected MCP target");
args[urlIndex] = "mcp_servers.sisih.url=https://sisih-azure.vercel.app/api/mcp";
args.push("-c", 'mcp_servers.sisih.enabled_tools=["list_services","get_budget","get_request_status","end_demo_session"]', "--json", `${prompt} Also read recorded requests req-7dd90263-75e and req-f37bacb5-c6a. Cite the settlement and remembered rule provenance from the second purchase and explain the third refusal. Do not create any purchase.`);
const local = parse(readFileSync(resolve(root, ".env.mainnet.public")));
const token = local.SISIH_AGENT_TOKEN;
if (!token) throw new Error("Mainnet agent credential missing");
const clean: NodeJS.ProcessEnv = {};
for (const name of ["PATH", "Path", "SYSTEMROOT", "SystemRoot", "WINDIR", "COMSPEC", "USERPROFILE", "HOME", "APPDATA", "LOCALAPPDATA", "TEMP", "TMP", "PATHEXT"]) if (process.env[name]) clean[name] = process.env[name];
clean.SISIH_AGENT_TOKEN = token;
const executable = execFileSync("powershell.exe", ["-NoProfile", "-Command", "(Get-Command codex).Source"], { encoding: "utf8" }).trim();
const cwd = mkdtempSync(resolve(tmpdir(), "sisih-connect-check-"));
const child = spawn(executable, args, { cwd, env: clean, stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
let stdout = "", stderr = "";
child.stdout.on("data", data => { stdout += data.toString(); });
child.stderr.on("data", data => { stderr += data.toString(); });
const code = await new Promise<number>((done, reject) => { child.on("error", reject); child.on("close", code => done(code ?? 1)); });
const scrub = (value: string) => value.split(token).join("[REDACTED]");
writeFileSync(resolve(out, "codex-connection.jsonl"), scrub(stdout));
if (stderr) writeFileSync(resolve(out, "codex-connection.stderr.txt"), scrub(stderr));
const events = stdout.trim().split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line));
const calls = events.filter(event => event.item?.type === "mcp_tool_call" && event.item.status === "completed").map(event => event.item);
const errors = events.filter(event => event.type === "error" || event.type === "turn.failed");
const allowed = new Set(["list_services", "get_budget", "get_request_status", "end_demo_session"]);
const passed = code === 0 && !errors.length && calls.every(item => allowed.has(item.tool) && !item.error) && ["list_services", "get_budget"].every(tool => calls.some(item => item.tool === tool));
writeFileSync(resolve(out, "codex-connection-check.json"), JSON.stringify({ checked_at: new Date().toISOString(), network: "mainnet", rendered_recipe_origin: renderedUrl, checked_endpoint: "https://sisih-azure.vercel.app/api/mcp", client: "installed Codex CLI", source: "rendered PowerShell snippet, same CLI flags; endpoint normalized to hosted Mainnet and tools restricted to reads/session end", private_owner_credentials_forwarded: false, purchase_tools_available: false, exit_code: code, tools_called: calls.map(item => item.tool), passed }, null, 2) + "\n");
console.log(`Rendered Codex recipe: ${passed ? "PASS" : "FAIL"}; exit ${code}; completed tools: ${calls.map(item => item.tool).join(", ")}. Sanitized transcript saved.`);
process.exit(passed ? 0 : 1);
