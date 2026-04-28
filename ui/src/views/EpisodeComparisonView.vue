<script setup lang="ts">
import { ref, computed } from "vue";
import { useSessionCaptureStore } from "../stores/session-capture";
import { analyzeEpisodeComparison } from "../services/episode-analysis";
import type { EpisodeComparisonResult } from "../services/episode-analysis";

const captureStore = useSessionCaptureStore();

const selectedBase = ref<string | null>(null);
const selectedComparison = ref<string | null>(null);
const comparisonResult = ref<EpisodeComparisonResult | null>(null);
const error = ref<string | null>(null);

const baseSession = computed(() => {
  if (selectedBase.value === "loaded" && captureStore.loadedSession) {
    return captureStore.loadedSession;
  }
  return null;
});

const comparisonSession = computed(() => {
  if (selectedComparison.value === "loaded" && captureStore.loadedSession) {
    return captureStore.loadedSession;
  }
  return null;
});

function runComparison() {
  error.value = null;
  comparisonResult.value = null;

  if (!baseSession.value || !comparisonSession.value) {
    error.value = "Please select both base and comparison sessions.";
    return;
  }

  if (baseSession.value === comparisonSession.value && selectedBase.value === selectedComparison.value) {
    error.value = "Base and comparison sessions must be different.";
    return;
  }

  try {
    comparisonResult.value = analyzeEpisodeComparison(baseSession.value, comparisonSession.value);
  } catch (err) {
    error.value = String(err);
  }
}

const severityClass = (severity: string) => `severity-${severity}`;
</script>

<template>
  <div class="episode-comparison-view">
    <h1>Episode Comparison & Analysis</h1>
    <p class="view-subtitle">Compare two replay sessions to identify deltas and anomalies.</p>

    <section class="panel" aria-label="Comparison setup">
      <h2>Setup comparison</h2>
      <p v-if="!captureStore.loadedSession" class="hint">
        Load a session in the Replay view first to enable comparison.
      </p>
      <div v-else class="setup-form">
        <div class="session-selector">
          <label for="base-select">Base session:</label>
          <select id="base-select" v-model="selectedBase">
            <option value="">-- Select --</option>
            <option value="loaded">{{ captureStore.loadedSession?.metadata.label }} (loaded)</option>
          </select>
        </div>

        <div class="session-selector">
          <label for="comp-select">Comparison session:</label>
          <select id="comp-select" v-model="selectedComparison">
            <option value="">-- Select --</option>
            <option value="loaded">{{ captureStore.loadedSession?.metadata.label }} (loaded)</option>
          </select>
        </div>

        <button class="btn btn-analyze" @click="runComparison" aria-label="Run comparison analysis">
          Run analysis
        </button>

        <p v-if="error" class="error" role="alert">{{ error }}</p>
      </div>
    </section>

    <section v-if="comparisonResult" class="panel" aria-label="Comparison results">
      <h2>Results</h2>

      <div class="sessions-summary">
        <div class="session-card">
          <strong>Base:</strong> {{ comparisonResult.baseSession.label }}
          <br /><span class="meta">{{ comparisonResult.metrics.baseEventCount }} events</span>
        </div>
        <div class="vs">vs</div>
        <div class="session-card">
          <strong>Comparison:</strong> {{ comparisonResult.comparisonSession.label }}
          <br /><span class="meta">{{ comparisonResult.metrics.comparisonEventCount }} events</span>
        </div>
      </div>

      <!-- Metrics cards -->
      <div class="metrics-grid">
        <div class="metric-card">
          <span class="label">Reward average</span>
          <div class="values">
            <span class="base">{{ comparisonResult.metrics.baseRewardAvg.toFixed(2) }}</span>
            <span class="arrow">→</span>
            <span class="comp">{{ comparisonResult.metrics.comparisonRewardAvg.toFixed(2) }}</span>
          </div>
          <span class="delta" :class="{ positive: comparisonResult.metrics.rewardDelta >= 0 }">
            {{ comparisonResult.metrics.rewardDelta >= 0 ? "+" : "" }}
            {{ comparisonResult.metrics.rewardDelta.toFixed(2) }}
            ({{ comparisonResult.metrics.rewardDeltaPercent.toFixed(1) }}%)
          </span>
        </div>

        <div class="metric-card">
          <span class="label">Action count</span>
          <div class="values">
            <span class="base">{{ comparisonResult.metrics.baseActionCount }}</span>
            <span class="arrow">→</span>
            <span class="comp">{{ comparisonResult.metrics.comparisonActionCount }}</span>
          </div>
          <span class="delta" :class="{ positive: comparisonResult.metrics.baseActionCount <= comparisonResult.metrics.comparisonActionCount }">
            {{ comparisonResult.metrics.actionCountDelta >= 0 ? "+" : "" }}{{ comparisonResult.metrics.actionCountDelta }}
          </span>
        </div>

        <div class="metric-card">
          <span class="label">Event count</span>
          <div class="values">
            <span class="base">{{ comparisonResult.metrics.baseEventCount }}</span>
            <span class="arrow">→</span>
            <span class="comp">{{ comparisonResult.metrics.comparisonEventCount }}</span>
          </div>
          <span class="delta" :class="{ positive: comparisonResult.metrics.baseEventCount <= comparisonResult.metrics.comparisonEventCount }">
            {{ comparisonResult.metrics.eventCountDelta >= 0 ? "+" : "" }}{{ comparisonResult.metrics.eventCountDelta }}
          </span>
        </div>

        <div class="metric-card">
          <span class="label">Sequence divergence</span>
          <span class="large-value">{{ comparisonResult.metrics.sequenceDelta }}</span>
          <span class="meta">differences detected</span>
        </div>
      </div>

      <!-- Recommendation -->
      <div class="recommendation-box">
        <strong>Recommendation:</strong> {{ comparisonResult.recommendation }}
      </div>

      <!-- Anomalies -->
      <div v-if="comparisonResult.anomalies.length > 0" class="anomalies-section" aria-label="Detected anomalies">
        <h3>Anomalies detected ({{ comparisonResult.anomalies.length }})</h3>
        <div class="anomalies-list">
          <div
            v-for="(anomaly, idx) in comparisonResult.anomalies"
            :key="idx"
            class="anomaly-item"
            :class="`severity-${anomaly.severity}`"
          >
            <span class="badge" :class="`badge-${anomaly.severity}`">{{ anomaly.severity.toUpperCase() }}</span>
            <span class="message">{{ anomaly.message }}</span>
          </div>
        </div>
      </div>
      <div v-else class="no-anomalies">✓ No significant anomalies detected.</div>
    </section>
  </div>
