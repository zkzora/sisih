"use client";
import { Overview } from "./overview";
import { ObligationsView } from "./obligations";
import { AgentView } from "./agent";
import { MemoryView } from "./memory";
import { LearningView } from "./learning";
import { ActivityView } from "./activity";
import { SettingsView } from "./settings";
import type { View } from "@/lib/types";
export function DashboardView({ view }: { view: View }) {
  const Component = {
    overview: Overview,
    obligations: ObligationsView,
    agent: AgentView,
    memory: MemoryView,
    learning: LearningView,
    activity: ActivityView,
    settings: SettingsView,
  }[view];
  return <Component />;
}
