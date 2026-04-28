<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import { ensureRosbridgeConnection, getRosbridgeClient } from "../services/rosbridge-connection";
import {
  refreshTopicCatalog,
  subscribeToTopic,
  teardownTopicExplorer,
  unsubscribeFromTopic,
} from "../services/topic-explorer";
import { useConnectionStore } from "../stores/connection";
import { useTopicStore } from "../stores/topic";

const connectionStore = useConnectionStore();
const topicStore = useTopicStore();

const filterText = ref("");
const isLoading = ref(false);
const loadError = ref<string | null>(null);

const rosbridgeStatusText = computed(() => {
  const transport = connectionStore.rosbridge.transport;
  if (!transport) return connectionStore.rosbridge.status;
  return `${connectionStore.rosbridge.status} (${transport})`;
});

const filteredTopics = computed(() => {
  const query = filterText.value.trim().toLowerCase();
  if (!query) return topicStore.topics;

  return topicStore.topics.filter((topic) => {
    return [topic.name, topic.namespace, topic.type].some((value) => value.toLowerCase().includes(query));
  });
});

const selectedTopic = computed(() => topicStore.selectedTopic);
const selectedMessages = computed(() => topicStore.selectedTopicMessages);
const latestMessage = computed(() => selectedMessages.value[0] ?? null);

async function loadTopics(): Promise<void> {
  const client = getRosbridgeClient() ?? ensureRosbridgeConnection();

  isLoading.value = true;
  loadError.value = null;

  try {
    await refreshTopicCatalog(client);

    if (!selectedTopic.value && topicStore.topics.length > 0) {
      topicStore.setSelectedTopic(topicStore.topics[0].name);
    }
  } catch (error) {
    loadError.value = error instanceof Error ? error.message : "Failed to load topics";
  } finally {
    isLoading.value = false;
  }
}

function selectTopic(topicName: string): void {
  topicStore.setSelectedTopic(topicName);
}

function toggleSubscription(topicName: string, topicType: string, isSubscribed: boolean): void {
  const client = getRosbridgeClient();
  if (!client) {
    loadError.value = "Rosbridge client is unavailable";
    return;
  }

  if (isSubscribed) {
    unsubscribeFromTopic(topicName);
    return;
  }

  subscribeToTopic(client, topicName, topicType);
}

onMounted(() => {
  void loadTopics();
});

onUnmounted(() => {
  teardownTopicExplorer();
});
</script>

<template>
  <section class="topics-view" data-testid="topics-view">
    <header class="topics-header">
      <div>
        <h1>Topics and Messages</h1>
        <p>Discover ROS topics, subscribe live, and inspect payloads without leaving the dashboard.</p>
      </div>

      <div class="header-actions">
        <span class="status-pill" data-testid="topics-rosbridge-status">
          rosbridge: {{ rosbridgeStatusText }}
        </span>
        <button type="button" class="refresh-button" :disabled="isLoading" @click="loadTopics">
          {{ isLoading ? "Refreshing..." : "Refresh topics" }}
        </button>
      </div>
    </header>

    <section class="summary-grid" data-testid="topics-summary">
      <article>
        <h2>Discovered</h2>
        <p>{{ topicStore.topics.length }}</p>
      </article>
      <article>
        <h2>Subscribed</h2>
        <p>{{ topicStore.subscribedTopicCount }}</p>
      </article>
      <article>
        <h2>Selected</h2>
        <p>{{ selectedTopic?.name ?? "-" }}</p>
      </article>
    </section>

    <section class="workspace-grid">
      <article class="catalog-panel">
        <label class="filter-field" for="topic-filter">
          <span>Filter topics</span>
          <input id="topic-filter" v-model="filterText" data-testid="topics-filter" type="search" placeholder="Filter by name, namespace, or type" />
        </label>

        <p v-if="loadError" class="load-error" data-testid="topics-load-error">{{ loadError }}</p>

        <p v-if="!isLoading && filteredTopics.length === 0" class="empty-state" data-testid="topics-empty-state">
          No topics match the current filter.
        </p>

        <div v-else class="table-wrap">
          <table class="topics-table" data-testid="topics-table">
            <thead>
              <tr>
                <th>Topic</th>
                <th>Namespace</th>
                <th>Type</th>
                <th>State</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="topic in filteredTopics"
                :key="topic.name"
                :data-active="selectedTopic?.name === topic.name"
                @click="selectTopic(topic.name)"
              >
                <td>{{ topic.name }}</td>
                <td>{{ topic.namespace }}</td>
                <td>{{ topic.type }}</td>
                <td>
                  <button
                    type="button"
                    class="subscription-button"
                    :data-testid="`topic-toggle-${topic.name.replaceAll('/', '_')}`"
                    @click.stop="toggleSubscription(topic.name, topic.type, topic.isSubscribed)"
                  >
                    {{ topic.isSubscribed ? "Unsubscribe" : "Subscribe" }}
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </article>

      <article class="viewer-panel" data-testid="topic-message-viewer">
        <template v-if="selectedTopic">
          <header class="viewer-header">
            <div>
              <h2>{{ selectedTopic.name }}</h2>
              <p>{{ selectedTopic.type }} · {{ selectedTopic.messageCount }} message(s)</p>
            </div>
            <span class="viewer-chip" :data-subscribed="selectedTopic.isSubscribed">
              {{ selectedTopic.isSubscribed ? "Live" : "Idle" }}
            </span>
          </header>

          <p v-if="selectedMessages.length === 0" class="empty-state">
            {{ selectedTopic.isSubscribed ? "Waiting for topic messages..." : "Subscribe to start streaming payloads." }}
          </p>

          <template v-else>
            <dl class="message-meta">
              <div>
                <dt>Event</dt>
                <dd>{{ latestMessage?.eventType }}</dd>
              </div>
              <div>
                <dt>Source time</dt>
                <dd>{{ latestMessage?.timestampSource }}</dd>
              </div>
              <div>
                <dt>Received</dt>
                <dd>{{ latestMessage?.timestampUiReceived }}</dd>
              </div>
            </dl>

            <pre class="raw-message">{{ latestMessage?.rawJson }}</pre>
          </template>
        </template>

        <p v-else class="empty-state">Select a topic to inspect messages.</p>
      </article>
    </section>
  </section>
