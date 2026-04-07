<script setup lang="ts">
import { ref, onUnmounted } from "vue";
import { useRosbridge } from "./composables/useRosbridge.js";
import RosCanvas from "./components/RosCanvas.vue";
import type { RobotPose } from "./components/RosCanvas.vue";

// Rosbridge URL — falls back to the default rosbridge port on the same host
const rosbridgeUrl =
  (import.meta.env.VITE_ROSBRIDGE_URL as string | undefined) ??
  `ws://${window.location.hostname}:9090`;

const { client, status } = useRosbridge(rosbridgeUrl);

// Reactive robot pose driven by /odom or /pose topic
const robots = ref<RobotPose[]>([]);

// Subscribe to /odom (nav_msgs/Odometry) for position + heading
const unsubOdom = client.subscribe(
  "/odom",
  "nav_msgs/Odometry",
  (msg) => {
    const pose = (msg.pose as Record<string, unknown> | undefined)?.pose as
      | Record<string, unknown>
      | undefined;
    if (!pose) return;

    const position = pose.position as Record<string, number> | undefined;
    const orientation = pose.orientation as Record<string, number> | undefined;
    if (!position || !orientation) return;

    // Convert quaternion z/w to yaw
    const yaw = 2 * Math.atan2(orientation.z, orientation.w);

    robots.value = [{ x: position.x, y: position.y, theta: yaw, label: "robot" }];
  },
);

onUnmounted(() => {
  unsubOdom();
});

/** Status badge colour */
function statusColor(s: string): string {
  if (s === "connected") return "#4caf50";
  if (s === "connecting") return "#ff9800";
  return "#f44336";
}
</script>

<template>
  <div class="app">
    <header>
      <h1>🤖 RosClaw Dashboard</h1>
      <span
        class="status-badge"
        :style="{ backgroundColor: statusColor(status) }"
      >{{ status }}</span>
    </header>

    <main>
      <p class="info">
        Connected to <code>{{ rosbridgeUrl }}</code>
      </p>

      <RosCanvas
        :robots="robots"
        :width="600"
        :height="600"
        :world-width="10"
        :world-height="10"
      />

      <p v-if="robots.length === 0" class="hint">
        Waiting for <code>/odom</code> messages from rosbridge…
      </p>
    </main>
  </div>
</template>

<style>
* { box-sizing: border-box; margin: 0; padding: 0; }

body {
  background: #121212;
  color: #e0e0e0;
  font-family: system-ui, sans-serif;
}

.app {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 2rem;
  gap: 1.5rem;
}

header {
  display: flex;
  align-items: center;
  gap: 1rem;
}

h1 { font-size: 1.6rem; }

.status-badge {
  padding: 0.25rem 0.75rem;
  border-radius: 99px;
  font-size: 0.8rem;
  font-weight: bold;
  color: #fff;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.info { color: #9e9e9e; font-size: 0.85rem; }
code { background: #2a2a2a; padding: 0.1em 0.35em; border-radius: 3px; }

.hint { color: #757575; font-size: 0.8rem; margin-top: 0.5rem; }
</style>

