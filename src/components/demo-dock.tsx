"use client";
import { useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  FlaskConical,
  Play,
  RotateCcw,
  ArrowRight,
  Database,
  Search,
  FileText,
} from "lucide-react";
import { useSisih } from "./context";
import { Badge, Button, Confirm } from "./ui";
import { demoDay } from "@/lib/engine";
export function DemoDock() {
  const { state, act, reset } = useSisih();
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState(false);
  return (
    <>
      <div className={`demo-dock ${open ? "expanded" : ""}`}>
        <button
          className="demo-dock-trigger"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <FlaskConical size={16} />
          <span>Demo controls</span>
          <span className="dock-session">S{state.session}</span>
          {open ? <ChevronDown size={15} /> : <ChevronUp size={15} />}
        </button>
        {open && (
          <div className="demo-dock-content">
            <div className="dock-heading">
              <span>
                Cycle {state.cycle} · Session {state.session}
              </span>
              <Badge>{demoDay(state)}</Badge>
            </div>
            <p className="muted">
              Run the same task again to see how remembered decisions change the
              outcome.
            </p>
            <div className="scenario-buttons">
              <button
                onClick={() => act({ type: "request", merchant: "DataMart" })}
              >
                <Database size={16} />
                <span>
                  Buy market data<small>DataMart · 0.50 USDC</small>
                </span>
                <Play size={13} />
              </button>
              <button
                onClick={() => act({ type: "request", merchant: "SearchBox" })}
              >
                <Search size={16} />
                <span>
                  Search the web<small>SearchBox · 1.20 USDC</small>
                </span>
                <Play size={13} />
              </button>
              <button
                onClick={() => act({ type: "request", merchant: "ReportLab" })}
              >
                <FileText size={16} />
                <span>
                  Get a research report<small>ReportLab · 3.00 USDC</small>
                </span>
                <Play size={13} />
              </button>
            </div>
            <Button
              variant="secondary"
              className="full-width"
              disabled={state.cycleAdvanced}
              onClick={() => act({ type: "advance-cycle" })}
            >
              Advance billing cycle
              <ArrowRight size={14} />
            </Button>
            <Button
              className="full-width"
              onClick={() => act({ type: "new-session" })}
            >
              Start next session
              <ArrowRight size={14} />
            </Button>
            <button className="reset-demo" onClick={() => setConfirm(true)}>
              <RotateCcw size={12} />
              Reset demo workspace
            </button>
            <small className="dock-disclaimer">
              All actions are simulated. No real funds move.
            </small>
          </div>
        )}
      </div>
      <Confirm
        open={confirm}
        onClose={() => setConfirm(false)}
        onConfirm={reset}
        title="Reset this demo?"
        description="This clears the demo balances, requests, rules, memories, and session history saved in this browser."
        label="Reset demo"
      />
    </>
  );
}
