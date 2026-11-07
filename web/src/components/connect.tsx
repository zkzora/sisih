"use client";
/**
 * "Connect your agent": the terminal-first setup. The agent (Claude Code) connects over MCP with
 * its own credential; the owner runs the Sisih CLI with a separate owner token. Everything here is
 * readable without unlocking; only revealing the agent credential needs the owner's demo token
 * (POST /api/demo/agent-credential, owner-only).
 */
import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, Eye, EyeOff, KeyRound } from "lucide-react";
import { api, ApiFailure } from "@/lib/live";
import { useSisih } from "./context";
import { Badge, Button, CopyButton, PageHeading, Panel } from "./ui";

function Code({ children, label }: { children: string; label: string }) {
  return (
    <div className="connect-code">
      <pre>
        <code>{children}</code>
      </pre>
      <CopyButton value={children} label={`Copy ${label}`} />
    </div>
  );
}

function Shells({ bash, powershell, label }: { bash: string; powershell: string; label: string }) {
  return (
    <div className="connect-shells">
      <span className="muted">Bash / zsh</span>
      <Code label={`${label} (bash)`}>{bash}</Code>
      <span className="muted">PowerShell</span>
      <Code label={`${label} (PowerShell)`}>{powershell}</Code>
    </div>
  );
}

const CHECK_PROMPT = "Use the sisih MCP server to show me my budget, my limits and the services I can buy. Do not buy anything.";
const TASK_PROMPT =
  "Check whether my Sisih vault is healthy. Use the sisih MCP server to buy the ChainScope live vault report, then tell me how much is committed versus free, whether any commitment is underfunded, and the largest payment you could make right now. Quote the checkpoint and time, list the receipts, and end the demo session. If Sisih holds the purchase for my approval, give me the terminal command and wait.";

const CLAUDE_FLAGS_BASH = `claude --setting-sources project --mcp-config .mcp.json --strict-mcp-config \\
  --tools Skill,ToolSearch --permission-mode dontAsk \\
  --allowedTools mcp__sisih__get_budget,mcp__sisih__list_services,mcp__sisih__request_purchase,mcp__sisih__get_request_status,mcp__sisih__end_demo_session,Skill,ToolSearch`;

const CLAUDE_FLAGS_PWSH = `$sisih = @('--setting-sources','project','--mcp-config','.mcp.json','--strict-mcp-config',
  '--tools','Skill,ToolSearch','--permission-mode','dontAsk','--allowedTools',
  'mcp__sisih__get_budget','mcp__sisih__list_services','mcp__sisih__request_purchase',
  'mcp__sisih__get_request_status','mcp__sisih__end_demo_session','Skill','ToolSearch')`;

