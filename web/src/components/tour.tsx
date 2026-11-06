"use client";
/**
 * "Explore demo": a guided replay of one recorded run, for first-time visitors. Nothing here
 * calls the API, signs, pays or writes memory. Every value and link comes from the documented
 * run of 2026-11-06 (docs/PROGRESS.md, Phase 5; snapshot in docs/evidence/sisih-hosted-6).
 */
import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, ArrowRight, ExternalLink, History } from "lucide-react";
import { Badge, Button, PageHeading, Panel } from "./ui";

const RUN = { namespace: "sisih-hosted-6", date: "2026-11-06", memories: 35 };
const tx = (d: string) => `https://suiscan.xyz/testnet/tx/${d}`;
const blob = (b: string) => `https://walruscan.com/mainnet/blob/${b}`;
const short = (s: string) => `${s.slice(0, 8)}…`;

type Evidence = { label: string; href: string; value: string };
interface Step {
  title: string;
  lead: string;
  facts: string[];
  evidence: Evidence[];
  live: { href: string; label: string };
}

const STEPS: Step[] = [
  {
    title: "Total funds, commitments, free funds",
    lead: "The vault holds 20.00 USDC, but 16.50 is already promised to four commitments. Only the 3.50 left over is free, and free funds are the only money the agent can ever be paid from.",
    facts: ["Total 20.00 · committed 16.50 · free 3.50", "Inference API 6.00, Hosting VPS 5.00, Weekly savings 4.00, Domain renewal 1.50", "The Move vault on Sui Testnet enforces the reserves; the server reads it through Tatum."],
    evidence: [{ label: "Seed transaction", href: tx("8dQKZDKAAbQ5Lx5d3eU7WQFpmX4mDip3KubfmzoHL1sZ"), value: short("8dQKZDKAAbQ5Lx5d3eU7WQFpmX4mDip3KubfmzoHL1sZ") }],
    live: { href: "/obligations", label: "See the live commitments" },
  },
  {
    title: "A permitted purchase",
    lead: "The agent buys 0.50 USDC of price history from DataMart (a demo service). It is under the owner's 0.50 automatic threshold and fits every vault limit, so Sisih pays it at once over x402.",
    facts: ["Decision: approved automatically (default threshold)", "The vault releases exactly 0.50 from free funds; the agent pays with that coin", "Both transactions verified through Tatum"],
    evidence: [
      { label: "Release from the vault", href: tx("2Ju96fSrg2qk1iJcy41x4LsYTd6cSeSo59Lcu2zVSy3A"), value: short("2Ju96fSrg2qk1iJcy41x4LsYTd6cSeSo59Lcu2zVSy3A") },
      { label: "x402 settlement", href: tx("EC38SWXoisFLojvYwkuD4xckwHkVTnvG8m2JwkNJvjMC"), value: short("EC38SWXoisFLojvYwkuD4xckwHkVTnvG8m2JwkNJvjMC") },
    ],
    live: { href: "/activity", label: "See live onchain activity" },
  },
  {
    title: "A request that needs the owner",
    lead: "Next the agent asks to pay SearchBox 1.20 USDC. Sisih has never seen this merchant, so nothing is paid: the request waits in Agent & requests. The owner chooses Approve & remember.",
    facts: ["Held: new merchant, payment not made", "Owner approves and saves a rule: allow SearchBox up to 1.50 USDC for 30 days", "The rule is written to Walrus Memory on Mainnet, then the payment settles"],
    evidence: [
      { label: "Release", href: tx("BPQsJKfz6YTwU7kuq1gYi7FfoKiPYLas8jzZ4jh4578f"), value: short("BPQsJKfz6YTwU7kuq1gYi7FfoKiPYLas8jzZ4jh4578f") },
      { label: "x402 settlement", href: tx("5SwM31dV71TcmdA9kT1MJfqKD3nveSKo9sAuTecoVvNz"), value: short("5SwM31dV71TcmdA9kT1MJfqKD3nveSKo9sAuTecoVvNz") },
      { label: "Rule memory (Walrus)", href: blob("pzgbmXXnEEVdL1ApgYfg0zdvc-SOZUWKzLMvzyBGneA"), value: short("pzgbmXXnEEVdL1ApgYfg0zdvc-SOZUWKzLMvzyBGneA") },
    ],
    live: { href: "/agent", label: "See live requests" },
  },
  {
    title: "A request blocked by reserves",
    lead: "Then the agent wants a 3.00 USDC report from ReportLab. Only 1.80 is free, so paying would use 1.20 of committed money. Approve is disabled: the contract would refuse it. The owner denies and remembers.",
    facts: ["Held: would cut reserves by 1.20; Approve disabled", "Later, the release was sent straight to the vault, bypassing the server: 1.20 with 0.70 free was refused onchain (EExceedsFree)", "No remembered rule can unlock committed funds"],
    evidence: [{ label: "Refused release (EExceedsFree)", href: tx("3QcakorFNa8YhAaXHdv8wHU39kYXnis4EdJA6mLhRGeM"), value: short("3QcakorFNa8YhAaXHdv8wHU39kYXnis4EdJA6mLhRGeM") }],
    live: { href: "/obligations", label: "See what is reserved now" },
  },
  {
    title: "Memory changes the next decision",
    lead: "In session 2 Sisih rebuilds its rules from Walrus recall. The same SearchBox request for 1.20 is approved on its own, with the remembered rule as the reason. A 6.80 bill against a 6.00 reserve was also remembered and turned into a suggestion to reserve 7.00, which the owner accepted.",
    facts: ["Session 2: 2 rules rebuilt from Walrus; SearchBox auto-approved by the rule", "Reserve suggestion 6.00 → 7.00 accepted by the owner", `Manual reviews over five demo sessions: 2, 1, 1, 2, 2 (sessions 3 to 5 scripted; reviews rose when higher reserves left little free money)`],
    evidence: [
      { label: "Session 2 release", href: tx("nYxWRpJk31MyFQYAiQD6ffRiou7c1UrDZgJBKm5o436"), value: short("nYxWRpJk31MyFQYAiQD6ffRiou7c1UrDZgJBKm5o436") },
      { label: "Session 2 settlement", href: tx("5jqPJmRqi4QjayKn1RfhCdoJDeLBv8UuG95pGVAY1UmK"), value: short("5jqPJmRqi4QjayKn1RfhCdoJDeLBv8UuG95pGVAY1UmK") },
      { label: "Bill outcome memory", href: blob("UMqAuiVX1Yoxcqc2ebS2PJp8NpObkOEADrw75nV7Ds8"), value: short("UMqAuiVX1Yoxcqc2ebS2PJp8NpObkOEADrw75nV7Ds8") },
      { label: "Reserve change", href: tx("6DaXxdwoEotRTRzT3Mqio9sMDKL7NCwimDpDQxPa7veL"), value: short("6DaXxdwoEotRTRzT3Mqio9sMDKL7NCwimDpDQxPa7veL") },
    ],
    live: { href: "/learning", label: "See live Learning impact" },
  },
];

