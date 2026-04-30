import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { mount } from "@vue/test-utils";
import { nextTick } from "vue";
import { buildCanonicalEventEnvelope, resetEventCounterForTests } from "../core/events/envelope";
import { useConnectionStore } from "../stores/connection";
import { useTopicStore } from "../stores/topic";
import TopicsView from "./TopicsView.vue";

interface ValidationResult {
  ok: boolean;
  errors: string[];
  parsed: Record<string, unknown> | null;
}

const {
  callRosServiceMock,
  publishToTopicMock,
  refreshServiceCatalogMock,
  refreshTopicCatalogMock,
  subscribeToTopicMock,
  unsubscribeFromTopicMock,
  validateServiceCallInputMock,
  validateTopicPublishInputMock,
  teardownTopicExplorerMock,
} = vi.hoisted(() => ({
  callRosServiceMock: vi.fn(async () => ({ success: true })),
  publishToTopicMock: vi.fn(),
  refreshServiceCatalogMock: vi.fn(),
  refreshTopicCatalogMock: vi.fn(),
  subscribeToTopicMock: vi.fn(),
  unsubscribeFromTopicMock: vi.fn(),
  validateServiceCallInputMock: vi.fn<() => ValidationResult>(() => ({
    ok: true,
    errors: [],
    parsed: { robot_namespace: "/demo" },
  })),
  validateTopicPublishInputMock: vi.fn<() => ValidationResult>(() => ({
    ok: true,
    errors: [],
    parsed: { linear: { x: 0.2, y: 0, z: 0 }, angular: { x: 0, y: 0, z: 0 } },
  })),
  teardownTopicExplorerMock: vi.fn(),
}));

vi.mock("../core/ros/forms", () => ({
  getRosTypeTemplate: vi.fn((type: string) =>
    type.includes("Trigger") || type.includes("GetCapabilities")
      ? '{\n  "robot_namespace": ""\n}'
      : '{\n  "linear": { "x": 0, "y": 0, "z": 0 },\n  "angular": { "x": 0, "y": 0, "z": 0 }\n}',
  ),
  hasKnownPublishSchema: vi.fn(() => true),
  hasKnownServiceSchema: vi.fn(() => true),
}));

vi.mock("../services/rosbridge-connection", () => ({
  ensureRosbridgeConnection: vi.fn(() => ({ id: "mock-client" })),
  getRosbridgeClient: vi.fn(() => ({ id: "mock-client" })),
}));

vi.mock("../services/topic-explorer", () => ({
  callRosService: callRosServiceMock,
  publishToTopic: publishToTopicMock,
  refreshServiceCatalog: refreshServiceCatalogMock,
  refreshTopicCatalog: refreshTopicCatalogMock,
  subscribeToTopic: subscribeToTopicMock,
  unsubscribeFromTopic: unsubscribeFromTopicMock,
  validateServiceCallInput: validateServiceCallInputMock,
  validateTopicPublishInput: validateTopicPublishInputMock,
  teardownTopicExplorer: teardownTopicExplorerMock,
}));

describe("TopicsView", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    resetEventCounterForTests();
    callRosServiceMock.mockClear();
    publishToTopicMock.mockClear();
    refreshServiceCatalogMock.mockReset();
    refreshTopicCatalogMock.mockReset();
    subscribeToTopicMock.mockReset();
    unsubscribeFromTopicMock.mockReset();
    validateServiceCallInputMock.mockClear();
    validateTopicPublishInputMock.mockClear();
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

  it("blocks invalid publish payloads and surfaces the validation error", async () => {
    const topicStore = useTopicStore();
    topicStore.replaceTopics([{ name: "/cmd_vel", type: "geometry_msgs/msg/Twist" }]);
    topicStore.setSelectedTopic("/cmd_vel");
    validateTopicPublishInputMock.mockReturnValueOnce({
      ok: false,
      errors: ["linear.x must be a number"],
      parsed: null,
    });

    const wrapper = mount(TopicsView);
    await nextTick();

    await wrapper.get('[data-testid="publish-submit"]').trigger("click");

    expect(wrapper.get('[data-testid="publish-error"]').text()).toContain("linear.x must be a number");
    expect(publishToTopicMock).not.toHaveBeenCalled();
  });

  it("submits publish and service calls through the topic explorer service", async () => {
    const topicStore = useTopicStore();
    topicStore.replaceTopics([{ name: "/cmd_vel", type: "geometry_msgs/msg/Twist" }]);
    topicStore.replaceServices([
      { name: "/robot/get_capabilities", type: "rosclaw_msgs/srv/GetCapabilities" },
    ]);
    topicStore.setSelectedTopic("/cmd_vel");
    topicStore.setSelectedService("/robot/get_capabilities");

    const wrapper = mount(TopicsView);
    await nextTick();

    await wrapper.get('[data-testid="publish-submit"]').trigger("click");
    expect(publishToTopicMock).toHaveBeenCalledWith(
      { id: "mock-client" },
      "/cmd_vel",
      "geometry_msgs/msg/Twist",
      { linear: { x: 0.2, y: 0, z: 0 }, angular: { x: 0, y: 0, z: 0 } },
    );

    await wrapper.get('[data-testid="service-submit"]').trigger("click");
    await nextTick();

    expect(callRosServiceMock).toHaveBeenCalledWith(
      { id: "mock-client" },
      "/robot/get_capabilities",
      "rosclaw_msgs/srv/GetCapabilities",
      { robot_namespace: "/demo" },
    );
    expect(wrapper.get('[data-testid="service-status"]').text()).toContain("Service call completed");
  });
});