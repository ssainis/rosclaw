<script setup lang="ts">
import { onMounted, onUnmounted } from "vue";
import AppShell from "./components/AppShell.vue";
import { useAgentStore } from "./stores/agent";
import { useAlertsStore } from "./stores/alerts";
import { useMissionStore } from "./stores/mission";
import { useRobotStore } from "./stores/robot";
import {
  ensureDomainEventRouting,
  shutdownDomainEventRouting,
} from "./services/domain-event-routing";
import {
  ensureRosbridgeConnection,
  shutdownRosbridgeConnection,
} from "./services/rosbridge-connection";

const robotStore = useRobotStore();
const agentStore = useAgentStore();
const missionStore = useMissionStore();
const alertsStore = useAlertsStore();

onMounted(() => {
  ensureRosbridgeConnection();
  ensureDomainEventRouting({
    robotStore,
    agentStore,
    missionStore,
    alertsStore,
  });
});

onUnmounted(() => {
  shutdownDomainEventRouting();
  shutdownRosbridgeConnection();
});
</script>

<template>
  <AppShell />
</template>

