import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { ensureDomainEventRouting, shutdownDomainEventRouting } from "./domain-event-routing";
import { useAgentStore } from "../stores/agent";
import { useAlertsStore } from "../stores/alerts";
import { useConnectionStore } from "../stores/connection";
import { useMissionStore } from "../stores/mission";
import { useRobotStore } from "../stores/robot";
import { useTopicStore } from "../stores/topic";
import {
  callRosService,
  publishToTopic,
  refreshTopicCatalog,
  refreshServiceCatalog,
  subscribeToTopic,
  teardownTopicExplorer,
  unsubscribeFromTopic,
  validateServiceCallInput,
  validateTopicPublishInput,
} from "./topic-explorer";

describe("topic explorer integration", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    ensureDomainEventRouting({
      robotStore: useRobotStore(),
      agentStore: useAgentStore(),
      missionStore: useMissionStore(),
      alertsStore: useAlertsStore(),
      topicStore: useTopicStore(),
    });
  });

  afterEach(() => {
    teardownTopicExplorer();
    shutdownDomainEventRouting();
  });

  it("discovers topics and routes subscribed /odom payloads into the topic store", async () => {
    const handlers = new Map<string, (message: Record<string, unknown>) => void>();
    const publishSpy = vi.fn();
    const client = {
      callService: vi.fn(async (service: string, args?: Record<string, unknown>) => {
        if (service === "/rosapi/topics") {
          return {
            topics: ["/scan", "/odom"],
            types: ["sensor_msgs/msg/LaserScan", "nav_msgs/Odometry"],
          };
        }

        if (service === "/rosapi/services") {
          return {
            services: ["/robot/get_capabilities"],
            types: ["rosclaw_msgs/srv/GetCapabilities"],
          };
        }

        if (service === "/rosapi/topic_type") {
          return {
            type:
              args?.topic === "/odom" ? "nav_msgs/Odometry" : "sensor_msgs/msg/LaserScan",
          };
        }

        if (service === "/robot/get_capabilities") {
          return {
            success: true,
            manifest: { robot_name: "demo" },
          };
        }

        throw new Error(`Unexpected service ${service}`);
      }),
      subscribe: vi.fn((topic: string, _type: string, handler: (message: Record<string, unknown>) => void) => {
        handlers.set(topic, handler);
        return () => {
          handlers.delete(topic);
        };
      }),
      publish: publishSpy,
    } as unknown as import("../rosbridge").RosbridgeClient;

    await refreshTopicCatalog(client);
    await refreshServiceCatalog(client);

    const topicStore = useTopicStore();
    expect(topicStore.topics.map((topic) => topic.name)).toEqual(["/odom", "/scan"]);
    expect(topicStore.services.map((service) => service.name)).toEqual(["/robot/get_capabilities"]);

    subscribeToTopic(client, "/odom", "nav_msgs/Odometry");
    handlers.get("/odom")?.({
      pose: {
        pose: {
          position: { x: 3.2, y: -1.1 },
          orientation: { z: 0.7071, w: 0.7071 },
        },
      },
    });

    expect(topicStore.selectedTopic?.name).toBe("/odom");
    expect(topicStore.selectedTopic?.isSubscribed).toBe(true);
    expect(topicStore.selectedTopicMessages[0].rawJson).toContain('"x": 3.2');
    expect(useConnectionStore().rosbridge.lastMessageAt).not.toBeNull();

    unsubscribeFromTopic("/odom");
    expect(topicStore.selectedTopic?.isSubscribed).toBe(false);

    expect(validateTopicPublishInput("geometry_msgs/msg/Twist", '{"linear": {"x": "fast"}}')).toMatchObject({
      ok: false,
    });
    expect(
      validateServiceCallInput(
        "rosclaw_msgs/srv/GetCapabilities",
        '{"robot_namespace": "/demo"}',
      ),
    ).toMatchObject({ ok: true });

    publishToTopic(client, "/cmd_vel", "geometry_msgs/msg/Twist", {
      linear: { x: 0.4, y: 0, z: 0 },
      angular: { x: 0, y: 0, z: 0.2 },
    });
    expect(publishSpy).toHaveBeenCalledWith("/cmd_vel", "geometry_msgs/msg/Twist", {
      linear: { x: 0.4, y: 0, z: 0 },
      angular: { x: 0, y: 0, z: 0.2 },
    });

    await expect(
      callRosService(
        client,
        "/robot/get_capabilities",
        "rosclaw_msgs/srv/GetCapabilities",
        { robot_namespace: "/demo" },
      ),
    ).resolves.toEqual({ success: true, manifest: { robot_name: "demo" } });
  });
});