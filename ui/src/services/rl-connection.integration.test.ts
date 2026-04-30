import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { createEventBus } from "../core/events/bus";
import { resetEventCounterForTests } from "../core/events/envelope";
import { RlStreamClient } from "../rl";
import { useAgentStore } from "../stores/agent";
import { useAlertsStore } from "../stores/alerts";
import { useConnectionStore } from "../stores/connection";
import { useMissionStore } from "../stores/mission";
import { useRobotStore } from "../stores/robot";
import { useTopicStore } from "../stores/topic";
import { useTimelineStore } from "../stores/timeline";
import { setupDomainEventRoutingForBus } from "./domain-event-routing";
import { startRlConnectionRuntime } from "./rl-connection";

class MockWebSocket {
  static instances: MockWebSocket[] = [];
  readonly url: string;

  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onmessage: ((event: MessageEvent<string>) => void) | null = null;

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
  }

  close() {
    this.onclose?.();
  }

  emitOpen() {
    this.onopen?.();
  }

  emitMessage(data: unknown) {
    this.onmessage?.({ data: JSON.stringify(data) } as MessageEvent<string>);
  }

  emitClose() {
    this.onclose?.();
  }
}

describe("rl connection runtime", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    setActivePinia(createPinia());
    resetEventCounterForTests();
    MockWebSocket.instances = [];
    vi.stubGlobal("WebSocket", MockWebSocket as unknown as typeof WebSocket);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("ingests RL websocket messages into the shared domain stores", () => {
    const bus = createEventBus();
    const connectionStore = useConnectionStore();
    const agentStore = useAgentStore();
    const teardownRouting = setupDomainEventRoutingForBus(bus, {
      robotStore: useRobotStore(),
      agentStore,
      missionStore: useMissionStore(),
      alertsStore: useAlertsStore(),
      topicStore: useTopicStore(),
      timelineStore: useTimelineStore(),
    });

    const shutdown = startRlConnectionRuntime({
      bus,
      store: connectionStore,
      wsUrl: "ws://rl.test/stream",
    });

    const socket = MockWebSocket.instances[0];
    socket.emitOpen();
    socket.emitMessage({
      type: "agent_status",
      agent_id: "agent-live",
      status: "running",
      objective: "scan-sector-7",
      policy_version: "v4.0.0",
    });

    expect(connectionStore.rl.status).toBe("connected");
    expect(connectionStore.rl.transport).toBe("ws");
    expect(agentStore.agents[0].id).toBe("agent-live");
    expect(agentStore.agents[0].status).toBe("running");

    shutdown();
    teardownRouting();
  });

  it("falls back to REST polling when websocket retries are exhausted", async () => {
    const bus = createEventBus();
    const connectionStore = useConnectionStore();
    const agentStore = useAgentStore();
    const teardownRouting = setupDomainEventRoutingForBus(bus, {
      robotStore: useRobotStore(),
      agentStore,
      missionStore: useMissionStore(),
      alertsStore: useAlertsStore(),
      topicStore: useTopicStore(),
      timelineStore: useTimelineStore(),
    });
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const isAgentsEndpoint = String(input).endsWith("/agents");
      return {
        ok: isAgentsEndpoint,
        status: isAgentsEndpoint ? 200 : 404,
        statusText: isAgentsEndpoint ? "OK" : "Not Found",
        json: async () => ({
          agents: [
            {
              id: "agent-fallback",
              status: "paused",
              objective: "guard",
              policy_version: "v4.1.0",
            },
          ],
        }),
      } as Response;
    });

    const shutdown = startRlConnectionRuntime({
      bus,
      store: connectionStore,
      wsUrl: "ws://rl.test/stream",
      restUrl: "http://rl.test/api",
      restPollMs: 1_000,
      fetchImpl: fetchImpl as typeof fetch,
      createClient: (url) =>
        new RlStreamClient({
          url,
          reconnectInterval: 10,
          maxReconnectAttempts: 1,
        }),
    });

    const firstSocket = MockWebSocket.instances[0];
    firstSocket.emitClose();
    vi.advanceTimersByTime(10);

    const secondSocket = MockWebSocket.instances[1];
    secondSocket.emitClose();
    await vi.advanceTimersByTimeAsync(1);

    expect(fetchImpl).toHaveBeenCalled();
    expect(connectionStore.rl.status).toBe("connected");
    expect(connectionStore.rl.transport).toBe("rest");
    expect(agentStore.agents[0].id).toBe("agent-fallback");
    expect(agentStore.agents[0].status).toBe("paused");

    shutdown();
    teardownRouting();
  });
});