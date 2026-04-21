<script setup lang="ts">
import { onMounted, onUnmounted } from "vue";
import AppShell from "./components/AppShell.vue";
import {
  ensureRosbridgeConnection,
  shutdownRosbridgeConnection,
} from "./services/rosbridge-connection";

onMounted(() => {
  ensureRosbridgeConnection();
});

onUnmounted(() => {
  shutdownRosbridgeConnection();
});
</script>

<template>
  <AppShell />
</template>

