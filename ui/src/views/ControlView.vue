<script setup lang="ts">
import { computed, reactive, ref } from "vue";
import { ensureRosbridgeConnection, getRosbridgeClient } from "../services/rosbridge-connection";
import {
  CONTROL_ACTION_KEYS,
  DEFAULT_CONTROL_ENDPOINTS,
  submitModeChange,
  submitScenarioAction,
  type MissionMode,
} from "../services/control-center";
import { useConnectionStore } from "../stores/connection";
import { useControlStore } from "../stores/control";
import { useMissionStore } from "../stores/mission";

const connectionStore = useConnectionStore();
const controlStore = useControlStore();
const missionStore = useMissionStore();

const endpointConfig = reactive({
  mode: { ...DEFAULT_CONTROL_ENDPOINTS.mode },
  start: { ...DEFAULT_CONTROL_ENDPOINTS.start },
  reset: { ...DEFAULT_CONTROL_ENDPOINTS.reset },
});

const scenarioId = ref("baseline");
const agentTargets = ref("");
const modeConfirmation = ref(false);
const feedbackError = ref<string | null>(null);
const feedbackStatus = ref<string | null>(null);

const rosbridgeStatusText = computed(() => {
  const transport = connectionStore.rosbridge.transport;
  if (!transport) return connectionStore.rosbridge.status;
  return `${connectionStore.rosbridge.status} (${transport})`;
});

const missionSummary = computed(() => ({
  status: missionStore.current?.status ?? "unknown",
  mode: missionStore.currentMissionMode ?? "unknown",
  updatedAt: missionStore.current?.updatedAt ?? "-",
}));

function clearFeedback(): void {
  feedbackError.value = null;
  feedbackStatus.value = null;
}

function currentClient() {
  return getRosbridgeClient() ?? ensureRosbridgeConnection();
}

function requiresModeConfirmation(mode: MissionMode): boolean {
  return mode === "autonomous" && missionStore.currentMissionMode !== "autonomous";
}

function parseAgentIds(rawValue: string): string[] {
  return rawValue
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
}

async function setMode(mode: MissionMode): Promise<void> {
  clearFeedback();

  if (requiresModeConfirmation(mode) && !modeConfirmation.value) {
    feedbackError.value = `Confirm switching into ${mode} before submitting.`;
    return;
  }

  try {
    await submitModeChange(currentClient(), mode, endpointConfig.mode);
    feedbackStatus.value = `Mode switched to ${mode}.`;
    if (mode === "autonomous") {
      modeConfirmation.value = false;
    }
  } catch (error) {
    feedbackError.value = error instanceof Error ? error.message : "Mode switch failed";
  }
}

async function runScenarioAction(action: "start" | "reset"): Promise<void> {
  clearFeedback();

  if (!scenarioId.value.trim()) {
    feedbackError.value = "Scenario ID is required.";
    return;
  }

  try {
    await submitScenarioAction(currentClient(), action, endpointConfig[action], {
      scenarioId: scenarioId.value.trim(),
      agentIds: parseAgentIds(agentTargets.value),
    });
    feedbackStatus.value = action === "start"
      ? `Episode started for ${scenarioId.value.trim()}.`
      : `Episode reset for ${scenarioId.value.trim()}.`;
  } catch (error) {
    feedbackError.value = error instanceof Error ? error.message : "Scenario action failed";
  }
}
</script>

