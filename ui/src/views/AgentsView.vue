<script setup lang="ts">
import { computed } from "vue";
import { useConnectionStore } from "../stores/connection";
import type { AgentSnapshot } from "../stores/agent";
import { useAgentStore } from "../stores/agent";

const connectionStore = useConnectionStore();
const agentStore = useAgentStore();

const sortedAgents = computed(() => {
  return [...agentStore.agents].sort((a, b) => {
    return b.lastUiReceivedTimestamp.localeCompare(a.lastUiReceivedTimestamp);
  });
});

const summary = computed(() => {
  return {
    total: sortedAgents.value.length,
    running: agentStore.statusCounts.running,
    paused: agentStore.statusCounts.paused,
    error: agentStore.statusCounts.error,
  };
});

const rlStatusText = computed(() => {
  const transport = connectionStore.rl.transport;
  if (!transport) return connectionStore.rl.status;
  return `${connectionStore.rl.status} (${transport})`;
});

const emptyStateText = computed(() => {
  const status = connectionStore.rl.status;
  if (status === "connected" || status === "stale" || status === "reconnecting") {
    return "Waiting for RL agent stream events...";
  }
  return "RL backend is unavailable. Configure RL endpoint(s) to enable live agent telemetry.";
});

function rewardText(agent: AgentSnapshot): string {
  return agent.lastReward === null ? "-" : agent.lastReward.toFixed(3);
}

function actionText(agent: AgentSnapshot): string {
  return agent.lastAction ?? "-";
}
</script>

<template>
  <section class="agents-view" data-testid="agents-view">
    <header class="agents-header">
      <div>
        <h1>Agents</h1>
        <p>Live RL status, objective, and action preview.</p>
      </div>
      <span class="rl-pill" data-testid="agents-rl-status">RL: {{ rlStatusText }}</span>
    </header>

    <section class="summary-grid" data-testid="agents-summary">
      <article>
        <h2>Total</h2>
        <p>{{ summary.total }}</p>
      </article>
      <article>
        <h2>Running</h2>
        <p>{{ summary.running }}</p>
      </article>
      <article>
        <h2>Paused</h2>
        <p>{{ summary.paused }}</p>
      </article>
      <article>
        <h2>Error</h2>
        <p>{{ summary.error }}</p>
      </article>
    </section>

    <section v-if="sortedAgents.length === 0" class="empty-state" data-testid="agents-empty-state">
      {{ emptyStateText }}
    </section>

    <div v-else class="table-wrap">
      <table class="agent-table" data-testid="agents-table">
        <thead>
          <tr>
            <th>Agent</th>
            <th>Status</th>
            <th>Objective</th>
            <th>Policy</th>
            <th>Last Action</th>
            <th>Last Reward</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="agent in sortedAgents" :key="agent.id">
            <td>{{ agent.id }}</td>
            <td>
              <span class="status-chip" :data-status="agent.status">{{ agent.status }}</span>
            </td>
            <td>{{ agent.objective ?? "-" }}</td>
            <td>{{ agent.policyVersion ?? "-" }}</td>
            <td>{{ actionText(agent) }}</td>
            <td>{{ rewardText(agent) }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>

<style scoped>
.agents-view {
  display: grid;
  gap: 1rem;
}

.agents-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 0.75rem;
}

.agents-header h1 {
  margin: 0;
  color: var(--text-strong);
  font-size: 1.25rem;
}

.agents-header p {
  margin: 0.35rem 0 0;
  color: var(--text-muted);
}

.rl-pill {
  padding: 0.25rem 0.6rem;
  border-radius: 999px;
  border: 1px solid var(--panel-border);
  background: var(--chip-bg);
  color: var(--text-strong);
  font-size: 0.78rem;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.65rem;
}

.summary-grid article {
  border: 1px solid var(--panel-border);
  border-radius: 0.65rem;
  background: var(--panel-bg);
  padding: 0.6rem 0.75rem;
}

.summary-grid h2 {
  margin: 0;
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--text-muted);
}

.summary-grid p {
  margin: 0.35rem 0 0;
  color: var(--text-strong);
  font-size: 1.15rem;
  font-weight: 700;
}

.empty-state {
  border: 1px solid var(--panel-border);
  border-radius: 0.65rem;
  background: var(--panel-bg);
  color: var(--text-muted);
  padding: 1rem;
}

.table-wrap {
  overflow: auto;
  border: 1px solid var(--panel-border);
  border-radius: 0.65rem;
  background: var(--panel-bg);
}

.agent-table {
  width: 100%;
  border-collapse: collapse;
}

.agent-table th,
.agent-table td {
  text-align: left;
  padding: 0.6rem 0.7rem;
  border-bottom: 1px solid #d8e4ec;
  font-size: 0.9rem;
}

.agent-table th {
  color: var(--text-muted);
  font-size: 0.74rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.status-chip {
  display: inline-block;
  border-radius: 999px;
  padding: 0.15rem 0.5rem;
  font-size: 0.74rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  border: 1px solid transparent;
}

.status-chip[data-status="running"] {
  background: rgba(40, 192, 95, 0.17);
  border-color: rgba(77, 255, 136, 0.35);
}

.status-chip[data-status="paused"] {
  background: rgba(255, 174, 0, 0.18);
  border-color: rgba(255, 213, 0, 0.4);
}

.status-chip[data-status="error"] {
  background: rgba(220, 67, 67, 0.2);
  border-color: rgba(255, 90, 90, 0.42);
}

.status-chip[data-status="idle"],
.status-chip[data-status="unknown"] {
  background: rgba(126, 147, 161, 0.2);
  border-color: rgba(174, 193, 206, 0.32);
}

@media (max-width: 900px) {
  .summary-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>