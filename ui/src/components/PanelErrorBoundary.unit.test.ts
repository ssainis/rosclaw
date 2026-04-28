import { describe, it, expect } from "vitest";
import { defineComponent, h, nextTick } from "vue";
import { mount } from "@vue/test-utils";
import PanelErrorBoundary from "./PanelErrorBoundary.vue";

describe("PanelErrorBoundary", () => {
  it("renders slot content when no error occurs", () => {
    const wrapper = mount(PanelErrorBoundary, {
      props: { panelLabel: "Test Panel" },
      slots: { default: "<div data-testid='child'>hello</div>" },
    });
    expect(wrapper.find("[data-testid='child']").exists()).toBe(true);
    expect(wrapper.find("[data-testid='panel-error-test-panel']").exists()).toBe(false);
  });

  it("renders error state when internalError ref is set (direct vm access)", async () => {
    const wrapper = mount(PanelErrorBoundary, {
      props: { panelLabel: "Failing Panel" },
      slots: { default: "<div>ok</div>" },
    });

    // Simulate onErrorCaptured setting the error ref by exposing via vm internal
    // We patch the component's internal ref directly.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (wrapper.vm as any).error = "boom from child";
    await nextTick();

    expect(wrapper.find("[data-testid='panel-error-failing-panel']").exists()).toBe(true);
    expect(wrapper.find("[data-testid='panel-error-failing-panel']").text()).toContain("boom from child");
  });

  it("resets error state when retry button is clicked", async () => {
    const wrapper = mount(PanelErrorBoundary, {
      props: { panelLabel: "Recovery Panel" },
      slots: { default: "<div data-testid='recovered'>content</div>" },
    });

    // Simulate an error.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (wrapper.vm as any).error = "transient error";
    await nextTick();

    expect(wrapper.find("[data-testid='panel-error-recovery-panel']").exists()).toBe(true);

    // Click retry — should reset the error ref.
    await wrapper.find(".panel-error-retry").trigger("click");
    await nextTick();

    // Error panel gone, slot renders again.
    expect(wrapper.find("[data-testid='panel-error-recovery-panel']").exists()).toBe(false);
    expect(wrapper.find("[data-testid='recovered']").exists()).toBe(true);
  });

  it("uses default panelLabel when not provided", () => {
    const wrapper = mount(PanelErrorBoundary, {
      slots: { default: "<div>content</div>" },
    });
    // Component should mount without error
    expect(wrapper.exists()).toBe(true);
  });
});
