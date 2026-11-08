/** Real external Claude Code/Codex client, isolated to spending MCP authority. */
import { spawn } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { env, REPO_ROOT, suiNetwork } from "../../src/lib/env";

const args = process.argv.slice(2);
const option = (name: string) => args.includes(name) ? args[args.indexOf(name) + 1] : undefined;
if (args.includes("--help")) {
  console.log("run-agent.ts [--client codex] --prompt <file> --out <file> --execute --acknowledge sisih-mainnet-proof-20261107-v1. Real model client; may request approved purchases through MCP. Codex needs SISIH_CODEX_EXE.");
  process.exit(0);
}
if (suiNetwork() !== "mainnet" || !args.includes("--execute") || option("--acknowledge") !== "sisih-mainnet-proof-20261107-v1") throw new Error("Explicit Mainnet proof acknowledgement required");
if (!option("--prompt") || !option("--out")) throw new Error("--prompt and --out required");
const token = env("SISIH_AGENT_TOKEN");
if (!token) throw new Error("Spending credential missing");
const cwd = resolve(REPO_ROOT, ".sisih-mainnet/external-agent");
mkdirSync(cwd, { recursive: true });
writeFileSync(resolve(cwd, ".mcp.json"), JSON.stringify({ mcpServers: { sisih: { type: "http", url: "http://127.0.0.1:8788/api/mcp", headers: { Authorization: "Bearer ${SISIH_AGENT_TOKEN}" } } } }));
const childEnv: NodeJS.ProcessEnv = {};
for (const name of ["PATH", "Path", "SYSTEMROOT", "SystemRoot", "WINDIR", "COMSPEC", "USERPROFILE", "HOME", "APPDATA", "LOCALAPPDATA", "TEMP", "TMP", "PATHEXT"]) if (process.env[name]) childEnv[name] = process.env[name];
childEnv.SISIH_AGENT_TOKEN = token;
const codex = option("--client") === "codex";
const executable = codex ? process.env.SISIH_CODEX_EXE! : resolve(process.env.APPDATA!, "npm/node_modules/@anthropic-ai/claude-code/bin/claude.exe");
if (!executable) throw new Error("SISIH_CODEX_EXE must identify the installed Codex executable");
const tools = ["get_budget", "list_services", "request_purchase", "get_request_status", "end_demo_session"].map(name => `mcp__sisih__${name}`);
const prompt = readFileSync(resolve(REPO_ROOT, option("--prompt")!), "utf8");
const clientArgs = codex ? ["exec", "--ignore-user-config", "--ignore-rules", "--skip-git-repo-check", "--ephemeral", "--sandbox", "read-only", "--json", "-c", 'approval_policy="never"', "-c", 'web_search="disabled"', "-c", 'features.shell_tool=false', "-c", 'features.unified_exec=false', "-c", 'features.apps=false', "-c", 'features.plugins=false', "-c", 'features.hooks=false', "-c", 'features.browser_use=false', "-c", 'features.computer_use=false', "-c", 'features.view_image=false', "-c", 'features.skill_search=false', "-c", 'features.skip_host_skill_discovery=true', "-c", 'mcp_servers.sisih.url="http://127.0.0.1:8788/api/mcp"', "-c", 'mcp_servers.sisih.bearer_token_env_var="SISIH_AGENT_TOKEN"', "-c", 'mcp_servers.sisih.enabled_tools=["get_budget","list_services","request_purchase","get_request_status","end_demo_session"]', "-c", 'mcp_servers.sisih.default_tools_approval_mode="auto"', "-"] : ["-p", "--setting-sources", "project", "--mcp-config", ".mcp.json", "--strict-mcp-config", "--tools", "ToolSearch", "--permission-mode", "dontAsk", "--allowedTools", ...tools, "ToolSearch", "--output-format", "stream-json", "--verbose"];
const child = spawn(executable, clientArgs, { cwd, env: childEnv, stdio: ["pipe", "pipe", "pipe"], windowsHide: true });
child.stdin.end(prompt);
let stdout = "", stderr = "";
child.stdout.on("data", chunk => { stdout += chunk.toString(); });
child.stderr.on("data", chunk => { stderr += chunk.toString(); });
const code = await new Promise<number>((resolveCode, reject) => { child.on("error", reject); child.on("close", value => resolveCode(value ?? 1)); });
const scrub = (text: string) => text.split(token).join("[REDACTED]");
const out = resolve(REPO_ROOT, option("--out")!);
mkdirSync(resolve(out, ".."), { recursive: true });
writeFileSync(out, scrub(stdout));
if (stderr) writeFileSync(`${out}.stderr.txt`, scrub(stderr));
for (const line of stdout.split(/\r?\n/).filter(Boolean)) {
  try {
    const event = JSON.parse(line);
    if (event.type === "result" || event.type === "error" || event.type === "turn.failed" || event.item?.type === "agent_message") console.log(scrub(JSON.stringify(event)));
  } catch { /* raw output remains in the transcript */ }
}
console.log(`External client exit ${code}; sanitized transcript ${option("--out")}`);
process.exit(code);
