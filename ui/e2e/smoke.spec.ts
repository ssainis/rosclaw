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

test("metrics view route renders", async ({ page }) => {
  await page.goto("/metrics");

  await expect(page.getByTestId("topbar")).toBeVisible();
  await expect(page.getByTestId("metrics-view")).toBeVisible();
  await expect(page.getByTestId("metrics-summary")).toBeVisible();
});

test("timeline view route renders", async ({ page }) => {
  await page.goto("/timeline");

  await expect(page.getByTestId("topbar")).toBeVisible();
  await expect(page.getByTestId("timeline-view")).toBeVisible();
  await expect(page.getByTestId("timeline-filters")).toBeVisible();
});

test("alerts view route renders", async ({ page }) => {
  await page.goto("/alerts");

  await expect(page.getByTestId("topbar")).toBeVisible();
  await expect(page.getByTestId("alerts-view")).toBeVisible();
  await expect(page.getByTestId("alerts-summary")).toBeVisible();
});

test("settings layout presets persist across reload", async ({ page }) => {
  await page.goto("/settings");
  await page.evaluate(() => {
    window.localStorage.removeItem("rosclaw.dashboard.layout.v1");
  });
  await page.reload();

  await expect(page.getByTestId("settings-view")).toBeVisible();
  await page.getByTestId("settings-layout-role").selectOption("incident-responder");
  await page.getByTestId("settings-layout-visible-alerts").click();
  await expect(page.getByTestId("settings-layout-visible-alerts")).not.toBeChecked();
  await page.getByTestId("settings-layout-save").click();
  await expect(page.getByTestId("settings-layout-status")).toContainText("incident-responder");

  await page.goto("/overview");
  await expect(page.getByTestId("overview-view")).toBeVisible();
  await expect(page.getByTestId("overview-alerts-panel")).toHaveCount(0);

  await page.reload();
  await expect(page.getByTestId("overview-alerts-panel")).toHaveCount(0);
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

test("control view submits mode and scenario actions with visible provenance", async ({ page }) => {
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

        if (message.op === "call_service" && message.service === "/control/set_mode") {
          queueMicrotask(() => {
            this.onmessage?.({
              data: JSON.stringify({
                op: "service_response",
                id: message.id,
                service: "/control/set_mode",
                result: true,
                values: {
                  success: true,
                  mode: message.args?.mode,
                },
              }),
            });
          });
          return;
        }

        if (message.op === "call_service" && message.service === "/scenario/start_episode") {
          queueMicrotask(() => {
            this.onmessage?.({
              data: JSON.stringify({
                op: "service_response",
                id: message.id,
                service: "/scenario/start_episode",
                result: true,
                values: {
                  success: true,
                  episode_id: "ep-7",
                },
              }),
            });
          });
          return;
        }
      }

      close() {
        this.onclose?.();
      }
    }

    window.WebSocket = MockSocket;
  });

  await page.goto("/control");

  await expect(page.getByTestId("control-view")).toBeVisible();
  await page.getByTestId("control-mode-autonomous").click();
  await expect(page.getByTestId("control-error")).toContainText("Confirm switching into autonomous");

  await page.getByTestId("control-mode-confirm").check();
  await page.getByTestId("control-mode-autonomous").click();
  await expect(page.getByTestId("control-status")).toContainText("Mode switched to autonomous");
  await expect(page.getByTestId("control-summary")).toContainText("autonomous");

  await page.getByTestId("control-scenario-id").fill("warehouse-a");
  await page.getByTestId("control-agent-targets").fill("agent-1, agent-2");
  await page.getByTestId("control-start-episode").click();
  await expect(page.getByTestId("control-status")).toContainText("Episode started for warehouse-a");
  await expect(page.getByTestId("control-action-history")).toContainText("Switch to autonomous");
  await expect(page.getByTestId("control-action-history")).toContainText("Start episode");

  await page.getByTestId("side-nav").getByRole("link", { name: "Timeline" }).click();
  await expect(page.getByTestId("timeline-view")).toBeVisible();
  await expect(page.getByTestId("timeline-audit-table")).toContainText("Switch to autonomous");
  await expect(page.getByTestId("timeline-audit-table")).toContainText("Start episode");
  await expect(page.getByTestId("timeline-audit-table")).toContainText("succeeded");

  const sentMessages = await page.evaluate(() => window.__rosbridgeSentMessages);
  expect(sentMessages).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        op: "call_service",
        service: "/control/set_mode",
        type: "rosclaw_msgs/srv/SetMode",
      }),
      expect.objectContaining({
        op: "call_service",
        service: "/scenario/start_episode",
        type: "rosclaw_msgs/srv/ScenarioControl",
      }),
    ]),
  );
});

