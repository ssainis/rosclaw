import { defineStore } from "pinia";
import type { CanonicalEventEnvelope } from "../core/events/envelope";

export type AgentStatus = "idle" | "running" | "paused" | "error" | "unknown";

export interface AgentSnapshot {
  id: string;
  status: AgentStatus;
  objective: string | null;
  policyVersion: string | null;
  lastReward: number | null;
  lastAction: string | null;
  lastSourceTimestamp: string;
  lastUiReceivedTimestamp: string;
}

interface AgentState {
  agentsById: Record<string, AgentSnapshot>;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null) return null;
  return value as Record<string, unknown>;
}

function coerceAgentStatus(value: unknown): AgentStatus {
  if (value === "idle") return "idle";
  if (value === "running") return "running";
  if (value === "paused") return "paused";
  if (value === "error") return "error";
  return "unknown";
}

function defaultSnapshot(id: string): AgentSnapshot {
  return {
    id,
    status: "unknown",
    objective: null,
    policyVersion: null,
    lastReward: null,
    lastAction: null,
    lastSourceTimestamp: "",
    lastUiReceivedTimestamp: "",
  };
}

export const useAgentStore = defineStore("agent", {
  state: (): AgentState => ({
    agentsById: {},
  }),
  getters: {
    agents(state): AgentSnapshot[] {
      return Object.values(state.agentsById);
    },
    activeAgents(): AgentSnapshot[] {
      return this.agents.filter((agent) => agent.status === "running");
    },
    statusCounts(): Record<AgentStatus, number> {
      const counts: Record<AgentStatus, number> = {
        idle: 0,
        running: 0,
        paused: 0,
        error: 0,
        unknown: 0,
      };

      for (const agent of this.agents) {
        counts[agent.status] += 1;
      }
      return counts;
    },
  },
  actions: {
    ingestEnvelope(event: CanonicalEventEnvelope): void {
      if (event.entity_type !== "agent") return;

      const payload = asRecord(event.payload);
      const current = this.agentsById[event.entity_id] ?? defaultSnapshot(event.entity_id);

      if (event.event_type === "agent:status") {
        const objective = typeof payload?.objective === "string" ? payload.objective : current.objective;
        const policyVersion =
          typeof payload?.policy_version === "string"
            ? payload.policy_version
            : current.policyVersion;

        this.agentsById[event.entity_id] = {
          ...current,
          status: coerceAgentStatus(payload?.status),
          objective,
          policyVersion,
          lastSourceTimestamp: event.timestamp_source,
          lastUiReceivedTimestamp: event.timestamp_ui_received,
        };
        return;
      }

      if (event.event_type === "agent:reward") {
        this.agentsById[event.entity_id] = {
          ...current,
          lastReward: typeof payload?.reward === "number" ? payload.reward : current.lastReward,
          lastSourceTimestamp: event.timestamp_source,
          lastUiReceivedTimestamp: event.timestamp_ui_received,
        };
        return;
      }

      if (event.event_type === "agent:action") {
        this.agentsById[event.entity_id] = {
          ...current,
          lastAction: typeof payload?.action === "string" ? payload.action : current.lastAction,
          lastSourceTimestamp: event.timestamp_source,
          lastUiReceivedTimestamp: event.timestamp_ui_received,
        };
        return;
      }

      this.agentsById[event.entity_id] = {
        ...current,
        lastSourceTimestamp: event.timestamp_source,
        lastUiReceivedTimestamp: event.timestamp_ui_received,
      };
    },
  },
});