<template>
  <section class="control-view" data-testid="control-view">
    <header class="control-header">
      <div>
        <h1>Control Center</h1>
        <p>Submit guided mode and scenario actions through the existing rosbridge control path.</p>
      </div>
      <span class="status-pill" data-testid="control-rosbridge-status">rosbridge: {{ rosbridgeStatusText }}</span>
    </header>

    <section class="summary-grid" data-testid="control-summary">
      <article>
        <h2>Mission status</h2>
        <p>{{ missionSummary.status }}</p>
      </article>
      <article>
        <h2>Mission mode</h2>
        <p>{{ missionSummary.mode }}</p>
      </article>
      <article>
        <h2>Updated</h2>
        <p>{{ missionSummary.updatedAt }}</p>
      </article>
    </section>

    <section class="workspace-grid">
      <article class="panel" data-testid="control-mode-panel">
        <header class="panel-header">
          <div>
            <h2>Mode controls</h2>
            <p>Manual and assisted interventions update mission state through typed service calls.</p>
          </div>
          <span class="viewer-chip" :data-pending="controlStore.isActionPending(CONTROL_ACTION_KEYS.mode)">
            {{ controlStore.isActionPending(CONTROL_ACTION_KEYS.mode) ? "Submitting" : "Ready" }}
          </span>
        </header>

        <div class="button-row">
          <button
            type="button"
            class="action-button"
            data-testid="control-mode-manual"
            :disabled="controlStore.hasPendingActions"
            @click="setMode('manual')"
          >
            {{ controlStore.isActionPending(CONTROL_ACTION_KEYS.mode) ? "Submitting..." : "Manual" }}
          </button>
          <button
            type="button"
            class="action-button"
            data-testid="control-mode-assist"
            :disabled="controlStore.hasPendingActions"
            @click="setMode('assist')"
          >
            Assist
          </button>
          <button
            type="button"
            class="action-button action-button-critical"
            data-testid="control-mode-autonomous"
            :disabled="controlStore.hasPendingActions"
            @click="setMode('autonomous')"
          >
            Autonomous
          </button>
        </div>

        <label class="confirm-row" data-testid="control-mode-confirm-row">
          <input v-model="modeConfirmation" data-testid="control-mode-confirm" type="checkbox" />
          <span>Confirm high-risk switch into autonomous mode.</span>
        </label>

        <div class="config-grid">
          <label>
            <span>Mode service</span>
            <input v-model="endpointConfig.mode.serviceName" data-testid="control-mode-service" type="text" />
          </label>
          <label>
            <span>Mode type</span>
            <input v-model="endpointConfig.mode.serviceType" data-testid="control-mode-type" type="text" />
          </label>
        </div>
      </article>

      <article class="panel" data-testid="control-scenario-panel">
        <header class="panel-header">
          <div>
            <h2>Scenario controls</h2>
            <p>Start or reset an episode with explicit target scope and pending-state feedback.</p>
          </div>
          <span class="viewer-chip" :data-pending="controlStore.hasPendingActions">
            {{ controlStore.hasPendingActions ? "Active" : "Idle" }}
          </span>
        </header>

        <div class="config-grid">
          <label>
            <span>Scenario ID</span>
            <input v-model="scenarioId" data-testid="control-scenario-id" type="text" />
          </label>
          <label>
            <span>Agent targets</span>
            <input
              v-model="agentTargets"
              data-testid="control-agent-targets"
              type="text"
              placeholder="agent-1, agent-2"
            />
          </label>
        </div>

        <div class="button-row">
          <button
            type="button"
            class="action-button"
            data-testid="control-start-episode"
            :disabled="controlStore.hasPendingActions"
            @click="runScenarioAction('start')"
          >
            {{ controlStore.isActionPending(CONTROL_ACTION_KEYS.start) ? "Starting..." : "Start episode" }}
          </button>
          <button
            type="button"
            class="action-button"
            data-testid="control-reset-episode"
            :disabled="controlStore.hasPendingActions"
            @click="runScenarioAction('reset')"
          >
            {{ controlStore.isActionPending(CONTROL_ACTION_KEYS.reset) ? "Resetting..." : "Reset episode" }}
          </button>
        </div>

        <div class="config-grid">
          <label>
            <span>Start endpoint</span>
            <input v-model="endpointConfig.start.serviceName" data-testid="control-start-service" type="text" />
          </label>
          <label>
            <span>Start type</span>
            <input v-model="endpointConfig.start.serviceType" data-testid="control-start-type" type="text" />
          </label>
          <label>
            <span>Reset endpoint</span>
            <input v-model="endpointConfig.reset.serviceName" data-testid="control-reset-service" type="text" />
          </label>
          <label>
            <span>Reset type</span>
            <input v-model="endpointConfig.reset.serviceType" data-testid="control-reset-type" type="text" />
          </label>
        </div>
      </article>
    </section>

    <p v-if="feedbackError" class="feedback feedback-error" data-testid="control-error">{{ feedbackError }}</p>
    <p v-if="feedbackStatus" class="feedback feedback-success" data-testid="control-status">{{ feedbackStatus }}</p>

    <article class="panel" data-testid="control-history-panel">
      <header class="panel-header">
        <div>
          <h2>Action provenance</h2>
          <p>Recent control submissions with trace identifiers, endpoints, and final transport outcome.</p>
        </div>
      </header>

      <p v-if="controlStore.history.length === 0" class="empty-state">No control actions have been submitted yet.</p>

      <div v-else class="table-wrap">
        <table class="history-table" data-testid="control-action-history">
          <thead>
            <tr>
              <th>Action</th>
              <th>Status</th>
              <th>Trace</th>
              <th>Endpoint</th>
              <th>Request</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="entry in controlStore.history" :key="entry.actionId">
              <td>{{ entry.label }}</td>
              <td>
                <span class="status-chip" :data-status="entry.status">{{ entry.status }}</span>
              </td>
              <td>{{ entry.traceId }}</td>
              <td>{{ entry.endpointName }}</td>
              <td>
                <pre>{{ JSON.stringify(entry.request, null, 2) }}</pre>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </article>
  </section>
