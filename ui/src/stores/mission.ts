import { defineStore } from "pinia";
import type { CanonicalEventEnvelope } from "../core/events/envelope";

export type MissionStatus = "idle" | "running" | "paused" | "error" | "unknown";

interface MissionSnapshot {
  id: string;
  status: MissionStatus;
  mode: string | null;
  lastEventType: string;
  updatedAt: string;
}

interface MissionState {
  current: MissionSnapshot | null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null) return null;
  return value as Record<string, unknown>;
}

function coerceMissionStatus(value: unknown): MissionStatus {
  if (value === "idle") return "idle";
  if (value === "running") return "running";
  if (value === "paused") return "paused";
  if (value === "error") return "error";
  return "unknown";
}

export const useMissionStore = defineStore("mission", {
  state: (): MissionState => ({
    current: null,
  }),
  getters: {
    isMissionActive(state): boolean {
      return state.current?.status === "running";
    },
    currentMissionMode(state): string | null {
      return state.current?.mode ?? null;
    },
  },
  actions: {
    ingestEnvelope(event: CanonicalEventEnvelope): void {
      if (event.entity_type !== "mission") return;

      const payload = asRecord(event.payload);
      const mode = typeof payload?.mode === "string" ? payload.mode : null;

      this.current = {
        id: event.entity_id,
        status: coerceMissionStatus(payload?.status),
        mode,
        lastEventType: event.event_type,
        updatedAt: event.timestamp_ui_received,
      };
    },
  },
});