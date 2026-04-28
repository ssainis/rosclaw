import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { mount } from "@vue/test-utils";
import { nextTick } from "vue";
import { buildCanonicalEventEnvelope, resetEventCounterForTests } from "../core/events/envelope";
import { useConnectionStore } from "../stores/connection";
import { useTopicStore } from "../stores/topic";
import TopicsView from "./TopicsView.vue";

const {
  refreshTopicCatalogMock,
  subscribeToTopicMock,
  unsubscribeFromTopicMock,
  teardownTopicExplorerMock,
} = vi.hoisted(() => ({
  refreshTopicCatalogMock: vi.fn(),
  subscribeToTopicMock: vi.fn(),
  unsubscribeFromTopicMock: vi.fn(),
  teardownTopicExplorerMock: vi.fn(),
}));

vi.mock("../services/rosbridge-connection", () => ({
  ensureRosbridgeConnection: vi.fn(() => ({ id: "mock-client" })),
  getRosbridgeClient: vi.fn(() => ({ id: "mock-client" })),
}));

vi.mock("../services/topic-explorer", () => ({
  refreshTopicCatalog: refreshTopicCatalogMock,
  subscribeToTopic: subscribeToTopicMock,
  unsubscribeFromTopic: unsubscribeFromTopicMock,
  teardownTopicExplorer: teardownTopicExplorerMock,
}));

describe("TopicsView", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    resetEventCounterForTests();
    refreshTopicCatalogMock.mockReset();
    subscribeToTopicMock.mockReset();
    unsubscribeFromTopicMock.mockReset();
    teardownTopicExplorerMock.mockReset();
  });

  it("filters discovered topics and renders the latest selected message", async () => {
    const topicStore = useTopicStore();
    useConnectionStore().setRosbridgeTransportStatus("connected");
    topicStore.replaceTopics([
      { name: "/odom", type: "nav_msgs/Odometry" },
      { name: "/scan", type: "sensor_msgs/msg/LaserScan" },
    ]);
    topicStore.setSelectedTopic("/odom");
    topicStore.setTopicSubscription("/odom", true, "nav_msgs/Odometry");
    topicStore.ingestEnvelope(
      buildCanonicalEventEnvelope({
        source: "rosbridge",
        entity_type: "topic",
        entity_id: "/odom",
        event_type: "topic:/odom",
        payload: { pose: { pose: { position: { x: 7.5, y: 2.25 } } } },
      }),
    );

    const wrapper = mount(TopicsView);
    await nextTick();

    await wrapper.get('[data-testid="topics-filter"]').setValue("odom");

    expect(wrapper.get('[data-testid="topics-table"]').text()).toContain("/odom");
    expect(wrapper.get('[data-testid="topic-message-viewer"]').text()).toContain("nav_msgs/Odometry");
    expect(wrapper.get(".raw-message").text()).toContain('"x": 7.5');
  });

  it("delegates subscribe and unsubscribe actions to the topic explorer service", async () => {
    const topicStore = useTopicStore();
    topicStore.replaceTopics([{ name: "/odom", type: "nav_msgs/Odometry" }]);

    const wrapper = mount(TopicsView);
    await nextTick();

    await wrapper.get('[data-testid="topic-toggle-_odom"]').trigger("click");
    expect(subscribeToTopicMock).toHaveBeenCalledWith({ id: "mock-client" }, "/odom", "nav_msgs/Odometry");

    topicStore.setTopicSubscription("/odom", true, "nav_msgs/Odometry");
    await nextTick();

    await wrapper.get('[data-testid="topic-toggle-_odom"]').trigger("click");
    expect(unsubscribeFromTopicMock).toHaveBeenCalledWith("/odom");
  });
});