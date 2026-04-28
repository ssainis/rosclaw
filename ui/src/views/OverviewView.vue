<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import RosCanvas from "../components/RosCanvas.vue";
import type { RobotPose } from "../components/RosCanvas.vue";
import {
  buildCanonicalEventEnvelope,
  rosHeaderStampToIso,
} from "../core/events/envelope";
import { eventBus } from "../core/events/runtime";
import { getRosbridgeClient } from "../services/rosbridge-connection";
import { useAgentStore } from "../stores/agent";
import { useAlertsStore } from "../stores/alerts";
import { useConnectionStore } from "../stores/connection";
import { useMissionStore } from "../stores/mission";
import { useRobotStore } from "../stores/robot";
import { useLayoutStore, type OverviewPanelId } from "../stores/layout";
import { useTopicStore } from "../stores/topic";

const robots = ref<RobotPose[]>([]);
const connectionStore = useConnectionStore();
const robotStore = useRobotStore();
const agentStore = useAgentStore();
const missionStore = useMissionStore();
const alertsStore = useAlertsStore();
const topicStore = useTopicStore();
const layoutStore = useLayoutStore();
let unsubscribe = () => {};

const summaryCards = computed(() => {
  const missionStatus = missionStore.current?.status ?? "unknown";
  const missionMode = missionStore.currentMissionMode ?? "-";

  return [
    {
      id: "robots",
      title: "Robots Online",
      value: `${robotStore.onlineCount} / ${robotStore.robotCount}`,
      detail: `${topicStore.subscribedTopicCount} subscribed topics`,
    },
    {
      id: "agents",
      title: "Agents Running",
      value: `${agentStore.statusCounts.running} / ${agentStore.agents.length}`,
      detail: `${agentStore.statusCounts.error} in error state`,
    },
    {
      id: "mission",
      title: "Mission State",
      value: missionStatus,
      detail: `Mode: ${missionMode}`,
    },
    {
      id: "alerts",
      title: "Open Alerts",
      value: `${alertsStore.unacknowledgedCount}`,
      detail: `${alertsStore.criticalCount} critical`,
    },
  ];
});

const topAlerts = computed(() => alertsStore.alerts.slice(0, 3));
const recentTopicEvents = computed(() => topicStore.recentMessages.slice(0, 6));
const orderedOverviewPanels = computed(() => {
  const hidden = new Set(layoutStore.activePreset.hiddenPanels);
  return layoutStore.orderedOverviewPanels.filter((panelId) => !hidden.has(panelId));
});

function isPanel(panelId: OverviewPanelId, value: OverviewPanelId): boolean {
  return panelId === value;
}

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
    const envelope = buildCanonicalEventEnvelope({
      source: "rosbridge",
      entity_type: "robot",
      entity_id: "robot-1",
      event_type: "topic:/odom",
      timestamp_source: rosHeaderStampToIso(msg),
      payload: msg,
    });

    eventBus.publish(envelope);

    const payload = envelope.payload as Record<string, unknown>;
    const pose = mapOdomMessage(payload);
    if (!pose) return;
    robots.value = [pose];
    connectionStore.markRosbridgeMessageReceived();
  });
});

onUnmounted(() => {
  unsubscribe();
});
</script>

