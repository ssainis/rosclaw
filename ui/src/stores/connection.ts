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
  transport: "ws" | "rest" | null;
}

function idleBackendConnection(): BackendConnection {
  return {
    status: "idle",
    lastChangedAt: now(),
    lastMessageAt: null,
    transport: null,
  };
}

function markBackendTransportStatus(
  backend: BackendConnection,
  status: ConnectionStatus,
  transport: "ws" | "rest",
): void {
  const next = toUiState(status);
  if (backend.status !== next) {
    backend.status = next;
    backend.lastChangedAt = now();
  }

  backend.transport = transport;
  if (next === "connected") {
    backend.lastMessageAt = now();
  }
}

function markBackendMessageReceived(
  backend: BackendConnection,
  at: number,
  transport: "ws" | "rest",
): void {
  backend.lastMessageAt = at;
  backend.transport = transport;
  if (backend.status === "stale" || backend.status !== "connected") {
    backend.status = "connected";
    backend.lastChangedAt = at;
  }
}

function evaluateBackendFreshness(
  backend: BackendConnection,
  maxAgeMs: number,
  at: number,
): void {
  if (backend.status !== "connected") return;
  if (backend.lastMessageAt === null) return;

  const age = at - backend.lastMessageAt;
  if (age > maxAgeMs) {
    backend.status = "stale";
    backend.lastChangedAt = at;
  }
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
    rosbridge: idleBackendConnection(),
    rl: idleBackendConnection(),
  }),
  actions: {
    setRosbridgeTransportStatus(status: ConnectionStatus) {
      markBackendTransportStatus(this.rosbridge, status, "ws");
    },
    markRosbridgeMessageReceived(at = now()) {
      markBackendMessageReceived(this.rosbridge, at, "ws");
    },
    evaluateRosbridgeFreshness(maxAgeMs = 5000, at = now()) {
      evaluateBackendFreshness(this.rosbridge, maxAgeMs, at);
    },
    setRlTransportStatus(status: ConnectionStatus) {
      markBackendTransportStatus(this.rl, status, "ws");
    },
    setRlFallbackStatus(status: Exclude<UiConnectionState, "reconnecting">) {
      if (this.rl.status !== status) {
        this.rl.status = status;
        this.rl.lastChangedAt = now();
      }
      this.rl.transport = "rest";
      if (status === "connected") {
        this.rl.lastMessageAt = now();
      }
    },
    markRlMessageReceived(at = now(), transport: "ws" | "rest" = "ws") {
      markBackendMessageReceived(this.rl, at, transport);
    },
    evaluateRlFreshness(maxAgeMs = 5000, at = now()) {
      evaluateBackendFreshness(this.rl, maxAgeMs, at);
    },
  },
});
