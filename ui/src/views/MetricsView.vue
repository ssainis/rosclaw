<script setup lang="ts">
import { computed } from "vue";
import { useAgentStore } from "../stores/agent";
import { useConnectionStore } from "../stores/connection";
import { useControlStore, type ControlActionRecord } from "../stores/control";
import { decimateSeriesForDisplay } from "../core/perf/list-utils";

const connectionStore = useConnectionStore();
const agentStore = useAgentStore();
const controlStore = useControlStore();

const rlStatusText = computed(() => {
  const transport = connectionStore.rl.transport;
  if (!transport) return connectionStore.rl.status;
  return `${connectionStore.rl.status} (${transport})`;
});

const sortedAgents = computed(() => {
  return [...agentStore.agents].sort((left, right) => left.id.localeCompare(right.id));
});

// Raw reward samples (full fidelity) used for statistics and count display.
const rawRewardSamples = computed(() =>
  sortedAgents.value.flatMap((agent) =>
    agent.rewardSeries.map((value, index) => ({
      key: `${agent.id}-${index}`,
      agentId: agent.id,
      value,
    })),
  ),
);

const averageReward = computed(() => {
  if (rawRewardSamples.value.length === 0) return null;
  const total = rawRewardSamples.value.reduce((sum, sample) => sum + sample.value, 0);
  return total / rawRewardSamples.value.length;
});

const actionHistogram = computed(() => {
  const counts: Record<string, number> = {};
  for (const agent of sortedAgents.value) {
    for (const [action, count] of Object.entries(agent.actionCounts)) {
      counts[action] = (counts[action] ?? 0) + count;
    }
  }

  return Object.entries(counts)
    .map(([action, count]) => ({ action, count }))
    .sort((left, right) => right.count - left.count)
    .slice(0, 8);
});

const maxActionCount = computed(() => {
  return actionHistogram.value.reduce((max, entry) => Math.max(max, entry.count), 1);
});

const completedControlActions = computed(() => {
  return controlStore.history.filter((entry) => entry.status !== "pending");
});

const commandSuccessRate = computed(() => {
  const completed = completedControlActions.value;
  if (completed.length === 0) return null;

  const succeeded = completed.filter((entry) => entry.status === "succeeded").length;
  return (succeeded / completed.length) * 100;
});

function actionLatencyMs(entry: ControlActionRecord): number | null {
  if (!entry.completedAt) return null;

  const started = Date.parse(entry.submittedAt);
  const ended = Date.parse(entry.completedAt);
  if (Number.isNaN(started) || Number.isNaN(ended)) return null;

  return Math.max(0, ended - started);
}

const latencySamples = computed(() => {
  return completedControlActions.value
    .map((entry) => ({
      id: entry.actionId,
      label: entry.label,
      status: entry.status,
      latencyMs: actionLatencyMs(entry),
    }))
    .filter((entry): entry is { id: string; label: string; status: "succeeded" | "failed"; latencyMs: number } => {
      return entry.latencyMs !== null;
    });
});

function percentile(values: number[], ratio: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(sorted.length - 1, Math.floor(ratio * sorted.length));
  return sorted[index] ?? null;
}

const p95LatencyMs = computed(() => percentile(latencySamples.value.map((sample) => sample.latencyMs), 0.95));

const summaryCards = computed(() => {
  return [
    {
      id: "samples",
      title: "Reward Samples",
      value: `${rawRewardSamples.value.length}`,
      detail: `${sortedAgents.value.length} active agents`,
    },
    {
      id: "avg-reward",
      title: "Average Reward",
      value: averageReward.value === null ? "-" : averageReward.value.toFixed(3),
      detail: "Rolling stream window",
    },
    {
      id: "success",
      title: "Command Success",
      value: commandSuccessRate.value === null ? "-" : `${commandSuccessRate.value.toFixed(1)}%`,
      detail: `${completedControlActions.value.length} completed actions`,
    },
    {
      id: "latency",
      title: "P95 Latency",
      value: p95LatencyMs.value === null ? "-" : `${p95LatencyMs.value} ms`,
      detail: "Control service round-trip",
    },
  ];
});
</script>

