"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Code, Section, ShellTabs } from "@/components/site";

const AGENT_TOOLS = ["get_budget", "list_services", "request_purchase", "get_request_status", "end_demo_session"];
const OWNER_TOOLS = [
  "owner_status",
  "list_requests",
  "get_request",
  "list_suggestions",
  "get_evidence",
  "decide_request",
  "add_preference",
  "set_preference_enabled",
  "set_threshold",
  "decide_suggestion",
  "set_reserve",
  "add_commitment",
  "set_limits",
  "set_agent_permission",
  "start_next_session",
  "get_owner_intent",
  "release_demo_run",
];

type Live = { status: "loading" } | { status: "ok"; network: string; free: string; namespace: string; session: number } | { status: "unavailable" };

function usd(base: string) {
  const n = BigInt(base);
  return `${n / 1_000_000n}.${(n % 1_000_000n).toString().padStart(6, "0").slice(0, 2)}`;
}

export function ConnectView() {
  const [origin, setOrigin] = useState("https://sisih-azure.vercel.app");
  const [live, setLive] = useState<Live>({ status: "loading" });
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    setOrigin(window.location.origin);
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 8000);
    fetch("/api/state", { signal: ctl.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((s) => setLive({ status: "ok", network: s.network, free: s.vault?.free ?? "0", namespace: s.memory?.namespace ?? "?", session: s.session }))
      .catch(() => setLive({ status: "unavailable" }))
      .finally(() => clearTimeout(t));
    return () => ctl.abort();
  }, [refresh]);

  const mcp = `${origin}/api/mcp`;
  const skill = `${origin}/skills/sisih/SKILL.md`;
  const agentJson = `{ "mcpServers": { "sisih": { "type": "http", "url": "${mcp}",
  "headers": { "Authorization": "Bearer \${SISIH_AGENT_TOKEN}" } } } }`;
  const ownerJson = `{ "mcpServers": { "sisih": { "type": "http", "url": "${mcp}",
  "headers": { "Authorization": "Bearer \${SISIH_OWNER_TOKEN}" } } } }`;
  const agentAllow = [...AGENT_TOOLS.map((t) => `mcp__sisih__${t}`), "Skill", "ToolSearch"];

  const agentSetupPs = `New-Item -ItemType Directory -Force sisih-agent | Out-Null; Set-Location sisih-agent
New-Item -ItemType Directory -Force .claude/skills/sisih | Out-Null
Invoke-WebRequest ${skill} -OutFile .claude/skills/sisih/SKILL.md
$mcp = @'
${agentJson}
'@
[IO.File]::WriteAllText("$PWD\\.mcp.json", $mcp)   # UTF-8 without BOM
Remove-Item Env:SISIH_OWNER_TOKEN, Env:DEMO_TOKEN -ErrorAction SilentlyContinue
$env:SISIH_AGENT_TOKEN = "<agent credential>"`;
  const agentSetupSh = `mkdir -p sisih-agent/.claude/skills/sisih && cd sisih-agent
curl -fsSL ${skill} -o .claude/skills/sisih/SKILL.md
cat > .mcp.json <<'EOF'
${agentJson}
EOF
unset SISIH_OWNER_TOKEN DEMO_TOKEN
export SISIH_AGENT_TOKEN="<agent credential>"`;
  const agentRunPs = `$sisih = @('--setting-sources','project','--mcp-config','.mcp.json','--strict-mcp-config',
  '--tools','Skill,ToolSearch','--permission-mode','dontAsk','--allowedTools',
  ${agentAllow.map((t) => `'${t}'`).join(",")})
claude -p "<prompt>" @sisih`;
  const agentRunSh = `claude -p "<prompt>" --setting-sources project --mcp-config .mcp.json --strict-mcp-config \\
  --tools "Skill,ToolSearch" --permission-mode dontAsk \\
  --allowedTools ${agentAllow.join(" ")}`;

  const ownerSetupPs = `New-Item -ItemType Directory -Force sisih-owner | Out-Null; Set-Location sisih-owner
$mcp = @'
${ownerJson}
'@
[IO.File]::WriteAllText("$PWD\\.mcp.json", $mcp)
Remove-Item Env:SISIH_AGENT_TOKEN -ErrorAction SilentlyContinue
$env:SISIH_OWNER_TOKEN = "<owner token>"
claude --setting-sources project --mcp-config .mcp.json --strict-mcp-config --allowedTools mcp__sisih`;
  const ownerSetupSh = `mkdir -p sisih-owner && cd sisih-owner
cat > .mcp.json <<'EOF'
${ownerJson}
EOF
unset SISIH_AGENT_TOKEN
export SISIH_OWNER_TOKEN="<owner token>"
claude --setting-sources project --mcp-config .mcp.json --strict-mcp-config --allowedTools mcp__sisih`;
  const cliPs = `# in your clone of the Sisih repository, after pnpm install
$env:SISIH_URL = "${origin}"
$env:SISIH_OWNER_TOKEN = "<owner token>"
pnpm sisih status
pnpm sisih credential agent        # shows the agent credential privately (Testnet demo)
pnpm sisih requests --held
pnpm sisih approve <request-id> --remember
pnpm sisih evidence
pnpm sisih release`;
  const cliSh = `# in your clone of the Sisih repository, after pnpm install
export SISIH_URL="${origin}"
export SISIH_OWNER_TOKEN="<owner token>"
pnpm sisih status
pnpm sisih credential agent        # shows the agent credential privately (Testnet demo)
pnpm sisih requests --held
pnpm sisih approve <request-id> --remember
pnpm sisih evidence
pnpm sisih release`;

  const checkPrompt = "Use the sisih MCP server to show me my budget, my limits and the services I can buy. Do not buy anything.";
  const taskPrompt =
    "Check whether my Sisih vault is healthy. Use the sisih MCP server to buy the ChainScope live vault report with a new idempotency_key you make up for this one purchase, then tell me committed versus free funds, whether any commitment is underfunded and the largest payment you could make now. Quote the checkpoint and time, list the receipts and memory evidence, and end the demo session. If Sisih holds the purchase for me, tell me and wait.";
  const continuePrompt = "I decided. Check the same request with get_request_status and finish the task. Do not request it again.";

  return (
    <div className="page">
      <header className="page-head">
        <p className="eyebrow">Connect</p>
        <h1>Connect your agent</h1>
        <p className="lead">
          Sisih is one remote MCP server. Your spending agent connects with a restricted credential. If you want an assistant to act for you, it connects to the same URL
          with your owner credential, in a separate session. The credential decides what each one can do.
        </p>
      </header>

      <Section id="contract" title="The connection contract">
        <dl className="facts">
          <div>
            <dt>MCP URL</dt>
            <dd>
              <code>{mcp}</code>
            </dd>
          </div>
          <div>
            <dt>Transport</dt>
            <dd>Streamable HTTP, POST only, stateless, JSON responses (no session id, no event stream).</dd>
          </div>
          <div>
            <dt>Authentication</dt>
            <dd>
              <code>Authorization: Bearer &lt;credential&gt;</code>. The role comes only from the credential; client names, headers and tool arguments cannot raise it.
            </dd>
          </div>
          <div>
            <dt>Spending agent tools</dt>
            <dd>{AGENT_TOOLS.map((t) => <code key={t}>{t}</code>)}</dd>
          </div>
          <div>
            <dt>Owner tools</dt>
            <dd>
              {OWNER_TOOLS.map((t) => <code key={t}>{t}</code>)}
              <span className="muted"> Plus Testnet-only demo tooling: demo_reset, demo_advance_cycle.</span>
            </dd>
          </div>
        </dl>
        <div className="status-row">
          <span className="tag tag-ok">Verified agent run</span>
          <span>
            The spending-agent CLI example below is the one used in the recorded run. Other MCP clients that
            support Streamable HTTP with custom headers are compatible candidates; they have not been checked.
          </span>
        </div>
        <div className="live-box" aria-live="polite">
          <strong>Current server state (optional)</strong>
          {live.status === "loading" && <span> Reading…</span>}
          {live.status === "unavailable" && <span> The demo API is not reachable right now. You can still use these instructions. <button type="button" className="copy-btn" onClick={() => { setLive({ status: "loading" }); setRefresh((n) => n + 1); }}>Retry status</button></span>}
          {live.status === "ok" && (
            <span>
              {" "}
              {live.network === "mainnet" ? "Sui Mainnet" : "Sui Testnet"} · namespace <code>{live.namespace}</code> · session {live.session} · free for the agent{" "}
              <strong>{usd(live.free)} USDC</strong>. Shared funds are small: a purchase above the free amount is refused.
            </span>
          )}
        </div>
      </Section>

      <Section id="credentials" title="Credentials">
        <ul className="bullets">
          <li>
            <strong>Owner token</strong>: delivered privately (judges receive it with the submission). It authorizes owner actions; never give it to the spending agent.
          </li>
          <li>
            <strong>Agent credential</strong>: the owner retrieves it privately with <code>pnpm sisih credential agent</code> (Testnet demo). It can read the budget,
            request purchases and read its own requests. It cannot approve, configure, reset or sign anything.
          </li>
          <li>A separate terminal window is not isolation. Keep the owner token out of the agent&apos;s folder, environment and prompts.</li>
        </ul>
      </Section>

      <Section id="agent" eyebrow="Recipe 1" title="Your spending agent">
        <p>Configure your agent&apos;s MCP client with the server URL and agent credential. Configuration syntax and environment variable support depend on your client.</p>
        <Code label="agent MCP configuration">{agentJson}</Code>
        <h3>Verified Testnet CLI example: Claude Code</h3>
        <p>In a new, empty folder that holds nothing but the agent&apos;s setup:</p>
        <ShellTabs label="spending agent setup" powershell={agentSetupPs} bash={agentSetupSh} />
        <p>
          Run your agent with only the Sisih agent tools. In this CLI example, <code>--tools &quot;Skill,ToolSearch&quot;</code> removes the built-in file and shell tools;{" "}
          <code>--allowedTools</code> alone does not.
        </p>
        <ShellTabs label="spending agent run" powershell={agentRunPs} bash={agentRunSh} />
        <h3>Verified Mainnet client: Codex CLI</h3>
        <p>Codex CLI 0.164.0-alpha.11.1 completed the recorded local Mainnet task using the same five spending tools and no owner credential. It ran with shell tools disabled, ignored user configuration, a read-only sandbox, and an MCP bearer-token environment variable. The exact isolated runner is <code>server/scripts/mainnet/run-agent.ts --client codex</code>; use the Mainnet runbook for its reviewed configuration. The hosted endpoint on this page remains Testnet. Antigravity has not been verified as an MCP client.</p>
        <h3>Prompts</h3>
        <p>1. A harmless connection check (buys nothing):</p>
        <Code label="connection check prompt">{checkPrompt}</Code>
        <p>2. A useful purchase. An idempotency key identifies one intended purchase: keep it when retrying that purchase, use a new one for a new purchase.</p>
        <Code label="task prompt">{taskPrompt}</Code>
        <p>
          Whether it is held depends on the shared state: if a ChainScope preference already exists, it settles at once. A service without a preference (for example
          SearchBox) is held for the owner. A purchase above the free funds is refused.
        </p>
        <p>3. When the owner has decided, continue the same request (resume with <code>--resume &lt;session-id&gt;</code> or start a new one):</p>
        <Code label="continuation prompt">{continuePrompt}</Code>
        <p>
          The agent reports the receipts (release and settlement links) and the Walrus memory evidence, and ends with <code>end_demo_session</code>, which hands the
          shared demo back.
        </p>
      </Section>

      <Section id="owner" eyebrow="Recipe 2" title="Owner assistant (same URL, owner credential)">
        <p className="callout">
          New in this build: the owner tools are checked with a real MCP SDK client in isolated tests. An owner-assistant session has not yet been recorded.
          Treat this recipe as a candidate.
        </p>
        <p>
          A separate folder and session, with the owner token and never the agent credential. The assistant can list held requests, decide them (optionally
          remembered), set limits, reserves and preferences, and pause, resume or revoke the agent.
        </p>
        <ShellTabs label="owner assistant setup" powershell={ownerSetupPs} bash={ownerSetupSh} />
        <h3>Signing</h3>
        <ul className="bullets">
          <li>
            <strong>Sui Testnet demo</strong> (this deployment): owner transactions are signed on the server by &quot;Demo owner (server-signed, testnet)&quot;, not
            by your own wallet. Every response says so.
          </li>
          <li>
            <strong>Sui Mainnet</strong> (local proof executed; public server not deployed): an owner token alone changes nothing. Each owner action returns an intent; the owner signs it on
            their own machine with <code>pnpm sisih sign &lt;intent-id&gt; --yes</code>, which checks the intent against the local configuration and builds the
            transaction itself. The owner key never reaches the server.
          </li>
        </ul>
      </Section>

      <Section id="cli" eyebrow="Alternative" title="Owner CLI">
        <p>The same owner actions from your terminal, on the same domain as the owner tools. Help, version and invalid arguments never send anything.</p>
        <ShellTabs label="owner CLI" powershell={cliPs} bash={cliSh} />
      </Section>

      <Section id="shared" title="The shared demo">
        <ul className="bullets">
          <li>One shared Testnet workspace, one run at a time. Others get a clear busy answer; end with end_demo_session or pnpm sisih release.</li>
          <li>The owner can always decide, pause and configure while the agent runs.</li>
          <li>
            Please do not reset the shared state unless you need a clean run; a reset starts a new memory namespace. The recorded run stays on the{" "}
            <Link href="/proof">Proof</Link> page and in the repository.
          </li>
        </ul>
      </Section>
    </div>
  );
}
