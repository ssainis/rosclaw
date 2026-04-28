import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RosbridgeClient } from "./client";

class MockWebSocket {
  static instances: MockWebSocket[] = [];

  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onmessage: ((event: MessageEvent<string>) => void) | null = null;

  sentMessages: string[] = [];

  constructor(public readonly url: string) {
    MockWebSocket.instances.push(this);
  }

  send(data: string) {
    this.sentMessages.push(data);
  }

  close() {
    this.onclose?.();
  }

  emitOpen() {
    this.onopen?.();
  }

  emitMessage(data: string) {
    this.onmessage?.({ data } as MessageEvent<string>);
  }

  emitClose() {
    this.onclose?.();
  }
}

describe("RosbridgeClient reconnect behavior", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    MockWebSocket.instances = [];
    vi.stubGlobal("WebSocket", MockWebSocket as unknown as typeof WebSocket);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("re-subscribes to active topics after reconnect", () => {
    const client = new RosbridgeClient({
      url: "ws://test:9090",
      reconnect: true,
      reconnectInterval: 10,
      maxReconnectAttempts: 2,
    });

    const handler = vi.fn();
    client.subscribe("/odom", "nav_msgs/Odometry", handler);
    client.connect();

    const first = MockWebSocket.instances[0];
    first.emitOpen();

    const firstPayloads = first.sentMessages.map((msg) => JSON.parse(msg));
    expect(firstPayloads[0]).toMatchObject({
      op: "subscribe",
      topic: "/odom",
      type: "nav_msgs/Odometry",
    });

    first.emitClose();
    vi.advanceTimersByTime(10);

    const second = MockWebSocket.instances[1];
    second.emitOpen();

    const secondPayloads = second.sentMessages.map((msg) => JSON.parse(msg));
    expect(secondPayloads[0]).toMatchObject({
      op: "subscribe",
      topic: "/odom",
      type: "nav_msgs/Odometry",
    });
  });

  it("enters failed after exhausting reconnect attempts", () => {
    const statuses: string[] = [];
    const client = new RosbridgeClient({
      url: "ws://test:9090",
      reconnect: true,
      reconnectInterval: 10,
      maxReconnectAttempts: 1,
    });

    client.onConnection((status) => {
      statuses.push(status);
    });

    client.connect();
    const first = MockWebSocket.instances[0];
    first.emitClose();
    vi.advanceTimersByTime(10);

    const second = MockWebSocket.instances[1];
    second.emitClose();

    expect(statuses).toContain("failed");
  });

  it("resolves rosbridge service calls with service_response payloads", async () => {
    const client = new RosbridgeClient({
      url: "ws://test:9090",
      reconnect: false,
    });

    client.connect();
    const socket = MockWebSocket.instances[0];
    socket.emitOpen();

    const responsePromise = client.callService("/rosapi/topics", {}, 1000);

    const call = JSON.parse(socket.sentMessages[0]);
    expect(call).toMatchObject({
      op: "call_service",
      service: "/rosapi/topics",
    });

    socket.emitMessage(
      JSON.stringify({
        op: "service_response",
        id: call.id,
        service: "/rosapi/topics",
        result: true,
        values: { topics: ["/odom", "/scan"] },
      }),
    );

    await expect(responsePromise).resolves.toEqual({ topics: ["/odom", "/scan"] });
  });

  it("rejects rosbridge service calls when no response arrives before timeout", async () => {
    const client = new RosbridgeClient({
      url: "ws://test:9090",
      reconnect: false,
    });

    client.connect();
    const socket = MockWebSocket.instances[0];
    socket.emitOpen();

    const responsePromise = client.callService("/rosapi/topics", {}, 10);
    vi.advanceTimersByTime(10);

    await expect(responsePromise).rejects.toThrow("rosbridge service call timed out");
  });
});
