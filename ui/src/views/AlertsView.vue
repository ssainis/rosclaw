<script setup lang="ts">
import { computed, ref } from "vue";
import { acknowledgeAlert } from "../services/alerts-safety";
import { useAlertsStore } from "../stores/alerts";

const alertsStore = useAlertsStore();
const severityFilter = ref<"all" | "critical" | "error" | "warning" | "info">("all");
const includeAcknowledged = ref(false);

const filteredAlerts = computed(() => {
  return alertsStore.alerts.filter((alert) => {
    if (severityFilter.value !== "all" && alert.severity !== severityFilter.value) {
      return false;
    }

    if (!includeAcknowledged.value && alert.acknowledged) {
      return false;
    }

    return true;
  });
});

const summaryCards = computed(() => {
  const total = alertsStore.alerts.length;
  const open = alertsStore.unacknowledgedCount;
  const critical = alertsStore.criticalCount;

  return [
    {
      id: "total",
      title: "Total Alerts",
      value: `${total}`,
      detail: `${open} open`,
    },
    {
      id: "critical",
      title: "Critical",
      value: `${critical}`,
      detail: critical > 0 ? "Immediate intervention needed" : "No critical alerts",
    },
    {
      id: "ack",
      title: "Acknowledged",
      value: `${Math.max(0, total - open)}`,
      detail: "Operator-reviewed events",
    },
  ];
});

function acknowledge(alertId: string, traceId: string | null): void {
  acknowledgeAlert({
    alertId,
    traceId,
    message: "Acknowledged from alerts panel",
  });
}
</script>

<template>
  <section class="alerts-view" data-testid="alerts-view">
    <header class="alerts-header">
      <div>
        <h1>Alerts and Safety</h1>
        <p>Critical alert visibility and explicit acknowledgment flow.</p>
      </div>
    </header>

    <section class="summary-grid" data-testid="alerts-summary">
      <article v-for="card in summaryCards" :key="card.id" :data-testid="`alerts-summary-${card.id}`">
        <h2>{{ card.title }}</h2>
        <p>{{ card.value }}</p>
        <small>{{ card.detail }}</small>
      </article>
    </section>

    <section class="filters" data-testid="alerts-filters">
      <label>
        <span>Severity</span>
        <select v-model="severityFilter" data-testid="alerts-filter-severity">
          <option value="all">All</option>
          <option value="critical">critical</option>
          <option value="error">error</option>
          <option value="warning">warning</option>
          <option value="info">info</option>
        </select>
      </label>
      <label class="toggle-row">
        <input v-model="includeAcknowledged" data-testid="alerts-filter-ack" type="checkbox" />
        <span>Include acknowledged alerts</span>
      </label>
    </section>

    <article class="panel" data-testid="alerts-list-panel">
      <p v-if="filteredAlerts.length === 0" class="empty" data-testid="alerts-empty">
        No alerts match the current filter.
      </p>

      <ul v-else class="alert-list" data-testid="alerts-list">
        <li v-for="alert in filteredAlerts" :key="alert.id">
          <div class="alert-main">
            <span class="severity" :data-severity="alert.severity">{{ alert.severity }}</span>
            <strong>{{ alert.message }}</strong>
            <small>{{ alert.source }} | {{ alert.updatedAt }}</small>
            <small>trace: {{ alert.traceId ?? "-" }}</small>
          </div>

          <button
            v-if="!alert.acknowledged"
            type="button"
            class="ack-button"
            :data-testid="`alerts-ack-${alert.id}`"
            @click="acknowledge(alert.id, alert.traceId)"
          >
            Acknowledge
          </button>
          <span v-else class="ack-pill">Acknowledged</span>
        </li>
      </ul>
    </article>
  </section>
</template>

<style scoped>
.alerts-view {
  display: grid;
  gap: 0.9rem;
}

.alerts-header h1 {
  margin: 0;
  color: var(--text-strong);
  font-size: 1.25rem;
}

.alerts-header p {
  margin: 0.35rem 0 0;
  color: var(--text-muted);
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.65rem;
}

.summary-grid article {
  border: 1px solid var(--panel-border);
  border-radius: 0.65rem;
  background: var(--panel-bg);
  padding: 0.65rem 0.75rem;
}

.summary-grid h2 {
  margin: 0;
  color: var(--text-muted);
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.summary-grid p {
  margin: 0.35rem 0 0;
  color: var(--text-strong);
  font-size: 1.15rem;
  font-weight: 700;
}

.summary-grid small {
  color: var(--text-muted);
}

.filters {
  display: flex;
  align-items: center;
  gap: 0.85rem;
  flex-wrap: wrap;
}

.filters label {
  display: grid;
  gap: 0.2rem;
}

.filters span {
  color: var(--text-muted);
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.filters select {
  border: 1px solid var(--panel-border);
  border-radius: 0.45rem;
  padding: 0.4rem 0.45rem;
}

.toggle-row {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.panel {
  border: 1px solid var(--panel-border);
  border-radius: 0.65rem;
  background: var(--panel-bg);
  padding: 0.75rem;
}

.empty {
  margin: 0;
  color: var(--text-muted);
}

.alert-list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: grid;
  gap: 0.55rem;
}

.alert-list li {
  border: 1px solid var(--panel-border);
  border-radius: 0.45rem;
  background: #ffffff;
  padding: 0.55rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.7rem;
}

.alert-main {
  display: grid;
  gap: 0.18rem;
}

.severity {
  text-transform: uppercase;
  letter-spacing: 0.04em;
  font-size: 0.72rem;
  color: var(--text-muted);
}

.severity[data-severity="critical"] {
  color: #9b1c1c;
}

.severity[data-severity="error"] {
  color: #b35e13;
}

.severity[data-severity="warning"] {
  color: #8a6a00;
}

.alert-main strong {
  color: var(--text-strong);
}

.alert-main small {
  color: var(--text-muted);
}

.ack-button {
  border: 1px solid #1f6f8f;
  border-radius: 0.4rem;
  background: #2b83b5;
  color: #fff;
  padding: 0.35rem 0.55rem;
  cursor: pointer;
  white-space: nowrap;
}

.ack-pill {
  border: 1px solid var(--panel-border);
  border-radius: 999px;
  padding: 0.2rem 0.55rem;
  color: var(--text-muted);
  font-size: 0.75rem;
  text-transform: uppercase;
}

@media (max-width: 1024px) {
  .summary-grid {
    grid-template-columns: 1fr;
  }

  .alert-list li {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
