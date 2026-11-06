"use client";
/**
 * "Connect your agent": how to point Claude Code (or any MCP client) at Sisih. The endpoint is
 * this deployment's /api/mcp. The agent credential is never on this page by default: a visitor who
 * unlocked the demo dock with the owner's demo token can reveal it (POST /api/demo/agent-credential,
 * owner-only); everyone else gets it through a private channel.
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

const CHECK_PROMPT = "Use the sisih MCP server to show me my budget and the services I can buy. Do not buy anything.";
const TASK_PROMPT =
  "Research what tends to move the SUI token price. Use the sisih MCP server to buy the SearchBox premium search for this task. If Sisih holds the purchase for my approval, give me the approval link and wait for me. Once it is settled, summarize what you bought, say clearly that it is demo service content, and end the demo session.";

export function ConnectView() {
  const { unlocked } = useSisih();
  const [origin, setOrigin] = useState("https://sisih-azure.vercel.app");
  const [cred, setCred] = useState<{ token: string | null } | null>(null);
  const [shown, setShown] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => setOrigin(window.location.origin), []);
  const endpoint = `${origin}/api/mcp`;

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
        title="Let a real agent buy through Sisih."
        description="Claude Code calls Sisih over MCP. Sisih checks commitments, limits and your remembered preferences; you approve anything new here, in the dashboard."
        action={
          <Link className="button button-secondary" href="/tour">
            Explore demo first
          </Link>
        }
      />
      <div className="connect-grid">
        <Panel title="1. Get the agent credential" action={<Badge tone="warning">Keep it private</Badge>}>
          <div className="connect-body">
            <p>
              The agent uses its own credential, separate from the owner&apos;s demo token. It can read the budget and services, request purchases and read
              its own requests. It cannot approve, deny, reset, withdraw or change reserves.
            </p>
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
                Unlock <strong>Demo controls</strong> (bottom right) with the demo token to reveal the agent credential here. Judges receive the demo token
                privately with the submission.
              </p>
            )}
            <p>Store it in an environment variable, never in a file you commit:</p>
            <Code label="shell command">{`export SISIH_AGENT_TOKEN="<agent credential>"`}</Code>
            <Code label="PowerShell command">{`$env:SISIH_AGENT_TOKEN = "<agent credential>"`}</Code>
          </div>
        </Panel>
        <Panel title="2. Add Sisih to Claude Code">
          <div className="connect-body">
            <p>
              MCP endpoint (Streamable HTTP): <code>{endpoint}</code>
            </p>
            <p>
              Put this in <code>.mcp.json</code> in your project. Claude Code reads the credential from the environment variable:
            </p>
            <Code label=".mcp.json">{mcpJson}</Code>
            <p>Or add it from the command line (your shell fills in the variable):</p>
            <Code label="claude mcp add command">{`claude mcp add --transport http sisih ${endpoint} --header "Authorization: Bearer $SISIH_AGENT_TOKEN"`}</Code>
          </div>
        </Panel>
        <Panel title="3. Check the connection">
          <div className="connect-body">
            <p>Start Claude Code in that project and ask (read only, buys nothing):</p>
            <Code label="connection check prompt">{CHECK_PROMPT}</Code>
          </div>
        </Panel>
        <Panel title="4. Give it a task">
          <div className="connect-body">
            <Code label="sample task">{TASK_PROMPT}</Code>
            <ul className="tour-facts">
              <li>Small, known purchases settle at once over x402 on Sui Testnet; the agent gets the service&apos;s response.</li>
              <li>
                A new merchant waits for you. Nothing is paid until you approve it in{" "}
                <Link href="/agent" className="text-button">
                  Agent &amp; requests
                </Link>{" "}
                (unlock Demo controls first). Choose <strong>Approve &amp; remember</strong> to save the preference to Walrus Memory.
              </li>
              <li>Then tell Claude you approved. It checks the same request; checking again never pays twice.</li>
              <li>Anything that would use committed funds is blocked, whatever is remembered.</li>
            </ul>
          </div>
        </Panel>
        <Panel title="5. Finish">
          <div className="connect-body">
            <p>
              The live demo is one shared workspace with one run at a time. When you are done, ask Claude to call <code>end_demo_session</code>, or click{" "}
              <strong>Lock demo controls</strong>. Results stay visible in{" "}
              <Link href="/activity" className="text-button">
                Onchain activity
              </Link>{" "}
              and{" "}
              <Link href="/memory" className="text-button">
                Memory
              </Link>
              .
            </p>
            <p className="detail-note">
              Demo services with fixed sample content, testnet USDC on Sui Testnet, memories on Walrus Mainnet. Not real-world market data.
            </p>
            <Link className="text-button" href="/agent">
              Open Agent &amp; requests <ArrowRight size={13} />
            </Link>
          </div>
        </Panel>
      </div>
    </>
  );
}