</template>

<style scoped>
.episode-comparison-view {
  padding: var(--space-md, 1rem);
  display: flex;
  flex-direction: column;
  gap: var(--space-md, 1rem);
}
h1 { margin: 0 0 0.25rem; font-size: 1.4rem; }
.view-subtitle { margin: 0 0 0.5rem; color: var(--color-text-secondary, #888); font-size: 0.9rem; }
.panel {
  background: var(--color-surface, #1e1e2e);
  border: 1px solid var(--color-border, #333);
  border-radius: 6px;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}
.panel h2 { margin: 0; font-size: 1rem; }
.panel h3 { margin: 0.5rem 0 0.25rem; font-size: 0.95rem; }
.hint { color: var(--color-text-secondary, #aaa); font-size: 0.85rem; margin: 0; }
.setup-form { display: flex; flex-direction: column; gap: 0.5rem; }
.session-selector { display: flex; flex-direction: column; gap: 0.25rem; }
.session-selector label { font-size: 0.8rem; color: var(--color-text-secondary, #aaa); }
.session-selector select {
  padding: 0.35rem 0.5rem;
  background: var(--color-bg, #12121a);
  border: 1px solid var(--color-border, #444);
  border-radius: 4px;
  color: inherit;
}
.btn { padding: 0.35rem 0.85rem; border-radius: 4px; border: none; cursor: pointer; font-size: 0.85rem; font-weight: 500; }
.btn-analyze { background: #3b82f6; color: #fff; }
.error { color: #f87171; font-size: 0.85rem; margin: 0; }

.sessions-summary {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin: 0.5rem 0;
}
.session-card {
  background: var(--color-bg, #12121a);
  border-radius: 4px;
  padding: 0.5rem;
  font-size: 0.85rem;
  flex: 1;
}
.session-card .meta { color: var(--color-text-secondary, #aaa); font-size: 0.75rem; }
.vs { font-weight: 600; color: #888; }

.metrics-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 0.75rem;
  margin: 0.75rem 0;
}
.metric-card {
  background: var(--color-bg, #12121a);
  border-radius: 4px;
  padding: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}
.metric-card .label { font-size: 0.75rem; color: var(--color-text-secondary, #aaa); font-weight: 600; }
.metric-card .values { display: flex; align-items: center; gap: 0.5rem; font-size: 0.9rem; }
.values .base { color: #888; }
.values .arrow { color: #666; }
.values .comp { color: #fff; }
.metric-card .delta { font-size: 0.85rem; font-weight: 600; }
.delta.positive { color: #22c55e; }
.delta:not(.positive) { color: #f87171; }
.metric-card .large-value { font-size: 1.5rem; font-weight: 600; }
.metric-card .meta { font-size: 0.75rem; color: var(--color-text-secondary, #aaa); }

.recommendation-box {
  background: var(--color-bg, #12121a);
  border-radius: 4px;
  padding: 0.75rem;
  font-size: 0.9rem;
  line-height: 1.4;
}

.anomalies-section { margin-top: 0.75rem; }
.anomalies-list { display: flex; flex-direction: column; gap: 0.5rem; }
.anomaly-item {
  background: var(--color-bg, #12121a);
  border-radius: 4px;
  padding: 0.75rem;
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  font-size: 0.85rem;
}
.anomaly-item.severity-error { border-left: 3px solid #f87171; }
.anomaly-item.severity-warning { border-left: 3px solid #f59e0b; }
.anomaly-item.severity-info { border-left: 3px solid #3b82f6; }
.badge { font-size: 0.7rem; font-weight: 700; padding: 0.2rem 0.4rem; border-radius: 2px; }
.badge-error { background: #f87171; color: #000; }
.badge-warning { background: #f59e0b; color: #000; }
.badge-info { background: #3b82f6; color: #fff; }
.message { flex: 1; }

.no-anomalies { color: #22c55e; font-size: 0.85rem; margin-top: 0.5rem; }
</style>
