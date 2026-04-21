import { defineStore } from "pinia";
import type { ConnectionStatus } from "../rosbridge";

export type UiConnectionState =
  | "idle"
  | "connecting"
  | "connected"
  | "stale"
  | "reconnecting"
  | "failed";

interface BackendConnection {
  status: UiConnectionState;
  lastChangedAt: number;
  lastMessageAt: number | null;
}

function now(): number {
  return Date.now();
}

function toUiState(status: ConnectionStatus): UiConnectionState {
  if (status === "connected") return "connected";
  if (status === "connecting") return "connecting";
  if (status === "reconnecting") return "reconnecting";
  if (status === "failed") return "failed";
  if (status === "disconnected") return "idle";
  return "idle";
}

export const useConnectionStore = defineStore("connection", {
  state: () => ({
    rosbridge: {
      status: "idle",
      lastChangedAt: now(),
      lastMessageAt: null,
    } as BackendConnection,
  }),
  actions: {
    setRosbridgeTransportStatus(status: ConnectionStatus) {
      const next = toUiState(status);
      if (this.rosbridge.status !== next) {
        this.rosbridge.status = next;
        this.rosbridge.lastChangedAt = now();
      }

      if (next === "connected") {
        this.rosbridge.lastMessageAt = now();
      }
    },
    markRosbridgeMessageReceived(at = now()) {
      this.rosbridge.lastMessageAt = at;
      if (this.rosbridge.status === "stale") {
        this.rosbridge.status = "connected";
        this.rosbridge.lastChangedAt = at;
      }
    },
    evaluateRosbridgeFreshness(maxAgeMs = 5000, at = now()) {
      if (this.rosbridge.status !== "connected") return;
      if (this.rosbridge.lastMessageAt === null) return;

      const age = at - this.rosbridge.lastMessageAt;
      if (age > maxAgeMs) {
        this.rosbridge.status = "stale";
        this.rosbridge.lastChangedAt = at;
      }
    },
  },
});
