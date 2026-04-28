<script setup lang="ts">
import { computed, ref } from "vue";
import { RouterLink, RouterView } from "vue-router";
import { ensureRosbridgeConnection, getRosbridgeClient } from "../services/rosbridge-connection";
import {
  DEFAULT_CONTROL_ENDPOINTS,
  submitEmergencyStop,
} from "../services/control-center";
import { useConnectionStore } from "../stores/connection";
import { useControlStore } from "../stores/control";

const navItems = [
  { to: "/overview", label: "Overview" },
  { to: "/robots", label: "Robots" },
  { to: "/agents", label: "Agents" },
  { to: "/topics", label: "Topics" },
  { to: "/control", label: "Control" },
  { to: "/metrics", label: "Metrics" },
  { to: "/timeline", label: "Timeline" },
  { to: "/alerts", label: "Alerts" },
  { to: "/settings", label: "Settings" },
];

const store = useConnectionStore();
const controlStore = useControlStore();
const estopDialogOpen = ref(false);
const estopReason = ref("");
const estopConfirm = ref(false);
const estopError = ref<string | null>(null);
const estopStatus = ref<string | null>(null);

const rosbridgeBadge = computed(() => {
  const status = store.rosbridge.status;
  const tone =
    status === "connected"
      ? "is-ok"
      : status === "stale" || status === "reconnecting"
        ? "is-warning"
        : status === "failed"
          ? "is-error"
          : "is-neutral";

  return {
    tone,
    label: status,
  };
});

const rlBadge = computed(() => {
  const status = store.rl.status;
  const tone =
    status === "connected"
      ? "is-ok"
      : status === "stale" || status === "reconnecting"
        ? "is-warning"
        : status === "failed"
          ? "is-error"
          : "is-neutral";

  return {
    tone,
    label: store.rl.transport ? `${status} (${store.rl.transport})` : status,
  };
});

function currentClient() {
  return getRosbridgeClient() ?? ensureRosbridgeConnection();
}

function openEstopDialog(): void {
  estopDialogOpen.value = true;
  estopError.value = null;
  estopStatus.value = null;
}

function closeEstopDialog(): void {
  estopDialogOpen.value = false;
  estopReason.value = "";
  estopConfirm.value = false;
}

async function submitEstop(): Promise<void> {
  estopError.value = null;
  estopStatus.value = null;

  const reason = estopReason.value.trim();
  if (!reason) {
    estopError.value = "A reason is required for emergency stop.";
    return;
  }

  if (!estopConfirm.value) {
    estopError.value = "Confirm emergency stop before submitting.";
    return;
  }

  try {
    await submitEmergencyStop(currentClient(), DEFAULT_CONTROL_ENDPOINTS.estop, reason);
    estopStatus.value = "Emergency stop submitted.";
    closeEstopDialog();
  } catch (error) {
    estopError.value = error instanceof Error ? error.message : "Emergency stop failed";
  }
}
</script>

<template>
  <div class="shell">
    <header class="topbar" data-testid="topbar">
      <div class="brand">RosClaw Unified Dashboard</div>
      <div class="topbar-right">
        <button
          type="button"
          class="estop-button"
          data-testid="topbar-estop-open"
          :disabled="controlStore.hasPendingActions"
          @click="openEstopDialog"
        >
          E-Stop
        </button>
        <div class="badges">
          <span class="badge" :class="rosbridgeBadge.tone" data-testid="rosbridge-status">
            rosbridge: {{ rosbridgeBadge.label }}
          </span>
          <span class="badge" :class="rlBadge.tone" data-testid="rl-status">
            rl: {{ rlBadge.label }}
          </span>
        </div>
      </div>
    </header>

    <section v-if="estopDialogOpen" class="estop-dialog" data-testid="topbar-estop-dialog">
      <header>
        <h2>Emergency Stop</h2>
        <p>This action should be used only for immediate hazard mitigation.</p>
      </header>
      <label>
        <span>Reason</span>
        <textarea
          v-model="estopReason"
          data-testid="topbar-estop-reason"
          rows="3"
          placeholder="Describe why emergency stop is required"
        />
      </label>
      <label class="confirm-row">
        <input v-model="estopConfirm" data-testid="topbar-estop-confirm" type="checkbox" />
        <span>I confirm this will immediately stop motion.</span>
      </label>

      <p v-if="estopError" class="estop-error" data-testid="topbar-estop-error">{{ estopError }}</p>
      <p v-if="estopStatus" class="estop-status" data-testid="topbar-estop-status">{{ estopStatus }}</p>

      <div class="estop-actions">
        <button type="button" class="estop-cancel" data-testid="topbar-estop-cancel" @click="closeEstopDialog">
          Cancel
        </button>
        <button type="button" class="estop-submit" data-testid="topbar-estop-submit" @click="submitEstop">
          Confirm E-Stop
        </button>
      </div>
    </section>

    <div class="body">
      <nav class="side-nav" data-testid="side-nav">
        <RouterLink v-for="item in navItems" :key="item.to" :to="item.to">
          {{ item.label }}
        </RouterLink>
      </nav>

      <main class="content" data-testid="content-panel">
        <RouterView />
      </main>
    </div>
  </div>
