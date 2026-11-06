/**
 * Read-only MCP connection check with the official SDK client: connect, list tools, read the
 * budget and services, and confirm that a request without the agent credential is refused.
 * Buys nothing.
 *   MCP_URL=https://sisih-azure.vercel.app/api/mcp pnpm mcp:check
 * The credential comes from SISIH_AGENT_TOKEN (root .env or the environment); it is never printed.
 */
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { env } from "../src/lib/env";

const url = new URL(process.env.MCP_URL ?? "http://127.0.0.1:3000/api/mcp");
const token = env("SISIH_AGENT_TOKEN");
if (!token) throw new Error("Set SISIH_AGENT_TOKEN (the agent credential) first.");

const anon = await fetch(url, { method: "POST", headers: { "content-type": "application/json", accept: "application/json, text/event-stream" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }) });
console.log(`without the agent credential: HTTP ${anon.status}`);

const client = new Client({ name: "sisih-mcp-check", version: "1.0.0" });
await client.connect(new StreamableHTTPClientTransport(url, { requestInit: { headers: { authorization: `Bearer ${token}` } } }));
const server = client.getServerVersion();
console.log(`connected to ${url.origin}${url.pathname}: ${server?.name} ${server?.version}`);
const tools = (await client.listTools()).tools;
console.log(`tools: ${tools.map((t) => t.name).join(", ")}`);
const text = async (name: string) => JSON.parse(((await client.callTool({ name, arguments: {} })) as { content: { text: string }[] }).content[0]!.text);
const budget = await text("get_budget");
console.log(`budget: total ${budget.vault.total_usdc}, committed ${budget.vault.committed_usdc}, free ${budget.vault.free_usdc}; permission ${budget.agent_permission.status}; session ${budget.session}`);
const services = await text("list_services");
console.log(`services: ${services.services.map((s: { name: string; price_usdc: string }) => `${s.name} ${s.price_usdc}`).join(", ")}`);
await client.close();
console.log(anon.status === 401 && tools.length === 5 ? "PASS: read-only connection check" : "FAIL");
