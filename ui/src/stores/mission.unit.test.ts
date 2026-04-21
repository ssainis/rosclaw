import { beforeEach, describe, expect, it } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { buildCanonicalEventEnvelope, resetEventCounterForTests } from "../core/events/envelope";
import { useMissionStore } from "./mission";

describe("mission store", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    resetEventCounterForTests();
  });

  it("tracks mission status and mode", () => {
    const store = useMissionStore();

    store.ingestEnvelope(
      buildCanonicalEventEnvelope({
        source: "operator",
        entity_type: "mission",
        entity_id: "mission-main",
        event_type: "mission:state",
        payload: {
          status: "running",
          mode: "autonomous",
        },
      }),
    );

    expect(store.current?.id).toBe("mission-main");
    expect(store.isMissionActive).toBe(true);
    expect(store.currentMissionMode).toBe("autonomous");
  });
});