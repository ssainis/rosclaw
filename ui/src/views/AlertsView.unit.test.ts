import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { mount } from "@vue/test-utils";
import { nextTick } from "vue";
import { buildCanonicalEventEnvelope, resetEventCounterForTests } from "../core/events/envelope";
import { useAlertsStore } from "../stores/alerts";
import AlertsView from "./AlertsView.vue";

const { acknowledgeAlertMock } = vi.hoisted(() => ({
  acknowledgeAlertMock: vi.fn(),
}));

vi.mock("../services/alerts-safety", () => ({
  acknowledgeAlert: acknowledgeAlertMock,
}));

describe("AlertsView", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    resetEventCounterForTests();
    acknowledgeAlertMock.mockReset();
  });

  it("renders alert counters and severity filtering", async () => {
    const store = useAlertsStore();
    store.ingestEnvelope(
      buildCanonicalEventEnvelope({
        source: "operator",
        entity_type: "system",
        entity_id: "alerts",
        event_type: "alert:raised",
        severity: "critical",
        payload: {
          alert_id: "critical-1",
          severity: "critical",
          message: "Battery low",
        },
      }),
    );
    store.ingestEnvelope(
      buildCanonicalEventEnvelope({
        source: "operator",
        entity_type: "system",
        entity_id: "alerts",
        event_type: "alert:raised",
        severity: "warning",
        payload: {
          alert_id: "warning-1",
          severity: "warning",
          message: "Telemetry delay",
        },
      }),
    );

    const wrapper = mount(AlertsView);
    await nextTick();

    expect(wrapper.get('[data-testid="alerts-summary-total"]').text()).toContain("2");
    expect(wrapper.get('[data-testid="alerts-summary-critical"]').text()).toContain("1");

    await wrapper.get('[data-testid="alerts-filter-severity"]').setValue("critical");
    await nextTick();

    const list = wrapper.get('[data-testid="alerts-list"]');
    expect(list.text()).toContain("Battery low");
    expect(list.text()).not.toContain("Telemetry delay");
  });

  it("calls acknowledge service for open alerts", async () => {
    const store = useAlertsStore();
    store.ingestEnvelope(
      buildCanonicalEventEnvelope({
        source: "operator",
        entity_type: "system",
        entity_id: "alerts",
        event_type: "alert:raised",
        severity: "error",
        trace_id: "trace-9",
        payload: {
          alert_id: "alert-9",
          severity: "error",
          message: "Sensor degraded",
        },
      }),
    );

    const wrapper = mount(AlertsView);
    await nextTick();

    await wrapper.get('[data-testid="alerts-ack-alert-9"]').trigger("click");

    expect(acknowledgeAlertMock).toHaveBeenCalledWith({
      alertId: "alert-9",
      traceId: "trace-9",
      message: "Acknowledged from alerts panel",
    });
  });
});