export function TourView() {
  const [i, setI] = useState(0);
  const step = STEPS[i]!;
  return (
    <>
      <PageHeading
        eyebrow="Explore demo"
        title="How Sisih protects money you've promised."
        description="A guided replay of one recorded run. Nothing on this page pays, signs or writes memory."
        action={
          <Link className="button button-secondary" href="/connect">
            Connect your agent
            <ArrowRight size={15} />
          </Link>
        }
      />
      <div className="tour-recorded" role="note">
        <History size={15} aria-hidden />
        <span>
          <strong>Recorded run, not live:</strong> namespace <code>{RUN.namespace}</code>, {RUN.date}, {RUN.memories} memories on Walrus Mainnet, vault and
          x402 on Sui Testnet. Demo merchants and testnet USDC. The live screens show whatever the shared demo holds now.
        </span>
      </div>
      <ol className="tour-steps" aria-label="Walkthrough steps">
        {STEPS.map((s, n) => (
          <li key={s.title}>
            <button className={n === i ? "selected" : ""} aria-current={n === i ? "step" : undefined} onClick={() => setI(n)}>
              <span className="tour-step-number">{n + 1}</span>
              {s.title}
            </button>
          </li>
        ))}
      </ol>
      <Panel title={`${i + 1}. ${step.title}`} action={<Badge>Recorded {RUN.date}</Badge>}>
        <div className="tour-body">
          <p className="tour-lead">{step.lead}</p>
          <ul className="tour-facts">
            {step.facts.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
          <div className="tour-evidence">
            <span className="muted">Evidence</span>
            {step.evidence.map((e) => (
              <a key={e.href} href={e.href} target="_blank" rel="noreferrer">
                {e.label} <code>{e.value}</code> <ExternalLink size={12} aria-hidden />
              </a>
            ))}
          </div>
          <div className="tour-nav">
            <Button variant="ghost" onClick={() => setI(Math.max(0, i - 1))} disabled={i === 0}>
              <ArrowLeft size={15} /> Back
            </Button>
            <Link className="text-button" href={step.live.href}>
              {step.live.label}
            </Link>
            {i < STEPS.length - 1 ? (
              <Button onClick={() => setI(i + 1)}>
                Next <ArrowRight size={15} />
              </Button>
            ) : (
              <Link className="button button-primary" href="/connect">
                Try it with your agent <ArrowRight size={15} />
              </Link>
            )}
          </div>
        </div>
      </Panel>
    </>
  );
}