<template>
  <section class="metrics-view" data-testid="metrics-view">
    <header class="metrics-header">
      <div>
        <h1>Metrics and Rewards</h1>
        <p>Reward trends, action histogram, and control latency from shared domain stores.</p>
      </div>
      <span class="rl-pill" data-testid="metrics-rl-status">RL: {{ rlStatusText }}</span>
    </header>

    <section class="summary-grid" data-testid="metrics-summary">
      <article
        v-for="card in summaryCards"
        :key="card.id"
        class="summary-card"
        :data-testid="`metrics-summary-${card.id}`"
      >
        <h2>{{ card.title }}</h2>
        <p>{{ card.value }}</p>
        <small>{{ card.detail }}</small>
      </article>
    </section>

    <section class="metrics-grid">
      <article class="panel" data-testid="metrics-reward-trends">
        <header>
          <h2>Reward Trends</h2>
          <p>Recent reward samples per agent (rolling window).</p>
        </header>

        <p v-if="sortedAgents.length === 0" class="empty" data-testid="metrics-reward-empty">
          Waiting for RL reward streams.
        </p>

        <ul v-else class="reward-list">
          <li v-for="agent in sortedAgents" :key="agent.id">
            <div class="reward-row-header">
              <strong>{{ agent.id }}</strong>
              <span>latest: {{ agent.lastReward === null ? "-" : agent.lastReward.toFixed(3) }}</span>
            </div>
            <div class="sparkline" :data-testid="`metrics-spark-${agent.id}`">
              <span
                v-for="(sample, index) in decimateSeriesForDisplay(agent.rewardSeries, 20)"
                :key="`${agent.id}-${index}`"
                class="spark-bar"
                :style="{ height: `${Math.min(100, Math.max(10, Math.abs(sample) * 18))}%` }"
              />
            </div>
          </li>
        </ul>
      </article>

      <article class="panel" data-testid="metrics-action-histogram">
        <header>
          <h2>Action Histogram</h2>
          <p>Most frequent RL actions across active agents.</p>
        </header>

        <p v-if="actionHistogram.length === 0" class="empty" data-testid="metrics-actions-empty">
          No action events have been observed.
        </p>

        <ul v-else class="histogram-list">
          <li v-for="entry in actionHistogram" :key="entry.action">
            <span class="action-name">{{ entry.action }}</span>
            <div class="bar-track">
              <span
                class="bar-fill"
                :style="{ width: `${Math.round((entry.count / maxActionCount) * 100)}%` }"
              />
            </div>
            <span class="action-count">{{ entry.count }}</span>
          </li>
        </ul>
      </article>

      <article class="panel" data-testid="metrics-latency-panel">
        <header>
          <h2>Control Latency</h2>
          <p>Recent control service completion times.</p>
        </header>

        <p v-if="latencySamples.length === 0" class="empty" data-testid="metrics-latency-empty">
          No completed control actions yet.
        </p>

        <table v-else class="latency-table" data-testid="metrics-latency-table">
          <thead>
            <tr>
              <th>Action</th>
              <th>Status</th>
              <th>Latency</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="sample in latencySamples.slice(0, 8)" :key="sample.id">
              <td>{{ sample.label }}</td>
              <td>{{ sample.status }}</td>
              <td>{{ sample.latencyMs }} ms</td>
            </tr>
          </tbody>
        </table>
      </article>
    </section>
  </section>
</template>

<style scoped>
.metrics-view {
  display: grid;
  gap: 1rem;
}

.metrics-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 0.75rem;
}

.metrics-header h1 {
  margin: 0;
  color: var(--text-strong);
  font-size: 1.25rem;
}

.metrics-header p {
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

.summary-card {
  border: 1px solid var(--panel-border);
  border-radius: 0.65rem;
  background: var(--panel-bg);
  padding: 0.65rem 0.75rem;
}

.summary-card h2 {
  margin: 0;
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--text-muted);
}

.summary-card p {
  margin: 0.35rem 0 0;
  color: var(--text-strong);
  font-size: 1.1rem;
  font-weight: 700;
}

.summary-card small {
  color: var(--text-muted);
}

.metrics-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.8rem;
}

.panel {
  border: 1px solid var(--panel-border);
  border-radius: 0.65rem;
  background: var(--panel-bg);
  padding: 0.75rem;
}

.panel header h2 {
  margin: 0;
  font-size: 1rem;
  color: var(--text-strong);
}

.panel header p {
  margin: 0.3rem 0 0;
  color: var(--text-muted);
}

.empty {
  margin: 0.75rem 0 0;
  color: var(--text-muted);
}

.reward-list {
  margin: 0.7rem 0 0;
  padding: 0;
  list-style: none;
  display: grid;
  gap: 0.6rem;
}

.reward-row-header {
  display: flex;
  justify-content: space-between;
  color: var(--text-muted);
  font-size: 0.85rem;
}

.sparkline {
  margin-top: 0.35rem;
  height: 3.6rem;
  border: 1px solid var(--panel-border);
  border-radius: 0.45rem;
  background: #ffffff;
  display: flex;
  align-items: flex-end;
  gap: 0.14rem;
  padding: 0.25rem;
  overflow: hidden;
}

.spark-bar {
  width: 0.32rem;
  border-radius: 0.2rem 0.2rem 0 0;
  background: linear-gradient(180deg, #1c88b5, #0e546f);
}

.histogram-list {
  margin: 0.75rem 0 0;
  padding: 0;
  list-style: none;
  display: grid;
  gap: 0.45rem;
}

.histogram-list li {
  display: grid;
  grid-template-columns: 10rem 1fr auto;
  gap: 0.45rem;
  align-items: center;
}

.action-name {
  font-size: 0.86rem;
  color: var(--text-strong);
}

.bar-track {
  height: 0.55rem;
  border-radius: 999px;
  background: #e8f2f8;
  overflow: hidden;
}

.bar-fill {
  display: block;
  height: 100%;
  background: linear-gradient(90deg, #2b83b5, #66afcf);
}

.action-count {
  min-width: 2ch;
  text-align: right;
  color: var(--text-muted);
}

.latency-table {
  width: 100%;
  margin-top: 0.65rem;
  border-collapse: collapse;
}

.latency-table th,
.latency-table td {
  text-align: left;
  padding: 0.45rem 0.5rem;
  font-size: 0.86rem;
  border-bottom: 1px solid #d8e4ec;
}

@media (max-width: 1024px) {
  .summary-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .metrics-grid {
    grid-template-columns: 1fr;
  }

  .histogram-list li {
    grid-template-columns: 1fr;
  }
}
</style>
