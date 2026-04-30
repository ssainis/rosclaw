import { defineStore } from "pinia";

export type ControlActionStatus = "pending" | "succeeded" | "failed";

export interface ControlActionRecord {
  actionId: string;
  actionKey: string;
  label: string;
  endpointName: string;
  endpointType: string;
  traceId: string;
  request: Record<string, unknown>;
  response: Record<string, unknown> | null;
  error: string | null;
  status: ControlActionStatus;
  submittedAt: string;
  completedAt: string | null;
}

interface ControlState {
  activeActionIdsByKey: Record<string, string>;
  history: ControlActionRecord[];
}

const HISTORY_LIMIT = 12;

export const useControlStore = defineStore("control", {
  state: (): ControlState => ({
    activeActionIdsByKey: {},
    history: [],
  }),
  getters: {
    hasPendingActions(state): boolean {
      return Object.keys(state.activeActionIdsByKey).length > 0;
    },
    isActionPending(state) {
      return (actionKey: string): boolean => Boolean(state.activeActionIdsByKey[actionKey]);
    },
    latestAction(state): ControlActionRecord | null {
      return state.history[0] ?? null;
    },
  },
  actions: {
    markPending(record: Omit<ControlActionRecord, "status" | "completedAt" | "response" | "error">): void {
      this.activeActionIdsByKey[record.actionKey] = record.actionId;
      const pendingEntry: ControlActionRecord = {
        ...record,
        status: "pending",
        response: null,
        error: null,
        completedAt: null,
      };

      this.history = [
        pendingEntry,
        ...this.history.filter((entry) => entry.actionId !== record.actionId),
      ].slice(0, HISTORY_LIMIT);
    },

    markSucceeded(actionId: string, response: Record<string, unknown>): void {
      this.history = this.history.map((entry) => {
        if (entry.actionId !== actionId) return entry;

        return {
          ...entry,
          status: "succeeded",
          response,
          error: null,
          completedAt: new Date().toISOString(),
        };
      });

      const completed = this.history.find((entry) => entry.actionId === actionId);
      if (completed) {
        delete this.activeActionIdsByKey[completed.actionKey];
      }
    },

    markFailed(actionId: string, error: string): void {
      this.history = this.history.map((entry) => {
        if (entry.actionId !== actionId) return entry;

        return {
          ...entry,
          status: "failed",
          error,
          response: null,
          completedAt: new Date().toISOString(),
        };
      });

      const completed = this.history.find((entry) => entry.actionId === actionId);
      if (completed) {
        delete this.activeActionIdsByKey[completed.actionKey];
      }
    },
  },
});