export function ConnectView() {
  const { unlocked } = useSisih();
  const [origin, setOrigin] = useState("https://sisih-azure.vercel.app");
  const [cred, setCred] = useState<{ token: string | null } | null>(null);
  const [shown, setShown] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => setOrigin(window.location.origin), []);
  const endpoint = `${origin}/api/mcp`;
  const skill = `${origin}/skills/sisih/SKILL.md`;

  const reveal = async () => {
    setError(null);
    try {
      const r = await api<{ token: string | null }>("/api/demo/agent-credential", { method: "POST" });
      if (!r.token) setError("This deployment has no agent credential configured.");
      setCred(r);
      setShown(true);
    } catch (err) {
      setError(err instanceof ApiFailure ? err.message : "Could not load the agent credential.");
    }
  };

  const mcpJson = JSON.stringify({ mcpServers: { sisih: { type: "http", url: endpoint, headers: { Authorization: "Bearer ${SISIH_AGENT_TOKEN}" } } } }, null, 2);

  return (
    <>
      <PageHeading
        eyebrow="Connect your agent"
        title="Your agent buys. You stay in charge from the terminal."
        description="Claude Code calls Sisih over MCP to buy services for its task. You set its limits and decide new purchases with the Sisih CLI. The dashboard is optional."
        action={
          <Link className="button button-secondary" href="/tour">
            Explore a recorded run
          </Link>
        }
      />
      <ol className="connect-flow" aria-label="How it works">
        <li>
          <strong>Your agent</strong> (Claude Code) gets a task, picks a service and asks Sisih to buy it using a fresh idempotency key.
        </li>
        <li>
          <strong>Sisih</strong> pays at once if it fits your limits and remembered preferences, holds it if unfamiliar, and refuses anything that touches committed funds.
        </li>
        <li>
          <strong>You</strong> answer held requests from your owner terminal: <code>pnpm sisih approve &lt;id&gt; --remember</code>. The agent checks status using the same request ID and continues without paying twice.
        </li>
      </ol>
      <p className="detail-note connect-networks">Vault and x402 payments on Sui Testnet (testnet USDC, through Tatum). Memory on Walrus Mainnet. Demo merchants.</p>

      <div className="connect-grid">
        <Panel title="Agent: Claude Code" action={<Badge>agent credential</Badge>}>
          <div className="connect-body">
            <p>
              MCP endpoint (Streamable HTTP): <code>{endpoint}</code>
            </p>
            <p>
              <strong>1.</strong> In a new, empty folder, create <code>.mcp.json</code>. Claude Code reads the credential from an environment variable:
            </p>
            <Code label=".mcp.json">{mcpJson}</Code>
            <p>
              <strong>2.</strong> Add the Sisih skill (how to buy, handle holds, and report receipts):
            </p>
            <Shells
              label="skill download"
              bash={`mkdir -p .claude/skills/sisih && curl -fsSL ${skill} -o .claude/skills/sisih/SKILL.md`}
              powershell={`New-Item -ItemType Directory -Force .claude/skills/sisih | Out-Null; Invoke-WebRequest ${skill} -OutFile .claude/skills/sisih/SKILL.md`}
            />
            <p>
              <strong>3.</strong> Keep owner credentials out of the agent process. Unset owner tokens and export only the restricted agent credential:
            </p>
            <Shells
              label="agent credential"
              bash={`unset SISIH_OWNER_TOKEN DEMO_TOKEN\nexport SISIH_AGENT_TOKEN="<agent credential>"`}
              powershell={`Remove-Item Env:SISIH_OWNER_TOKEN, Env:DEMO_TOKEN -ErrorAction SilentlyContinue\n$env:SISIH_AGENT_TOKEN = "<agent credential>"`}
            />
            <p>
              <strong>4.</strong> Connection check (tested <code>-p</code> read-only check with restricted flags):
            </p>
            <Shells
              label="connection check"
              bash={`${CLAUDE_FLAGS_BASH} \\\n  -p "${CHECK_PROMPT}"`}
              powershell={`${CLAUDE_FLAGS_PWSH}\nclaude -p "${CHECK_PROMPT}" @sisih`}
            />
            <p className="detail-note">
              <code>--tools</code> strips built-in filesystem and shell tools; <code>--allowedTools</code> allows only the Sisih MCP tools, Skill and ToolSearch.
            </p>
            <p>
              <strong>5.</strong> A task with live data (ChainScope reads live Sui Testnet vault state):
            </p>
            <Shells
              label="task command"
              bash={`${CLAUDE_FLAGS_BASH} \\\n  -p "${TASK_PROMPT}"`}
              powershell={`${CLAUDE_FLAGS_PWSH}\nclaude -p "${TASK_PROMPT}" @sisih`}
            />
            <p className="detail-note">
              <strong>Starting conditions:</strong> If the shared demo already remembers ChainScope, this request may be auto-approved immediately. A fresh first-approval learning demonstration starts from an owner reset (<code>pnpm sisih demo reset --yes</code>). Retries reuse the same idempotency key; new purchases require a unique key.
            </p>
            <p>
              <strong>6.</strong> When finished, end the session or release the lease:
            </p>
            <p className="detail-note">
              The agent calls <code>end_demo_session</code> upon completion, or the owner runs <code>pnpm sisih release</code> in their terminal to free the shared lease.
            </p>
          </div>
        </Panel>

        <Panel title="Owner: your terminal" action={<Badge tone="warning">owner token</Badge>}>
          <div className="connect-body">
            <p>
              <strong>1.</strong> In your copy of the Sisih repository: <code>pnpm install</code>. Set the owner token in a separate terminal, never in the
              agent&apos;s:
            </p>
            <Shells
              label="owner setup"
              bash={`export SISIH_URL="${origin}"\nexport SISIH_OWNER_TOKEN="<owner token>"`}
              powershell={`$env:SISIH_URL = "${origin}"\n$env:SISIH_OWNER_TOKEN = "<owner token>"`}
            />
            <p>
              <strong>2.</strong> Look and configure:
            </p>
            <Code label="status and limits">{`pnpm sisih status\npnpm sisih limits set --per-request 2.00 --per-day 6.00 --days 30\npnpm sisih prefs`}</Code>
            <p>
              <strong>3.</strong> When the agent says a purchase is waiting for your approval:
            </p>
            <Code label="approve from the terminal">{`pnpm sisih requests --held\npnpm sisih approve <request-id> --remember\npnpm sisih deny <request-id>`}</Code>
            <p className="detail-note">
              Approving releases funds and settles over x402. The agent polls with <code>get_request_status</code> using the same request ID; status checks never trigger another payment.
            </p>
            <p>
              <strong>4.</strong> Check the result and the evidence, then hand the shared demo back:
            </p>
            <Code label="inspect and finish">{`pnpm sisih request <request-id>\npnpm sisih evidence\npnpm sisih release`}</Code>
            <p className="detail-note">
              Also: <code>pnpm sisih pause</code> / <code>resume</code> / <code>revoke</code>, <code>reserve set</code>, <code>commitment add</code>,{" "}
              <code>session next</code>. <code>pnpm sisih help</code> lists everything; help and invalid input never send anything. Owner transactions are signed on
              the server by &quot;Demo owner (server-signed, testnet)&quot;, not by your own wallet.
            </p>
          </div>
        </Panel>

        <Panel title="Credentials" action={<Badge tone="warning">Keep them private</Badge>}>
          <div className="connect-body">
            <p>
              Two separate credentials. The <strong>agent credential</strong> only lets an agent read its budget and services, request purchases and read its own
              requests. The <strong>owner token</strong> (the demo token) approves, denies, configures and resets. Never put the owner token in the agent&apos;s
              folder, environment or prompt; a separate terminal window is not isolation by itself.
            </p>
            <p>Both are delivered privately: judges receive the owner token with the submission, and an owner token holder can reveal the agent credential here.</p>
            {unlocked ? (
              <div className="connect-cred">
                <Button variant="secondary" onClick={() => (cred ? setShown(!shown) : void reveal())}>
                  {shown ? <EyeOff size={15} /> : <Eye size={15} />}
                  {shown ? "Hide agent credential" : "Show agent credential"}
                </Button>
                {shown && cred?.token && (
                  <div className="connect-secret">
                    <KeyRound size={14} aria-hidden />
                    <code>{cred.token}</code>
                    <CopyButton value={cred.token} label="Copy agent credential" />
                  </div>
                )}
                {error && <p className="field-error">{error}</p>}
              </div>
            ) : (
              <p className="detail-note">
                To reveal the agent credential, unlock <strong>Demo controls</strong> (bottom right) with the owner token.
              </p>
            )}
          </div>
        </Panel>

        <Panel title="Shared demo readiness for judges" action={<Badge tone="memory">Preflight</Badge>}>
          <div className="connect-body">
            <p>
              <strong>Read-only exploration:</strong> Anyone can inspect the live dashboard, transaction evidence, and Walrus memories without credentials. The historical <Link href="/tour" className="text-button">Recorded run</Link> (from <code>sisih-hosted-6</code>) is always available as a static walkthrough.
            </p>
            <p>
              <strong>Live agent execution:</strong> Requires the privately delivered owner token and an available shared demo lease.
            </p>
            <p className="detail-note">
              At the final tested state (<code>sisih-hosted-9</code>), the vault held 1.60 free testnet USDC with ChainScope priced at 0.80 USDC. This permits at most two new purchases from the free pool. Free funds depend on previous runs and are not a persistent readiness guarantee.
            </p>
            <p className="detail-note">
              <strong>Owner preflight check:</strong> Before a live judging test, check status with <code>pnpm sisih status</code>, <code>pnpm sisih limits</code>, and <code>pnpm sisih prefs</code>. If free funds are low, the owner can adjust reserves (<code>pnpm sisih reserve set &lt;id&gt; &lt;amount&gt;</code>) or deposit testnet USDC. The shared demo is never silently reset.
            </p>
          </div>
        </Panel>
      </div>
    </>
  );
}
