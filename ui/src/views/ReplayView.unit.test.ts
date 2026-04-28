import { describe, it, expect, beforeEach, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { setActivePinia, createPinia } from "pinia";
import ReplayView from "./ReplayView.vue";
import { useSessionCaptureStore } from "../stores/session-capture";

// jsdom does not support URL.createObjectURL
global.URL.createObjectURL = vi.fn(() => "blob:fake");
global.URL.revokeObjectURL = vi.fn();

describe("ReplayView", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
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

  it("shows loaded session metadata after successful import", async () => {
    const store = useSessionCaptureStore();
    store.startCapture("my-session");
    const json = store.exportSession()!;
    store.stopCapture();

    // Simulate loading via importSession directly
    store.importSession(json);

    const wrapper = mount(ReplayView, { global: { plugins: [] } });
    expect(wrapper.find('[aria-label="Loaded session summary"]').exists()).toBe(true);
    expect(wrapper.text()).toContain("my-session");
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
});
