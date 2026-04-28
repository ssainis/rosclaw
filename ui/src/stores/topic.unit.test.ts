import { beforeEach, describe, expect, it } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { buildCanonicalEventEnvelope, resetEventCounterForTests } from "../core/events/envelope";
import { useTopicStore } from "./topic";

describe("topic store", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    resetEventCounterForTests();
  });

  it("preserves subscription state when discovery list refreshes", () => {
    const store = useTopicStore();

    store.setTopicSubscription("/odom", true, "nav_msgs/Odometry");
    store.replaceTopics([
      { name: "/odom", type: "nav_msgs/Odometry" },
      { name: "/scan", type: "sensor_msgs/LaserScan" },
    ]);

    expect(store.topics[0]).toMatchObject({
      name: "/odom",
      isSubscribed: true,
      type: "nav_msgs/Odometry",
    });
    expect(store.selectedTopic?.name).toBe("/odom");
  });

  it("records topic messages through canonical envelopes", () => {
    const store = useTopicStore();
    store.replaceTopics([{ name: "/odom", type: "nav_msgs/Odometry" }]);

    store.ingestEnvelope(
      buildCanonicalEventEnvelope({
        source: "rosbridge",
        entity_type: "topic",
        entity_id: "/odom",
        event_type: "topic:/odom",
        payload: {
          pose: {
            pose: {
              position: { x: 1.5, y: -0.5 },
              orientation: { z: 0, w: 1 },
            },
          },
        },
      }),
    );

    expect(store.selectedTopicMessages).toHaveLength(1);
    expect(store.selectedTopicMessages[0].rawJson).toContain('"x": 1.5');
    expect(store.topics[0].messageCount).toBe(1);
    expect(store.topics[0].lastMessageAt).not.toBeNull();
  });
});