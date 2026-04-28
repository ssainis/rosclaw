import { beforeEach, describe, expect, it } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { mount } from "@vue/test-utils";
import { nextTick } from "vue";
import { resetLayoutPersistenceForTests, useLayoutStore } from "../stores/layout";
import SettingsView from "./SettingsView.vue";

describe("SettingsView", () => {
  beforeEach(() => {
    resetLayoutPersistenceForTests();
    setActivePinia(createPinia());
  });

  it("saves role-based visibility and order preset", async () => {
    const wrapper = mount(SettingsView);
    await nextTick();

    await wrapper.get('[data-testid="settings-layout-role"]').setValue("incident-responder");
    await nextTick();
    await wrapper.get('[data-testid="settings-layout-visible-alerts"]').setValue(false);
    await wrapper.get('[data-testid="settings-layout-up-events"]').trigger("click");
    await wrapper.get('[data-testid="settings-layout-save"]').trigger("click");

    const store = useLayoutStore();
    expect(store.selectedRole).toBe("incident-responder");
    expect(store.activePreset.hiddenPanels).toContain("alerts");
    expect(store.activePreset.panelOrder[0]).toBe("events");
    expect(wrapper.get('[data-testid="settings-layout-status"]').text()).toContain(
      "Saved layout preset for incident-responder",
    );
  });
});