</template>

<style scoped>
.topics-view {
  display: grid;
  gap: 1rem;
}

.topics-header {
  display: flex;
  justify-content: space-between;
  gap: 0.9rem;
  align-items: flex-start;
}

.topics-header h1,
.viewer-header h2 {
  margin: 0;
  color: var(--text-strong);
}

.topics-header p,
.viewer-header p {
  margin: 0.35rem 0 0;
  color: var(--text-muted);
}

.header-actions {
  display: flex;
  gap: 0.65rem;
  align-items: center;
  flex-wrap: wrap;
}

.status-pill,
.viewer-chip {
  padding: 0.25rem 0.6rem;
  border-radius: 999px;
  border: 1px solid var(--panel-border);
  background: var(--chip-bg);
  color: var(--text-strong);
  font-size: 0.78rem;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.viewer-chip[data-subscribed="true"] {
  background: rgba(40, 192, 95, 0.17);
  border-color: rgba(77, 255, 136, 0.35);
}

.refresh-button,
.subscription-button {
  border: 1px solid var(--panel-border);
  border-radius: 0.55rem;
  background: var(--panel-bg);
  color: var(--text-strong);
  padding: 0.45rem 0.7rem;
  font: inherit;
  cursor: pointer;
}

.refresh-button:disabled {
  cursor: progress;
  opacity: 0.7;
}

.summary-grid,
.workspace-grid {
  display: grid;
  gap: 0.75rem;
}

.summary-grid {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.summary-grid article,
.catalog-panel,
.viewer-panel {
  border: 1px solid var(--panel-border);
  border-radius: 0.7rem;
  background: var(--panel-bg);
  padding: 0.8rem;
}

.summary-grid h2,
.filter-field span,
.message-meta dt,
.topics-table th {
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
  grid-template-columns: minmax(0, 1.2fr) minmax(0, 0.9fr);
}

.filter-field {
  display: grid;
  gap: 0.35rem;
}

.filter-field input {
  width: 100%;
  border: 1px solid var(--panel-border);
  border-radius: 0.55rem;
  padding: 0.55rem 0.65rem;
  font: inherit;
  background: #f9fcfe;
}

.load-error,
.empty-state {
  margin: 0.8rem 0 0;
  color: var(--text-muted);
}

.load-error {
  color: #a13a36;
}

.table-wrap {
  overflow: auto;
  margin-top: 0.8rem;
}

.topics-table {
  width: 100%;
  border-collapse: collapse;
}

.topics-table th,
.topics-table td {
  text-align: left;
  padding: 0.65rem 0.4rem;
  border-bottom: 1px solid #d8e4ec;
  font-size: 0.9rem;
}

.topics-table tbody tr {
  cursor: pointer;
}

.topics-table tbody tr[data-active="true"] {
  background: #eef5f9;
}

.viewer-panel {
  display: grid;
  align-content: start;
  gap: 0.8rem;
}

.viewer-header {
  display: flex;
  justify-content: space-between;
  gap: 0.75rem;
  align-items: flex-start;
}

.message-meta {
  margin: 0;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.6rem;
}

.message-meta dd {
  margin: 0.2rem 0 0;
  color: var(--text-strong);
  font-size: 0.86rem;
  overflow-wrap: anywhere;
}

.raw-message {
  margin: 0;
  padding: 0.8rem;
  border-radius: 0.65rem;
  background: #071f2e;
  color: #e9f8ff;
  overflow: auto;
  font-size: 0.82rem;
}

@media (max-width: 900px) {
  .topics-header,
  .viewer-header {
    flex-direction: column;
  }

  .summary-grid,
  .workspace-grid,
  .message-meta {
    grid-template-columns: 1fr;
  }
}
</style>