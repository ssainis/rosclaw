<script setup lang="ts">
import { computed, ref } from "vue";
import { useTimelineStore } from "../stores/timeline";

const timelineStore = useTimelineStore();

const query = ref("");
const sourceFilter = ref<"all" | "rosbridge" | "rl-ws" | "rl-rest" | "operator">("all");
const selectedTrace = ref<string>("all");

const filteredEvents = computed(() => {
  const needle = query.value.trim().toLowerCase();

  return timelineStore.events.filter((event) => {
    if (sourceFilter.value !== "all" && event.source !== sourceFilter.value) {
      return false;
    }

    if (selectedTrace.value !== "all" && event.traceId !== selectedTrace.value) {
      return false;
    }

    if (!needle) return true;

    const haystack = [
      event.eventType,
      event.entityType,
      event.entityId,
      event.source,
      event.traceId ?? "",
      event.payloadPreview,
    ]
      .join(" ")
      .toLowerCase();

    return haystack.includes(needle);
  });
});

const traceOptions = computed(() => ["all", ...timelineStore.traceIds]);

const traceCorrelatedEvents = computed(() => {
  if (selectedTrace.value === "all") return [];
  return timelineStore.events.filter((event) => event.traceId === selectedTrace.value);
});

function focusTrace(traceId: string | null): void {
  if (!traceId) return;
  selectedTrace.value = traceId;
}
</script>

<template>
  <section class="timeline-view" data-testid="timeline-view">
    <header class="timeline-header">
      <div>
        <h1>Mission Timeline</h1>
        <p>Unified event list with source filtering and trace-based correlation.</p>
      </div>
      <span class="count-pill" data-testid="timeline-count">{{ filteredEvents.length }} events</span>
    </header>

    <section class="filters" data-testid="timeline-filters">
      <label>
        <span>Search</span>
        <input v-model="query" data-testid="timeline-filter-query" type="text" placeholder="event, entity, trace" />
      </label>
      <label>
        <span>Source</span>
        <select v-model="sourceFilter" data-testid="timeline-filter-source">
          <option value="all">All</option>
          <option value="rosbridge">rosbridge</option>
          <option value="rl-ws">rl-ws</option>
          <option value="rl-rest">rl-rest</option>
          <option value="operator">operator</option>
        </select>
      </label>
      <label>
        <span>Trace</span>
        <select v-model="selectedTrace" data-testid="timeline-filter-trace">
          <option v-for="trace in traceOptions" :key="trace" :value="trace">
            {{ trace === "all" ? "All traces" : trace }}
          </option>
        </select>
      </label>
    </section>

    <section class="timeline-grid">
      <article class="panel" data-testid="timeline-events-panel">
        <header>
          <h2>Event Stream</h2>
          <p>Newest first; click a row to focus its trace.</p>
        </header>

        <p v-if="filteredEvents.length === 0" class="empty" data-testid="timeline-empty">
          No events match the current filters.
        </p>

        <div v-else class="table-wrap">
          <table class="events-table" data-testid="timeline-events-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Source</th>
                <th>Event</th>
                <th>Entity</th>
                <th>Trace</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="event in filteredEvents.slice(0, 120)" :key="event.id" @click="focusTrace(event.traceId)">
                <td>{{ event.timestampUiReceived }}</td>
                <td>{{ event.source }}</td>
                <td>{{ event.eventType }}</td>
                <td>{{ event.entityType }}:{{ event.entityId }}</td>
                <td>{{ event.traceId ?? "-" }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </article>

      <article class="panel" data-testid="timeline-trace-panel">
        <header>
          <h2>Trace Correlation</h2>
          <p>Events grouped by the selected trace id.</p>
        </header>

        <p v-if="selectedTrace === 'all'" class="empty" data-testid="timeline-trace-empty">
          Select a trace from the table or filter dropdown.
        </p>

        <div v-else>
          <p class="trace-label">Trace: {{ selectedTrace }}</p>
          <p v-if="traceCorrelatedEvents.length === 0" class="empty">
            No events found for this trace.
          </p>
          <ul v-else class="trace-list" data-testid="timeline-trace-list">
            <li v-for="event in traceCorrelatedEvents" :key="event.id">
              <strong>{{ event.eventType }}</strong>
              <span>{{ event.source }} | {{ event.entityType }}:{{ event.entityId }}</span>
              <code>{{ event.payloadPreview }}</code>
            </li>
          </ul>
        </div>
      </article>
    </section>
  </section>
</template>

<style scoped>
.timeline-view {
  display: grid;
  gap: 0.9rem;
}

.timeline-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 0.7rem;
}

.timeline-header h1 {
  margin: 0;
  color: var(--text-strong);
  font-size: 1.25rem;
}

.timeline-header p {
  margin: 0.35rem 0 0;
  color: var(--text-muted);
}

.count-pill {
  border: 1px solid var(--panel-border);
  border-radius: 999px;
  padding: 0.25rem 0.6rem;
  background: var(--chip-bg);
  color: var(--text-strong);
  text-transform: uppercase;
  letter-spacing: 0.03em;
  font-size: 0.77rem;
}

.filters {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.6rem;
}

.filters label {
  display: grid;
  gap: 0.25rem;
}

.filters span {
  font-size: 0.78rem;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.filters input,
.filters select {
  border: 1px solid var(--panel-border);
  border-radius: 0.45rem;
  padding: 0.45rem 0.5rem;
  font: inherit;
}

.timeline-grid {
  display: grid;
  grid-template-columns: 1.6fr 1fr;
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
  margin: 0.25rem 0 0;
  color: var(--text-muted);
}

.empty {
  margin: 0.7rem 0 0;
  color: var(--text-muted);
}

.table-wrap {
  margin-top: 0.7rem;
  overflow: auto;
}

.events-table {
  width: 100%;
  border-collapse: collapse;
}

.events-table th,
.events-table td {
  text-align: left;
  font-size: 0.83rem;
  border-bottom: 1px solid #d8e4ec;
  padding: 0.4rem 0.45rem;
}

.events-table tbody tr {
  cursor: pointer;
}

.events-table tbody tr:hover {
  background: #f2f8fc;
}

.trace-label {
  margin: 0.7rem 0 0;
  color: var(--text-strong);
}

.trace-list {
  margin: 0.6rem 0 0;
  padding: 0;
  list-style: none;
  display: grid;
  gap: 0.5rem;
}

.trace-list li {
  border: 1px solid var(--panel-border);
  border-radius: 0.45rem;
  padding: 0.5rem;
  display: grid;
  gap: 0.2rem;
  background: #ffffff;
}

.trace-list span {
  color: var(--text-muted);
  font-size: 0.82rem;
}

.trace-list code {
  background: #eef5fa;
  border-radius: 0.3rem;
  padding: 0.2rem 0.3rem;
  font-size: 0.75rem;
}

@media (max-width: 1024px) {
  .filters {
    grid-template-columns: 1fr;
  }

  .timeline-grid {
    grid-template-columns: 1fr;
  }
}
</style>
