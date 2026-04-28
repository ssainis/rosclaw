import { describe, it, expect, beforeEach, vi } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { setActivePinia, createPinia } from "pinia";
import ReplayView from "./ReplayView.vue";
import { useSessionCaptureStore } from "../stores/session-capture";

vi.useFakeTimers();

// jsdom does not support URL.createObjectURL
global.URL.createObjectURL = vi.fn(() => "blob:fake");
global.URL.revokeObjectURL = vi.fn();

describe("ReplayView", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllTimers();
  });

  it("renders capture panel and import panel", () => {
    const wrapper = mount(ReplayView, { global: { plugins: [] } });
    expect(wrapper.text()).toContain("Capture");
    expect(wrapper.text()).toContain("Load session file");
  });

  it("shows idle state initially", () => {
    const wrapper = mount(ReplayView, { global: { plugins: [] } });
    expect(wrapper.find('[aria-label="Not recording"]').exists()).toBe(true);
    expect(wrapper.text()).toContain("0 events captured");
  });

  it("transitions to recording state on Start recording", async () => {
    const wrapper = mount(ReplayView, { global: { plugins: [] } });
    await wrapper.find('[aria-label="Start recording"]').trigger("click");
    expect(wrapper.find('[aria-label="Recording active"]').exists()).toBe(true);
    expect(wrapper.find('[aria-label="Stop and save session"]').exists()).toBe(true);
  });

  it("shows Stop & save and Export snapshot while recording", async () => {
    const wrapper = mount(ReplayView, { global: { plugins: [] } });
    await wrapper.find('[aria-label="Start recording"]').trigger("click");
    expect(wrapper.find('[aria-label="Export snapshot"]').exists()).toBe(true);
  });

  it("shows replay controls with events loaded in engine", async () => {
    const store = useSessionCaptureStore();
    store.startCapture("engine-test");
    store.ingestEnvelope({
      event_id: "e1",
      source: "rl-ws",
      entity_type: "agent",
      entity_id: "a1",
      event_type: "agent:status",
      timestamp_source: "2026-01-01T00:00:00.000Z",
      timestamp_ui_received: "2026-01-01T00:00:00.000Z",
      severity: "info",
      payload: {},
    });
    const json = store.exportSession()!;
    store.stopCapture();
    
    // Create a fresh store instance and mount with the loaded session
    const store2 = useSessionCaptureStore();
    store2.importSession(json);

    const wrapper = mount(ReplayView, { global: { plugins: [] } });
    
    // After load is called via button click
    await wrapper.find('[aria-label="Load into replay engine"]').trigger("click");
    await flushPromises();
    
    // replay controls should now be visible
    expect(wrapper.find('[aria-label="Replay controls"]').exists()).toBe(true);
  });

  it("shows import error for invalid JSON", async () => {
    const store = useSessionCaptureStore();
    store.importSession("not-json");

    const wrapper = mount(ReplayView, { global: { plugins: [] } });
    expect(wrapper.find('[role="alert"]').text()).toContain("Invalid JSON");
  });

  it("clears loaded session on Clear button", async () => {
    const store = useSessionCaptureStore();
    store.startCapture("cls");
    const json = store.exportSession()!;
    store.stopCapture();
    store.importSession(json);

    const wrapper = mount(ReplayView, { global: { plugins: [] } });
    await wrapper.find('[aria-label="Clear loaded session"]').trigger("click");
    expect(store.loadedSession).toBeNull();
  });

  it("renders speed option buttons", async () => {
    const store = useSessionCaptureStore();
    store.startCapture("speed");
    store.ingestEnvelope({
      event_id: "e1",
      source: "rl-ws",
      entity_type: "agent",
      entity_id: "a1",
      event_type: "agent:status",
      timestamp_source: "2026-01-01T00:00:00.000Z",
      timestamp_ui_received: "2026-01-01T00:00:00.000Z",
      severity: "info",
      payload: {},
    });
    const json = store.exportSession()!;
    store.stopCapture();
    store.importSession(json);

    const wrapper = mount(ReplayView, { global: { plugins: [] } });
    await wrapper.find('[aria-label="Load into replay engine"]').trigger("click");
    await flushPromises();

    const speedBtns = wrapper.findAll('[aria-label*="Set speed"]');
    expect(speedBtns.length).toBeGreaterThan(0);
  });
});
