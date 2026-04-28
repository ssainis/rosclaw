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

test("topics view exposes /odom subscription and message viewer", async ({ page }) => {
  await page.addInitScript(() => {
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

        if (message.op === "call_service" && message.service === "/rosapi/topics") {
          queueMicrotask(() => {
            this.onmessage?.({
              data: JSON.stringify({
                op: "service_response",
                id: message.id,
                service: "/rosapi/topics",
                result: true,
                values: { topics: ["/scan", "/odom"] },
              }),
            });
          });
          return;
        }

        if (message.op === "call_service" && message.service === "/rosapi/topic_type") {
          queueMicrotask(() => {
            this.onmessage?.({
              data: JSON.stringify({
                op: "service_response",
                id: message.id,
                service: "/rosapi/topic_type",
                result: true,
                values: {
                  type: message.args?.topic === "/odom" ? "nav_msgs/Odometry" : "sensor_msgs/msg/LaserScan",
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
});