<template>
  <section class="overview" data-testid="overview-view">
    <header>
      <h1>Overview</h1>
      <p>Live operational summary with `/odom` mini-canvas, top alerts, and recent event preview.</p>
    </header>

    <section class="summary-grid" data-testid="overview-summary">
      <article
        v-for="card in summaryCards"
        :key="card.id"
        class="summary-card"
        :data-testid="`overview-summary-${card.id}`"
      >
        <h2>{{ card.title }}</h2>
        <p>{{ card.value }}</p>
        <small>{{ card.detail }}</small>
      </article>
    </section>

    <section class="overview-grid">
      <template v-for="panelId in orderedOverviewPanels" :key="panelId">
        <article
          v-if="isPanel(panelId, 'canvas')"
          class="panel"
          data-testid="overview-canvas-panel"
        >
          <header>
            <h2>Mini Canvas</h2>
            <p>Golden path: `/odom` pose stream rendered in real time.</p>
          </header>

          <RosCanvas
            :robots="robots"
            :width="600"
            :height="360"
            :world-width="10"
            :world-height="10"
          />

          <p v-if="robots.length === 0" class="hint">
            Waiting for /odom messages from rosbridge...
          </p>
        </article>

        <article
          v-else-if="isPanel(panelId, 'alerts')"
          class="panel"
          data-testid="overview-alerts-panel"
        >
          <header>
            <h2>Top Alerts</h2>
            <p>Highest-priority active alerts from the canonical alert stream.</p>
          </header>

          <p v-if="topAlerts.length === 0" class="hint" data-testid="overview-alerts-empty">
            No alerts have been raised yet.
          </p>

          <ul v-else class="alert-list" data-testid="overview-alerts-list">
            <li v-for="alert in topAlerts" :key="alert.id">
              <span class="alert-severity" :data-severity="alert.severity">{{ alert.severity }}</span>
              <span class="alert-message">{{ alert.message }}</span>
            </li>
          </ul>
        </article>

        <article
          v-else-if="isPanel(panelId, 'events')"
          class="panel"
          data-testid="overview-events-panel"
        >
          <header>
            <h2>Event Preview</h2>
            <p>Most recent topic events routed through shared domain stores.</p>
          </header>

          <p v-if="recentTopicEvents.length === 0" class="hint" data-testid="overview-events-empty">
            No topic events received yet.
          </p>

          <div v-else class="event-table-wrap">
            <table class="event-table" data-testid="overview-events-table">
              <thead>
                <tr>
                  <th>Topic</th>
                  <th>Event</th>
                  <th>Received</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="event in recentTopicEvents" :key="event.eventId">
                  <td>{{ event.topic }}</td>
                  <td>{{ event.eventType }}</td>
                  <td>{{ event.timestampUiReceived }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </article>
      </template>
    </section>
  </section>
</template>

<style scoped>
.overview {
  display: grid;
  gap: 1rem;
}

header h1 {
  margin: 0;
  font-size: 1.25rem;
  color: var(--text-strong);
}

header p {
  margin: 0.25rem 0 0;
  color: var(--text-muted);
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.65rem;
}

.summary-card {
  border: 1px solid var(--panel-border);
  border-radius: 0.65rem;
  background: var(--panel-bg);
  padding: 0.7rem 0.75rem;
}

.summary-card h2 {
  margin: 0;
  font-size: 0.74rem;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.summary-card p {
  margin: 0.35rem 0 0;
  font-size: 1.2rem;
  font-weight: 700;
  color: var(--text-strong);
}

.summary-card small {
  color: var(--text-muted);
}

.overview-grid {
  display: grid;
  grid-template-columns: 1.4fr 1fr;
  gap: 0.8rem;
}

.panel {
  border: 1px solid var(--panel-border);
  border-radius: 0.65rem;
  background: var(--panel-bg);
  padding: 0.75rem;
}

.hint {
  margin: 0.65rem 0 0;
  color: var(--text-muted);
}

.alert-list {
  margin: 0.6rem 0 0;
  padding: 0;
  list-style: none;
  display: grid;
  gap: 0.55rem;
}

.alert-list li {
  border: 1px solid var(--panel-border);
  border-radius: 0.45rem;
  padding: 0.45rem 0.55rem;
  display: grid;
  gap: 0.2rem;
  background: #ffffff;
}

.alert-severity {
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--text-muted);
}

.alert-severity[data-severity="critical"] {
  color: #a51b28;
}

.alert-severity[data-severity="error"] {
  color: #b45d12;
}

.alert-severity[data-severity="warning"] {
  color: #8a6a00;
}

.alert-message {
  color: var(--text-strong);
}

.event-table-wrap {
  margin-top: 0.6rem;
  overflow: auto;
}

.event-table {
  width: 100%;
  border-collapse: collapse;
}

.event-table th,
.event-table td {
  text-align: left;
  padding: 0.45rem 0.5rem;
  border-bottom: 1px solid #d8e4ec;
  font-size: 0.86rem;
  vertical-align: top;
}

@media (max-width: 1024px) {
  .summary-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .overview-grid {
    grid-template-columns: 1fr;
  }
}
</style>
