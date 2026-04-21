<script setup lang="ts">
import { onMounted, onUnmounted, ref } from "vue";
import RosCanvas from "../components/RosCanvas.vue";
import type { RobotPose } from "../components/RosCanvas.vue";
import { getRosbridgeClient } from "../services/rosbridge-connection";
import { useConnectionStore } from "../stores/connection";

const robots = ref<RobotPose[]>([]);
const store = useConnectionStore();
let unsubscribe = () => {};

function mapOdomMessage(msg: Record<string, unknown>): RobotPose | null {
  const pose = (msg.pose as Record<string, unknown> | undefined)?.pose as
    | Record<string, unknown>
    | undefined;
  if (!pose) return null;

  const position = pose.position as Record<string, number> | undefined;
  const orientation = pose.orientation as Record<string, number> | undefined;
  if (!position || !orientation) return null;

  // Convert quaternion z/w to yaw for the current 2D canvas.
  const yaw = 2 * Math.atan2(orientation.z, orientation.w);
  return { x: position.x, y: position.y, theta: yaw, label: "robot" };
}

onMounted(() => {
  const client = getRosbridgeClient();
  if (!client) return;

  unsubscribe = client.subscribe("/odom", "nav_msgs/Odometry", (msg) => {
    const pose = mapOdomMessage(msg);
    if (!pose) return;
    robots.value = [pose];
    store.markRosbridgeMessageReceived();
  });
});

onUnmounted(() => {
  unsubscribe();
});
</script>

<template>
  <section class="overview">
    <header>
      <h1>Overview</h1>
      <p>Golden path: /odom pose stream to live canvas.</p>
    </header>

    <RosCanvas
      :robots="robots"
      :width="640"
      :height="440"
      :world-width="10"
      :world-height="10"
    />

    <p v-if="robots.length === 0" class="hint">
      Waiting for <code>/odom</code> messages from rosbridge...
    </p>
  </section>
</template>

<style scoped>
.overview {
  display: grid;
  gap: 0.9rem;
}

header h1 {
  margin: 0;
  font-size: 1.2rem;
  color: var(--text-strong);
}

header p {
  margin: 0.25rem 0 0;
  color: var(--text-muted);
}

.hint {
  margin: 0;
  color: var(--text-muted);
}

code {
  background: var(--chip-bg);
  padding: 0.1rem 0.3rem;
  border-radius: 0.25rem;
}
</style>
