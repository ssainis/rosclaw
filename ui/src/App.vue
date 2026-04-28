<script setup lang="ts">
import { onMounted, onUnmounted } from "vue";
import AppShell from "./components/AppShell.vue";
import { useAgentStore } from "./stores/agent";
import { useAlertsStore } from "./stores/alerts";
import { useMissionStore } from "./stores/mission";
import { useRobotStore } from "./stores/robot";
import { useTopicStore } from "./stores/topic";
import {
  ensureDomainEventRouting,
  shutdownDomainEventRouting,
} from "./services/domain-event-routing";
import {
  ensureRosbridgeConnection,
  shutdownRosbridgeConnection,
} from "./services/rosbridge-connection";
import { ensureRlConnection, shutdownRlConnection } from "./services/rl-connection";

const robotStore = useRobotStore();
const agentStore = useAgentStore();
const missionStore = useMissionStore();
const alertsStore = useAlertsStore();
const topicStore = useTopicStore();

onMounted(() => {
  ensureRosbridgeConnection();
  ensureRlConnection();
  ensureDomainEventRouting({
    robotStore,
    agentStore,
    missionStore,
    alertsStore,
    topicStore,
  });
});

onUnmounted(() => {
  shutdownDomainEventRouting();
  shutdownRlConnection();
  shutdownRosbridgeConnection();
});
</script>

<template>
  <AppShell />
</template>