</template>

<style scoped>
.shell {
  min-height: 100vh;
  display: grid;
  grid-template-rows: auto 1fr;
}

.topbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  padding: 0.9rem 1.2rem;
  border-bottom: 1px solid var(--panel-border);
  background: linear-gradient(120deg, #071f2e, #0b2f3d 55%, #184f64);
  color: #f4fbff;
}

.topbar-right {
  display: flex;
  align-items: center;
  gap: 0.7rem;
  flex-wrap: wrap;
}

.estop-button,
.estop-submit,
.estop-cancel {
  border: 1px solid transparent;
  border-radius: 0.5rem;
  padding: 0.35rem 0.65rem;
  font: inherit;
  cursor: pointer;
}

.estop-button,
.estop-submit {
  background: #b11f2a;
  color: #fff;
  border-color: rgba(255, 180, 180, 0.5);
}

.estop-cancel {
  background: rgba(126, 147, 161, 0.2);
  color: #f4fbff;
  border-color: rgba(174, 193, 206, 0.32);
}

.estop-dialog {
  border-bottom: 1px solid var(--panel-border);
  background: #fff8f8;
  padding: 0.8rem 1.2rem;
  display: grid;
  gap: 0.55rem;
}

.estop-dialog h2 {
  margin: 0;
  color: #8f1d1d;
}

.estop-dialog p {
  margin: 0.3rem 0 0;
  color: #4d5f6d;
}

.estop-dialog label {
  display: grid;
  gap: 0.25rem;
}

.estop-dialog textarea {
  width: 100%;
  border: 1px solid #d8b4b4;
  border-radius: 0.45rem;
  padding: 0.55rem 0.6rem;
  font: inherit;
}

.confirm-row {
  display: flex;
  align-items: center;
  gap: 0.45rem;
}

.estop-error {
  margin: 0;
  color: #9b1c1c;
}

.estop-status {
  margin: 0;
  color: #1d6f42;
}

.estop-actions {
  display: flex;
  gap: 0.5rem;
}

.brand {
  font-weight: 700;
  letter-spacing: 0.02em;
}

.badges {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.badge {
  text-transform: uppercase;
  font-size: 0.72rem;
  letter-spacing: 0.04em;
  padding: 0.2rem 0.55rem;
  border-radius: 999px;
  border: 1px solid transparent;
}

.is-ok {
  background: rgba(40, 192, 95, 0.17);
  border-color: rgba(77, 255, 136, 0.35);
}

.is-warning {
  background: rgba(255, 174, 0, 0.18);
  border-color: rgba(255, 213, 0, 0.4);
}

.is-error {
  background: rgba(220, 67, 67, 0.2);
  border-color: rgba(255, 90, 90, 0.42);
}

.is-neutral {
  background: rgba(126, 147, 161, 0.2);
  border-color: rgba(174, 193, 206, 0.32);
}

.body {
  min-height: 0;
  display: grid;
  grid-template-columns: 220px 1fr;
}

.side-nav {
  padding: 1rem;
  border-right: 1px solid var(--panel-border);
  background: var(--panel-bg);
  display: grid;
  align-content: start;
  gap: 0.3rem;
}

.side-nav a {
  color: var(--text-muted);
  text-decoration: none;
  padding: 0.5rem 0.6rem;
  border-radius: 0.5rem;
  transition: background-color 160ms ease, color 160ms ease;
}

.side-nav a.router-link-active {
  background: var(--chip-bg);
  color: var(--text-strong);
  font-weight: 600;
}

.content {
  padding: 1rem;
  background: radial-gradient(circle at 18% 0%, #f4f8fb, #e7eef2 44%, #dfe8ed);
}

@media (max-width: 900px) {
  .body {
    grid-template-columns: 1fr;
  }

  .side-nav {
    border-right: 0;
    border-bottom: 1px solid var(--panel-border);
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 0.4rem;
  }

  .content {
    padding: 0.85rem;
  }
}
</style>
