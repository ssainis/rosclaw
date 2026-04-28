import { beforeEach, describe, expect, it } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { resetLayoutPersistenceForTests, useLayoutStore } from "./layout";

describe("layout store", () => {
  beforeEach(() => {
    resetLayoutPersistenceForTests();
    setActivePinia(createPinia());
  });

  it("starts with operator preset defaults", () => {
    const store = useLayoutStore();

    expect(store.selectedRole).toBe("operator");
    expect(store.activePreset.panelOrder).toEqual(["canvas", "alerts", "events"]);
    expect(store.activePreset.hiddenPanels).toEqual([]);
  });

  it("saves role preset and restores it from persisted storage", () => {
    const store = useLayoutStore();

    store.saveRolePreset("incident-responder", {
      panelOrder: ["events", "alerts", "canvas"],
      hiddenPanels: ["canvas"],
    });

    expect(store.selectedRole).toBe("incident-responder");
    expect(store.activePreset.panelOrder).toEqual(["events", "alerts", "canvas"]);
    expect(store.activePreset.hiddenPanels).toEqual(["canvas"]);

    setActivePinia(createPinia());
    const restored = useLayoutStore();

    expect(restored.selectedRole).toBe("incident-responder");
    expect(restored.activePreset.panelOrder).toEqual(["events", "alerts", "canvas"]);
    expect(restored.activePreset.hiddenPanels).toEqual(["canvas"]);
  });
});
