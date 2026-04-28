import { expect, test } from "@playwright/test";

test("shell and overview render", async ({ page }) => {
  await page.goto("/overview");

  await expect(page.getByTestId("topbar")).toBeVisible();
  await expect(page.getByTestId("side-nav")).toBeVisible();
  await expect(page.getByTestId("content-panel")).toContainText("Overview");
  await expect(page.getByText("Waiting for /odom messages from rosbridge...")).toBeVisible();
});

test("agents view route renders", async ({ page }) => {
  await page.goto("/agents");

  await expect(page.getByTestId("topbar")).toBeVisible();
  await expect(page.getByTestId("agents-view")).toBeVisible();
  await expect(page.getByTestId("agents-summary")).toBeVisible();
});

test("topics view exposes /odom subscription and validated publish/service flows", async ({ page }) => {
  await page.addInitScript(() => {
    const sentMessages = [];
    window.__rosbridgeSentMessages = sentMessages;

    class MockSocket {
      static instances = [];

      onopen = null;
      onclose = null;
      onerror = null;
      onmessage = null;

      constructor(url) {
        this.url = url;
        MockSocket.instances.push(this);
        queueMicrotask(() => {
          this.onopen?.();
        });
      }

      send(data) {
        const message = JSON.parse(data);
        sentMessages.push(message);

        if (message.op === "call_service" && message.service === "/rosapi/topics") {
          queueMicrotask(() => {
            this.onmessage?.({
              data: JSON.stringify({
                op: "service_response",
                id: message.id,
                service: "/rosapi/topics",
                result: true,
                values: {
                  topics: ["/scan", "/odom", "/cmd_vel"],
                  types: [
                    "sensor_msgs/msg/LaserScan",
                    "nav_msgs/Odometry",
                    "geometry_msgs/msg/Twist",
                  ],
                },
              }),
            });
          });
          return;
        }

        if (message.op === "call_service" && message.service === "/rosapi/services") {
          queueMicrotask(() => {
            this.onmessage?.({
              data: JSON.stringify({
                op: "service_response",
                id: message.id,
                service: "/rosapi/services",
                result: true,
                values: {
                  services: ["/robot/get_capabilities"],
                  types: ["rosclaw_msgs/srv/GetCapabilities"],
                },
              }),
            });
          });
          return;
        }

        if (message.op === "call_service" && message.service === "/robot/get_capabilities") {
          queueMicrotask(() => {
            this.onmessage?.({
              data: JSON.stringify({
                op: "service_response",
                id: message.id,
                service: "/robot/get_capabilities",
                result: true,
                values: {
                  success: true,
                  manifest: { robot_name: "demo" },
                },
              }),
            });
          });
          return;
        }

        if (message.op === "subscribe" && message.topic === "/odom") {
          queueMicrotask(() => {
            this.onmessage?.({
              data: JSON.stringify({
                op: "publish",
                topic: "/odom",
                msg: {
                  pose: {
                    pose: {
                      position: { x: 1.5, y: -0.5, z: 0 },
                      orientation: { z: 0.7071, w: 0.7071 },
                    },
                  },
                },
              }),
            });
          });
        }
      }

      close() {
        this.onclose?.();
      }
    }

    window.WebSocket = MockSocket;
  });

  await page.goto("/topics");

  await expect(page.getByTestId("topics-view")).toBeVisible();
  await expect(page.getByTestId("topics-table")).toContainText("/odom");
  await page.getByTestId("topic-toggle-_odom").click();
  await expect(page.getByTestId("topic-message-viewer")).toContainText("topic:/odom");
  await expect(page.getByTestId("topic-message-viewer")).toContainText('"x": 1.5');

  await page.getByText("/cmd_vel").click();
  await page.getByTestId("publish-payload").fill('{"linear": {"x": "fast"}}');
  await page.getByTestId("publish-submit").click();
  await expect(page.getByTestId("publish-error")).toContainText("linear.x must be a number");

  await page.getByTestId("publish-payload").fill(
    '{"linear": {"x": 0.4, "y": 0, "z": 0}, "angular": {"x": 0, "y": 0, "z": 0.2}}',
  );
  await page.getByTestId("publish-submit").click();
  await expect(page.getByTestId("publish-status")).toContainText("Published to /cmd_vel");

  await page.getByTestId("services-table").getByRole("cell", { name: "/robot/get_capabilities" }).click();
  await page.getByTestId("service-payload").fill('{"robot_namespace": "/demo"}');
  await page.getByTestId("service-submit").click();
  await expect(page.getByTestId("service-status")).toContainText(
    "Service call completed for /robot/get_capabilities",
  );
  await expect(page.getByTestId("service-response")).toContainText('"robot_name": "demo"');

  const sentMessages = await page.evaluate(() => window.__rosbridgeSentMessages);
  expect(sentMessages).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        op: "publish",
        topic: "/cmd_vel",
        type: "geometry_msgs/msg/Twist",
      }),
      expect.objectContaining({
        op: "call_service",
        service: "/robot/get_capabilities",
        type: "rosclaw_msgs/srv/GetCapabilities",
      }),
    ]),
  );
});
