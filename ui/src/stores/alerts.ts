import { defineStore } from "pinia";
import type { CanonicalEventEnvelope, EventSeverity } from "../core/events/envelope";

export interface AlertEntry {
  id: string;
  severity: EventSeverity;
  message: string;
  source: string;
  traceId: string | null;
  acknowledged: boolean;
  updatedAt: string;
}

interface AlertsState {
  alertsById: Record<string, AlertEntry>;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null) return null;
  return value as Record<string, unknown>;
}

function asSeverity(value: unknown): EventSeverity {
  if (value === "warning") return "warning";
  if (value === "error") return "error";
  if (value === "critical") return "critical";
  return "info";
}

export const useAlertsStore = defineStore("alerts", {
  state: (): AlertsState => ({
    alertsById: {},
  }),
  getters: {
    alerts(state): AlertEntry[] {
      return Object.values(state.alertsById).sort((a, b) =>
        b.updatedAt.localeCompare(a.updatedAt),
      );
    },
    criticalCount(): number {
      return this.alerts.filter((alert) => alert.severity === "critical").length;
    },
    unacknowledgedCount(): number {
      return this.alerts.filter((alert) => !alert.acknowledged).length;
    },
  },
  actions: {
    ingestEnvelope(event: CanonicalEventEnvelope): void {
      if (event.entity_type !== "system") return;
      if (event.event_type !== "alert:raised" && event.event_type !== "alert:ack") return;

      const payload = asRecord(event.payload);
      const alertId = typeof payload?.alert_id === "string" ? payload.alert_id : event.entity_id;
      const message = typeof payload?.message === "string" ? payload.message : event.event_type;

      const existing = this.alertsById[alertId];
      this.alertsById[alertId] = {
        id: alertId,
        severity: asSeverity(payload?.severity ?? event.severity),
        message,
        source: event.source,
        traceId: event.trace_id ?? null,
        acknowledged: event.event_type === "alert:ack" ? true : existing?.acknowledged ?? false,
        updatedAt: event.timestamp_ui_received,
      };
    },
  },
});