import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { useConnectionStore } from "./connection";

describe("connection store", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    setActivePinia(createPinia());
  });

  it("maps transport status transitions", () => {
    const store = useConnectionStore();

    store.setRosbridgeTransportStatus("connecting");
    expect(store.rosbridge.status).toBe("connecting");

    store.setRosbridgeTransportStatus("connected");
    expect(store.rosbridge.status).toBe("connected");

    store.setRosbridgeTransportStatus("reconnecting");
    expect(store.rosbridge.status).toBe("reconnecting");

    store.setRosbridgeTransportStatus("failed");
    expect(store.rosbridge.status).toBe("failed");
  });

  it("marks stale when stream ages out", () => {
    const store = useConnectionStore();

    store.setRosbridgeTransportStatus("connected");
    store.markRosbridgeMessageReceived(1_000);
    store.evaluateRosbridgeFreshness(5_000, 7_001);

    expect(store.rosbridge.status).toBe("stale");
  });

  it("returns to connected after a fresh message", () => {
    const store = useConnectionStore();

    store.setRosbridgeTransportStatus("connected");
    store.markRosbridgeMessageReceived(1_000);
    store.evaluateRosbridgeFreshness(5_000, 7_001);

    store.markRosbridgeMessageReceived(8_000);
    expect(store.rosbridge.status).toBe("connected");
  });

  it("tracks RL websocket and REST fallback state independently", () => {
    const store = useConnectionStore();

    store.setRlTransportStatus("connecting");
    expect(store.rl.status).toBe("connecting");
    expect(store.rl.transport).toBe("ws");

    store.setRlFallbackStatus("connected");
    expect(store.rl.status).toBe("connected");
    expect(store.rl.transport).toBe("rest");

    store.markRlMessageReceived(1_000, "rest");
    store.evaluateRlFreshness(5_000, 7_001);
    expect(store.rl.status).toBe("stale");

    store.markRlMessageReceived(8_000, "rest");
    expect(store.rl.status).toBe("connected");
    expect(store.rl.transport).toBe("rest");
  });
});
