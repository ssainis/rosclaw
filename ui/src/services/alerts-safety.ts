import type { EventBus } from "../core/events/bus";
import { buildCanonicalEventEnvelope } from "../core/events/envelope";
import { eventBus } from "../core/events/runtime";

export interface AlertAcknowledgeInput {
  alertId: string;
  message?: string;
  traceId?: string | null;
}

export function acknowledgeAlertForBus(
  bus: EventBus,
  input: AlertAcknowledgeInput,
): void {
  bus.publish(
    buildCanonicalEventEnvelope({
      source: "operator",
      entity_type: "system",
      entity_id: "alerts",
      event_type: "alert:ack",
      trace_id: input.traceId ?? undefined,
      payload: {
        alert_id: input.alertId,
        message: input.message ?? "Acknowledged by operator",
      },
    }),
  );
}

export function acknowledgeAlert(input: AlertAcknowledgeInput): void {
  acknowledgeAlertForBus(eventBus, input);
}
