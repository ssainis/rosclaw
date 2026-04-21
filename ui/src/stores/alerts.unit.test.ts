import { beforeEach, describe, expect, it } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { buildCanonicalEventEnvelope, resetEventCounterForTests } from "../core/events/envelope";
import { useAlertsStore } from "./alerts";

describe("alerts store", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    resetEventCounterForTests();
  });

  it("tracks raised and acknowledged alerts", () => {
    const store = useAlertsStore();

    store.ingestEnvelope(
      buildCanonicalEventEnvelope({
        source: "rosbridge",
        entity_type: "system",
        entity_id: "alerts",
        event_type: "alert:raised",
        severity: "critical",
        payload: {
          alert_id: "battery-low",
          severity: "critical",
          message: "Battery critically low",
        },
      }),
    );

    expect(store.criticalCount).toBe(1);
    expect(store.unacknowledgedCount).toBe(1);

    store.ingestEnvelope(
      buildCanonicalEventEnvelope({
        source: "operator",
        entity_type: "system",
        entity_id: "alerts",
        event_type: "alert:ack",
        payload: {
          alert_id: "battery-low",
          message: "Acknowledged",
        },
      }),
    );

    expect(store.unacknowledgedCount).toBe(0);
  });
});