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
          <strong>Your agent</strong> (Claude Code) gets a task, picks a service and asks Sisih to buy it.
        </li>
        <li>
          <strong>Sisih</strong> pays at once if it fits your limits and preferences, holds it for you if it is new, and refuses anything that would touch
          committed funds.
        </li>
        <li>
          <strong>You</strong> answer held requests from your terminal: <code>pnpm sisih approve &lt;id&gt; --remember</code>. The agent continues the same request
          and uses what it bought.
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
              <strong>2.</strong> Add the Sisih skill (how to buy, wait for approval, report receipts):
            </p>
            <Shells
              label="skill download"
              bash={`mkdir -p .claude/skills/sisih && curl -fsSL ${skill} -o .claude/skills/sisih/SKILL.md`}
              powershell={`New-Item -ItemType Directory -Force .claude/skills/sisih | Out-Null; Invoke-WebRequest ${skill} -OutFile .claude/skills/sisih/SKILL.md`}
            />
            <p>
              <strong>3.</strong> Set the agent credential in that terminal only, then start <code>claude</code> there:
            </p>
            <Shells label="agent credential" bash={`export SISIH_AGENT_TOKEN="<agent credential>"`} powershell={`$env:SISIH_AGENT_TOKEN = "<agent credential>"`} />
            <p>
              <strong>4.</strong> Connection check (read only):
            </p>
            <Code label="connection check prompt">{CHECK_PROMPT}</Code>
            <p>
              <strong>5.</strong> A task with live data (ChainScope reads your vault from Sui Testnet at purchase time):
            </p>
            <Code label="task prompt">{TASK_PROMPT}</Code>
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
              <strong>3.</strong> When the agent says a purchase is waiting for you:
            </p>
            <Code label="approve from the terminal">{`pnpm sisih requests --held\npnpm sisih approve <request-id> --remember\npnpm sisih deny <request-id>`}</Code>
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

        <Panel title="Prefer a browser?">
          <div className="connect-body">
            <p>
              The workspace shows the same live state: held requests in{" "}
              <Link href="/agent" className="text-button">
                Agent &amp; requests
              </Link>{" "}
              (the agent&apos;s links open the request directly), receipts in{" "}
              <Link href="/activity" className="text-button">
                Onchain activity
              </Link>{" "}
              and memories in{" "}
              <Link href="/memory" className="text-button">
                Memory
              </Link>
              . Deciding there needs the same owner token.
            </p>
            <p className="detail-note">
              One shared live workspace, one run at a time: others get a clear &quot;busy&quot; answer. End with the agent&apos;s <code>end_demo_session</code> or{" "}
              <code>pnpm sisih release</code>.
            </p>
            <Link className="text-button" href="/tour">
              See a complete recorded run first <ArrowRight size={13} />
            </Link>
          </div>
        </Panel>
      </div>
    </>
  );
}
