"use client";
import { useState } from "react";
import { ChevronDown, ChevronUp, FlaskConical, Play, RotateCcw, ArrowRight, Database, Search, FileText, Lock, LockOpen } from "lucide-react";
import { useSisih } from "./context";
import { Badge, Button, Confirm, Spinner } from "./ui";
import { formatDuration, useNow } from "./live-bits";

/** Demo controls. Read-only unless the demo token is entered (kept in sessionStorage). */
export function DemoDock() {
  const { state, act, reset, unlocked, unlock, lock, busy } = useSisih();
  const now = useNow();
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [token, setToken] = useState("");
  const [checking, setChecking] = useState(false);
  const clock = state.live?.clock;
  const nextDue = clock?.nextDueMs ? clock.nextDueMs + 5_000 : null;
  const dueIn = nextDue ? Math.max(0, (nextDue - now) / 1000) : null;
  const working = Boolean(busy);
  return (
    <>
      <div className={`demo-dock ${open ? "expanded" : ""}`}>
        <button className="demo-dock-trigger" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
          {unlocked ? <FlaskConical size={16} /> : <Lock size={15} />}
          <span>{unlocked ? "Demo controls" : "Demo controls locked"}</span>
          <span className="dock-session">S{state.session}</span>
          {open ? <ChevronDown size={15} /> : <ChevronUp size={15} />}
        </button>
        {open && (
          <div className="demo-dock-content">
            <div className="dock-heading">
              <span>
                Cycle {state.cycle} · Session {state.session}
              </span>
              <Badge>{dueIn === null ? "no bills" : dueIn > 0 ? `bills in ${formatDuration(dueIn)}` : "bills due"}</Badge>
            </div>
            {!unlocked ? (
              <form
                className="dock-lock"
                onSubmit={async (e) => {
                  e.preventDefault();
                  setChecking(true);
                  await unlock(token);
                  setChecking(false);
                  setToken("");
                }}
              >
                <p className="muted">This public workspace is read-only. Enter the demo token to run the agent, advance cycles and reset; it is kept only for this browser tab. Owners can do the same from a terminal with pnpm sisih (see Connect your agent).</p>
                <input type="password" autoComplete="off" placeholder="Demo token" aria-label="Demo token" value={token} onChange={(e) => setToken(e.target.value)} />
                <Button type="submit" className="full-width" disabled={!token || checking}>
                  {checking ? <Spinner label="Checking" /> : <LockOpen size={14} />}
                  Unlock demo controls
                </Button>
              </form>
            ) : (
              <>
                <p className="muted">Each task calls a demo merchant, receives its 402 invoice, and asks Sisih to pay. Run the same task again after a new session to see memory change the outcome.</p>
                <div className="scenario-buttons">
                  <button disabled={working} onClick={() => void act({ type: "request", merchant: "DataMart" })}>
                    <Database size={16} />
                    <span>
                      Buy market data<small>DataMart (demo) · 0.50 USDC</small>
                    </span>
                    <Play size={13} />
                  </button>
                  <button disabled={working} onClick={() => void act({ type: "request", merchant: "SearchBox" })}>
                    <Search size={16} />
                    <span>
                      Search the web<small>SearchBox (demo) · 1.20 USDC</small>
                    </span>
                    <Play size={13} />
                  </button>
                  <button disabled={working} onClick={() => void act({ type: "request", merchant: "ReportLab" })}>
                    <FileText size={16} />
                    <span>
                      Get a research report<small>ReportLab (demo) · 3.00 USDC</small>
                    </span>
                    <Play size={13} />
                  </button>
                </div>
                <Button variant="secondary" className="full-width" disabled={working} onClick={() => void act({ type: "advance-cycle" })}>
                  {busy === "advance-cycle" ? <Spinner label="Paying bills" /> : <>Advance billing cycle <ArrowRight size={14} /></>}
                </Button>
                <Button className="full-width" disabled={working} onClick={() => void act({ type: "new-session" })}>
                  {busy === "new-session" ? <Spinner label="Saving memories, rebuilding rules" /> : <>Start next session <ArrowRight size={14} /></>}
                </Button>
                {busy === "run-task" && <Spinner label="Agent is calling the merchant" />}
                <button className="reset-demo" disabled={working} onClick={() => setConfirm(true)}>
                  <RotateCcw size={12} />
                  {busy === "reset" ? "Resetting…" : "Reset demo vault"}
                </button>
                <button className="reset-demo" onClick={lock}>
                  <Lock size={12} />
                  Lock demo controls
                </button>
              </>
            )}
            <small className="dock-disclaimer">Sui {state.preferences.network}. Demo merchants and simulated income; demo funds are recycled. Advance cycle needs bills to be due (2-minute demo cycle).</small>
          </div>
        )}
      </div>
      <Confirm
        open={confirm}
        onClose={() => setConfirm(false)}
        onConfirm={() => void reset()}
        title="Reset the demo vault?"
        description="Empties the testnet vault, sweeps demo funds back, re-seeds 20.00 USDC with the four sample commitments, clears requests and rules, and starts a fresh Walrus Memory namespace. Takes 2-3 minutes."
        label="Reset demo"
      />
    </>
  );
}
