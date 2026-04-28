import { beforeEach, describe, expect, it } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { mount } from "@vue/test-utils";
import { nextTick } from "vue";
import { buildCanonicalEventEnvelope, resetEventCounterForTests } from "../core/events/envelope";
import { useTimelineStore } from "../stores/timeline";
import TimelineView from "./TimelineView.vue";

describe("TimelineView", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    resetEventCounterForTests();
  });

  it("renders empty states before events are available", async () => {
    const wrapper = mount(TimelineView);
    await nextTick();

    expect(wrapper.get('[data-testid="timeline-empty"]').text()).toContain("No events match");
    expect(wrapper.get('[data-testid="timeline-trace-empty"]').text()).toContain("Select a trace");
  });

  it("filters and correlates events by trace id", async () => {
    const store = useTimelineStore();

    store.ingestEnvelope(
      buildCanonicalEventEnvelope({
        source: "operator",
        entity_type: "mission",
        entity_id: "mission-main",
        event_type: "mission:state",
        trace_id: "trace-7",
        payload: { status: "running", mode: "assist" },
      }),
    );

    store.ingestEnvelope(
      buildCanonicalEventEnvelope({
        source: "operator",
        entity_type: "system",
        entity_id: "audit",
        event_type: "audit:entry",
        trace_id: "trace-7",
        payload: { action: "switch-mode" },
      }),
    );

    store.ingestEnvelope(
      buildCanonicalEventEnvelope({
        source: "rosbridge",
        entity_type: "topic",
        entity_id: "/odom",
        event_type: "topic:/odom",
        payload: { pose: { pose: { position: { x: 1, y: 2 } } } },
      }),
    );

    const wrapper = mount(TimelineView);
    await nextTick();

    await wrapper.get('[data-testid="timeline-filter-query"]').setValue("audit");
    expect(wrapper.get('[data-testid="timeline-events-table"]').text()).toContain("audit:entry");

    await wrapper.get('[data-testid="timeline-filter-query"]').setValue("");
    await wrapper.get('[data-testid="timeline-filter-trace"]').setValue("trace-7");
    await nextTick();

    expect(wrapper.get('[data-testid="timeline-trace-list"]').text()).toContain("mission:state");
    expect(wrapper.get('[data-testid="timeline-trace-list"]').text()).toContain("audit:entry");
  });
});
