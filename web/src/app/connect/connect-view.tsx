"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Code, Section, ShellTabs } from "@/components/site";
import { connectionState } from "@/lib/connection-state";

type Live = { status: "loading" } | ({ status: "ok" } & ReturnType<typeof connectionState>) | { status: "unavailable" };
const checkPrompt = "Use the sisih MCP server to show the current Mainnet vault balance, protected commitments and permission state. List available services. Do not buy anything or change configuration.";
const resultPrompt = "Use Sisih get_request_status for req-7dd90263-75e. Explain the delivered live report, the recalled rule source and both Mainnet transaction receipts. Then inspect req-f37bacb5-c6a and explain the reserve refusal. These are recorded requests: do not create a purchase.";

export function ConnectView() {
  const [origin, setOrigin] = useState("https://sisih-azure.vercel.app");
  const [live, setLive] = useState<Live>({ status: "loading" });
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    setOrigin(window.location.origin);
    const ctl = new AbortController(); let active = true;
    const timer = setTimeout(() => ctl.abort(), 12000);
    fetch("/api/state", { signal: ctl.signal }).then(r => r.ok ? r.json() : Promise.reject(new Error(String(r.status))))
      .then(value => { if (active) setLive({ status: "ok", ...connectionState(value) }); })
      .catch(() => { if (active) setLive({ status: "unavailable" }); }).finally(() => clearTimeout(timer));
    return () => { active = false; clearTimeout(timer); ctl.abort(); };
  }, [refresh]);
  const mcp = `${origin}/api/mcp`;
  const agentJson = `{ "mcpServers": { "sisih": { "type": "http", "url": "${mcp}",
  "headers": { "Authorization": "Bearer \${SISIH_AGENT_TOKEN}" } } } }`;
  const envPs = `New-Item -ItemType Directory -Force sisih-agent | Out-Null
Set-Location sisih-agent
Remove-Item Env:SISIH_OWNER_TOKEN, Env:SISIH_OWNER_MCP_TOKEN, Env:DEMO_TOKEN, Env:OWNER_PRIVATE_KEY, Env:AGENT_PRIVATE_KEY -ErrorAction SilentlyContinue
# Secure prompt: keeps bearer credential out of PSReadLine console history
$env:SISIH_AGENT_TOKEN = [System.Net.NetworkCredential]::new("", (Read-Host "Enter SISIH_AGENT_TOKEN" -AsSecureString)).Password`;
  const envSh = `mkdir -p sisih-agent && cd sisih-agent
unset SISIH_OWNER_TOKEN SISIH_OWNER_MCP_TOKEN DEMO_TOKEN OWNER_PRIVATE_KEY AGENT_PRIVATE_KEY
# Secure prompt: keeps bearer credential out of shell history
read -s -p "Enter SISIH_AGENT_TOKEN: " SISIH_AGENT_TOKEN && export SISIH_AGENT_TOKEN && echo`;
  const options = ["exec", "--ignore-user-config", "--ignore-rules", "--skip-git-repo-check", "--ephemeral", "--sandbox", "read-only", "--disable", "shell_tool", "--disable", "unified_exec", "--disable", "apps", "--disable", "plugins", "--disable", "hooks", "--disable", "browser_use", "--disable", "computer_use", "--disable", "view_image", "-c", "approval_policy=never", "-c", "web_search=disabled", "-c", `mcp_servers.sisih.url=${mcp}`, "-c", "mcp_servers.sisih.bearer_token_env_var=SISIH_AGENT_TOKEN", "-c", "mcp_servers.sisih.default_tools_approval_mode=auto"];
  const codexPs = [`$options = @(${options.map(value => `'${value}'`).join(", ")})`, `codex @options "${checkPrompt}"`].join("\n");
  const codexSh = `codex ${options.map(value => `'${value}'`).join(" ")} "${checkPrompt}"`;
  const ownerJson = `{ "mcpServers": { "sisih": { "type": "http", "url": "${mcp}",
  "headers": { "Authorization": "Bearer \${SISIH_OWNER_TOKEN}" } } } }`;

  return <div className="page">
    <header className="page-head"><p className="eyebrow">Connect · Sui Mainnet</p><h1>One MCP. Separate agent and owner authority.</h1><p className="lead">Connect your agent to the Mainnet vault behind the verified proof. Read current balances, inspect the purchased reports, and trace the remembered approval to Walrus Memory.</p></header>
    <div className="status-row"><span className="tag tag-ok">Mainnet</span><span>Native USDC on Sui Mainnet · Walrus Memory Mainnet · all Sui reads through Tatum.</span></div>
    <p className="callout">The approved run is complete. Agent permission is revoked and the 1.60-USDC purchase allocation is consumed. This public connection is read-only and holds no wallet signing keys. A new purchase requires a new owner-approved plan.</p>
    <Section id="quickstart" title="Start with a connection check">
      <h3>1. Get the Mainnet agent credential privately</h3><p>Use the credential supplied by the owner or in private judge instructions. Bearer tokens are authentication credentials, not wallet private keys. The spending and owner roles use separate tokens. Keep owner tokens, wallet keys and provider keys out of the agent&apos;s environment.</p>
      <h3>2. Configure your MCP client</h3><p>Streamable HTTP with bearer authentication. Use your client&apos;s supported configuration format; the Codex recipe below was checked against the hosted endpoint. In this completed proof deployment, the agent receives read-only query capabilities.</p><Code label="agent MCP configuration">{agentJson}</Code>
      <ShellTabs label="spending agent environment" powershell={envPs} bash={envSh} />
      <h3>3. Read the Mainnet state</h3><Code label="connection check prompt">{checkPrompt}</Code>
      <details className="disclosure" id="codex-setup"><summary>Codex CLI setup · client used in the Mainnet proof</summary><p>The recorded task used Codex CLI 0.164.0-alpha.11.1. This recipe ignores user configuration and disables shell access in the isolated folder above.</p><ShellTabs label="Codex connection check" powershell={codexPs} bash={codexSh} /></details>
      <p className="fine">Other Streamable HTTP clients can use the connection contract above. Antigravity and a model owner-assistant session have not been verified.</p>
    </Section>
    <Section id="endpoint" title="The connected Mainnet vault">
      <dl className="facts"><div><dt>Mainnet MCP URL</dt><dd><code>{mcp}</code></dd></div><div><dt>Vault</dt><dd><a href="https://suiscan.xyz/mainnet/object/0x24649e0f48c627733cc526faf39b642efd103b75d3651128bc7e56aaa93e32fc">Inspect the Mainnet vault</a></dd></div><div><dt>Authentication</dt><dd>Bearer credential. A role never comes from a client name or a tool argument.</dd></div></dl>
      <div className="live-box" aria-live="polite"><strong>Mainnet status</strong>{live.status === "loading" && <span> · Reading the vault through Tatum…</span>}{live.status === "unavailable" && <span> · A Mainnet observation is unavailable. The recorded proof remains readable. <button type="button" className="copy-btn" onClick={() => { setLive({ status: "loading" }); setRefresh(n => n + 1); }}>Retry status</button></span>}{live.status === "ok" && <span> · Sui Mainnet. Free balance: <strong>{formatUsdc(live.free)} USDC</strong>.{live.readAt && <> Observed {live.readAt}.</>} Free funds remain owner-controlled; revoked agent permission prevents spending.</span>}</div>
    </Section>
    <Section id="recorded-requests" title="Ask your agent to inspect the actual result">
      <p>This prompt retrieves the completed second purchase and the later refusal. Status reads never create or repeat a payment.</p><Code label="recorded result prompt">{resultPrompt}</Code><p><Link href="/proof#mainnet-trace">Follow the full Mainnet proof →</Link></p>
    </Section>
    <Section id="owner" title="Owner authority stays separate">
      <p>The owner signed approval, session transition and final revocation locally. The original wallet key never reached the server. The published connection exposes evidence and status; configuration changes, new approvals and signed actions are closed.</p>
      <details className="disclosure"><summary>Owner-assistant connection · read-only mode</summary><Code label="owner MCP configuration">{ownerJson}</Code><p>OWNER CONNECTION — READ-ONLY MODE. Authenticating with the owner credential discovers only read-only inspection tools: <code>owner_status</code>, <code>list_requests</code>, <code>get_request</code>, <code>list_suggestions</code>, <code>get_evidence</code>, and <code>get_owner_intent</code>. The public deployment does not accept new purchase approvals, commitments, configuration changes, permission updates, wallet signing requests, or spending operations. Owner authentication does not bypass read-only restrictions.</p></details>
    </Section>
    <details className="disclosure" id="contract"><summary>Protocol and available tool behavior</summary><p>Streamable HTTP via POST, stateless JSON responses. In this completed Mainnet proof deployment, both roles operate strictly read-only:</p><ul><li><strong>Agent role:</strong> Advertises only <code>get_budget</code>, <code>list_services</code>, and <code>get_request_status</code>. Mutation tools (<code>request_purchase</code>, <code>end_demo_session</code>) are omitted from <code>tools/list</code> and cannot be invoked.</li><li><strong>Owner role:</strong> Advertises only <code>owner_status</code>, <code>list_requests</code>, <code>get_request</code>, <code>list_suggestions</code>, <code>get_evidence</code>, and <code>get_owner_intent</code>. Mutation, configuration, and demo-control tools are omitted from <code>tools/list</code>.</li></ul><p>Direct unadvertised calls fail closed before any processing. No wallet signing keys exist in this deployment.</p></details>
  </div>;
}
function formatUsdc(base: string) { const n = BigInt(base); return `${n / 1000000n}.${(n % 1000000n).toString().padStart(6, "0").slice(0, 2)}`; }