test("global e-stop entry requires confirmation and records audit trail", async ({ page }) => {
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

        if (message.op === "call_service" && message.service === "/control/estop") {
          queueMicrotask(() => {
            this.onmessage?.({
              data: JSON.stringify({
                op: "service_response",
                id: message.id,
                service: "/control/estop",
                result: true,
                values: { success: true },
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

  await page.goto("/overview");

  await page.getByTestId("topbar-estop-open").click();
  await expect(page.getByTestId("topbar-estop-dialog")).toBeVisible();
  await page.getByTestId("topbar-estop-submit").click();
  await expect(page.getByTestId("topbar-estop-error")).toContainText("A reason is required");

  await page.getByTestId("topbar-estop-reason").fill("obstacle detected in collision envelope");
  await page.getByTestId("topbar-estop-submit").click();
  await expect(page.getByTestId("topbar-estop-error")).toContainText(
    "Confirm emergency stop before submitting",
  );

  await page.getByTestId("topbar-estop-confirm").check();
  await page.getByTestId("topbar-estop-submit").click();
  await expect(page.getByTestId("topbar-estop-dialog")).toBeHidden();

  await page.getByTestId("side-nav").getByRole("link", { name: "Control" }).click();
  await expect(page.getByTestId("control-action-history")).toContainText("Emergency stop");
  await expect(page.getByTestId("control-action-history")).toContainText(
    "obstacle detected in collision envelope",
  );

  const sentMessages = await page.evaluate(() => window.__rosbridgeSentMessages);
  expect(sentMessages).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        op: "call_service",
        service: "/control/estop",
        type: "rosclaw_msgs/srv/EStop",
        args: { reason: "obstacle detected in collision envelope" },
      }),
    ]),
  );
});

test("degraded-mode banner appears when connection is stale and hides when connected", async ({
  page,
}) => {
  await page.goto("/overview");
  await expect(page.getByTestId("topbar")).toBeVisible();

  // Inject a stale state directly into Pinia's reactive state map.
  await page.evaluate(() => {
    // Pinia exposes internal stores on the app — access via _s map on the pinia instance.
    // The pinia instance is attached to the Vue app; we reach it via the window-mounted app.
    const pinia = (window as unknown as { __pinia?: { state: { value: Record<string, unknown> } } }).__pinia;
    if (pinia && pinia.state.value["connection"]) {
      (pinia.state.value["connection"] as { rosbridge: { status: string } }).rosbridge.status = "stale";
    }
  });

  await expect(page.getByTestId("degraded-banner")).toBeVisible({ timeout: 3000 });
  await expect(page.getByTestId("degraded-reconnect")).toBeVisible();

  // Restore connected state.
  await page.evaluate(() => {
    const pinia = (window as unknown as { __pinia?: { state: { value: Record<string, unknown> } } }).__pinia;
    if (pinia && pinia.state.value["connection"]) {
      (pinia.state.value["connection"] as { rosbridge: { status: string } }).rosbridge.status = "connected";
    }
  });

  await expect(page.getByTestId("degraded-banner")).toBeHidden({ timeout: 3000 });
});

test("/replay route renders capture panel and import section", async ({ page }) => {
  await page.goto("/replay");
  await expect(page.getByRole("heading", { name: "Replay" })).toBeVisible();
  await expect(page.getByLabel("Session capture controls")).toBeVisible();
  await expect(page.getByLabel("Session import")).toBeVisible();
  await expect(page.getByLabel("Not recording")).toBeVisible();
  await expect(page.getByLabel("Start recording")).toBeVisible();
});