</template>

<style scoped>
.control-view {
  display: grid;
  gap: 1rem;
}

.control-header,
.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 0.75rem;
}

.control-header h1,
.panel-header h2 {
  margin: 0;
  color: var(--text-strong);
}

.control-header p,
.panel-header p {
  margin: 0.35rem 0 0;
  color: var(--text-muted);
}

.status-pill,
.viewer-chip,
.status-chip {
  padding: 0.25rem 0.6rem;
  border-radius: 999px;
  border: 1px solid var(--panel-border);
  background: var(--chip-bg);
  color: var(--text-strong);
  font-size: 0.78rem;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.viewer-chip[data-pending="true"],
.status-chip[data-status="pending"] {
  background: rgba(255, 174, 0, 0.18);
  border-color: rgba(255, 213, 0, 0.4);
}

.status-chip[data-status="succeeded"] {
  background: rgba(40, 192, 95, 0.17);
  border-color: rgba(77, 255, 136, 0.35);
}

.status-chip[data-status="failed"] {
  background: rgba(220, 67, 67, 0.2);
  border-color: rgba(255, 90, 90, 0.42);
}

.summary-grid,
.workspace-grid,
.config-grid,
.button-row {
  display: grid;
  gap: 0.75rem;
}

.summary-grid {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.summary-grid article,
.panel {
  border: 1px solid var(--panel-border);
  border-radius: 0.7rem;
  background: var(--panel-bg);
  padding: 0.8rem;
}

.summary-grid h2,
.config-grid label span,
.history-table th {
  margin: 0;
  font-size: 0.74rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-muted);
}

.summary-grid p {
  margin: 0.35rem 0 0;
  color: var(--text-strong);
  font-size: 1.05rem;
  font-weight: 700;
}

.workspace-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.button-row {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.action-button {
  border: 1px solid var(--panel-border);
  border-radius: 0.55rem;
  background: var(--panel-bg);
  color: var(--text-strong);
  padding: 0.55rem 0.7rem;
  font: inherit;
  cursor: pointer;
}

.action-button:disabled {
  cursor: progress;
  opacity: 0.7;
}

.action-button-critical {
  border-color: rgba(255, 174, 0, 0.5);
}

.config-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.config-grid label,
.confirm-row {
  display: grid;
  gap: 0.35rem;
}

.config-grid input {
  border: 1px solid var(--panel-border);
  border-radius: 0.55rem;
  background: #fcfeff;
  color: var(--text-strong);
  padding: 0.55rem 0.65rem;
  font: inherit;
}

.confirm-row {
  grid-template-columns: auto 1fr;
  align-items: center;
  color: var(--text-muted);
}

.feedback {
  margin: 0;
  border-radius: 0.6rem;
  padding: 0.7rem 0.8rem;
  border: 1px solid transparent;
}

.feedback-error {
  background: rgba(220, 67, 67, 0.14);
  border-color: rgba(255, 90, 90, 0.35);
  color: #8a2222;
}

.feedback-success {
  background: rgba(40, 192, 95, 0.12);
  border-color: rgba(77, 255, 136, 0.35);
  color: #0c5c2a;
}

.empty-state {
  color: var(--text-muted);
}

.table-wrap {
  overflow: auto;
}

.history-table {
  width: 100%;
  border-collapse: collapse;
}

.history-table th,
.history-table td {
  text-align: left;
  padding: 0.6rem 0.7rem;
  border-bottom: 1px solid #d8e4ec;
  vertical-align: top;
}

.history-table td pre {
  margin: 0;
  white-space: pre-wrap;
  font-size: 0.8rem;
}

@media (max-width: 900px) {
  .summary-grid,
  .workspace-grid,
  .config-grid,
  .button-row {
    grid-template-columns: 1fr;
  }
}
</style>