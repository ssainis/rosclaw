<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import {
  getRosTypeTemplate,
  hasKnownPublishSchema,
  hasKnownServiceSchema,
} from "../core/ros/forms";
import { ensureRosbridgeConnection, getRosbridgeClient } from "../services/rosbridge-connection";
import {
  callRosService,
  publishToTopic,
  refreshServiceCatalog,
  refreshTopicCatalog,
  subscribeToTopic,
  teardownTopicExplorer,
  unsubscribeFromTopic,
  validateServiceCallInput,
  validateTopicPublishInput,
} from "../services/topic-explorer";
import { useConnectionStore } from "../stores/connection";
import { useTopicStore } from "../stores/topic";

const connectionStore = useConnectionStore();
const topicStore = useTopicStore();

const filterText = ref("");
const isLoading = ref(false);
const loadError = ref<string | null>(null);
const publishPayload = ref("{}");
const publishError = ref<string | null>(null);
const publishStatus = ref<string | null>(null);
const servicePayload = ref("{}");
const serviceError = ref<string | null>(null);
const serviceStatus = ref<string | null>(null);
const serviceResponse = ref<string | null>(null);

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
const selectedService = computed(() => topicStore.selectedService);
const publishSchemaHint = computed(() => {
  if (!selectedTopic.value) return "Select a topic to publish a message.";
  return hasKnownPublishSchema(selectedTopic.value.type)
    ? `Schema-aware validation active for ${selectedTopic.value.type}.`
    : `Generic JSON object validation only. No schema is registered for ${selectedTopic.value.type}.`;
});
const serviceSchemaHint = computed(() => {
  if (!selectedService.value) return "Select a service to call it.";
  return hasKnownServiceSchema(selectedService.value.type)
    ? `Schema-aware validation active for ${selectedService.value.type}.`
    : `Generic JSON object validation only. No schema is registered for ${selectedService.value.type}.`;
});

async function loadTopics(): Promise<void> {
  const client = getRosbridgeClient() ?? ensureRosbridgeConnection();

  isLoading.value = true;
  loadError.value = null;

  try {
    await Promise.all([refreshTopicCatalog(client), refreshServiceCatalog(client)]);

    if (!selectedTopic.value && topicStore.topics.length > 0) {
      topicStore.setSelectedTopic(topicStore.topics[0].name);
    }

    if (!selectedService.value && topicStore.services.length > 0) {
      topicStore.setSelectedService(topicStore.services[0].name);
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

function selectService(serviceName: string): void {
  topicStore.setSelectedService(serviceName);
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

async function submitPublish(): Promise<void> {
  const client = getRosbridgeClient();
  if (!client || !selectedTopic.value) {
    publishError.value = "Rosbridge topic publishing is unavailable.";
    return;
  }

  const validation = validateTopicPublishInput(selectedTopic.value.type, publishPayload.value);
  if (!validation.ok || !validation.parsed) {
    publishError.value = validation.errors.join(" ");
    publishStatus.value = null;
    return;
  }

  publishToTopic(client, selectedTopic.value.name, selectedTopic.value.type, validation.parsed);
  publishError.value = null;
  publishStatus.value = `Published to ${selectedTopic.value.name}.`;
}

async function submitServiceCall(): Promise<void> {
  const client = getRosbridgeClient();
  if (!client || !selectedService.value) {
    serviceError.value = "Rosbridge service calling is unavailable.";
    return;
  }

  const validation = validateServiceCallInput(selectedService.value.type, servicePayload.value);
  if (!validation.ok || !validation.parsed) {
    serviceError.value = validation.errors.join(" ");
    serviceStatus.value = null;
    serviceResponse.value = null;
    return;
  }

  try {
    const response = await callRosService(
      client,
      selectedService.value.name,
      selectedService.value.type,
      validation.parsed,
    );
    serviceError.value = null;
    serviceStatus.value = `Service call completed for ${selectedService.value.name}.`;
    serviceResponse.value = JSON.stringify(response, null, 2);
  } catch (error) {
    serviceError.value = error instanceof Error ? error.message : "Service call failed";
    serviceStatus.value = null;
    serviceResponse.value = null;
  }
}

watch(
  selectedTopic,
  (topic) => {
    if (!topic) return;
    publishPayload.value = getRosTypeTemplate(topic.type);
    publishError.value = null;
    publishStatus.value = null;
  },
  { immediate: true },
);

watch(
  selectedService,
  (service) => {
    if (!service) return;
    servicePayload.value = getRosTypeTemplate(service.type);
    serviceError.value = null;
    serviceStatus.value = null;
    serviceResponse.value = null;
  },
  { immediate: true },
);

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

    <section class="operations-grid">
      <article class="operation-panel" data-testid="publish-form-panel">
        <header class="panel-header">
          <div>
            <h2>Publish</h2>
            <p>{{ publishSchemaHint }}</p>
          </div>
          <span class="viewer-chip" :data-subscribed="Boolean(selectedTopic)">
            {{ selectedTopic?.name ?? "No topic" }}
          </span>
        </header>

        <textarea
          v-model="publishPayload"
          class="payload-input"
          data-testid="publish-payload"
          rows="10"
          spellcheck="false"
        />

        <p v-if="publishError" class="load-error" data-testid="publish-error">{{ publishError }}</p>
        <p v-if="publishStatus" class="success-text" data-testid="publish-status">{{ publishStatus }}</p>

        <button
          type="button"
          class="refresh-button"
          :disabled="!selectedTopic"
          data-testid="publish-submit"
          @click="submitPublish"
        >
          Publish message
        </button>
      </article>

      <article class="operation-panel" data-testid="service-form-panel">
        <header class="panel-header">
          <div>
            <h2>Services</h2>
            <p>{{ serviceSchemaHint }}</p>
          </div>
          <span class="viewer-chip" :data-subscribed="Boolean(selectedService)">
            {{ selectedService?.name ?? "No service" }}
          </span>
        </header>

        <div class="service-list-wrap">
          <table class="topics-table" data-testid="services-table">
            <thead>
              <tr>
                <th>Service</th>
                <th>Type</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="service in topicStore.services"
                :key="service.name"
                :data-active="selectedService?.name === service.name"
                @click="selectService(service.name)"
              >
                <td>{{ service.name }}</td>
                <td>{{ service.type }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <textarea
          v-model="servicePayload"
          class="payload-input"
          data-testid="service-payload"
          rows="8"
          spellcheck="false"
        />

        <p v-if="serviceError" class="load-error" data-testid="service-error">{{ serviceError }}</p>
        <p v-if="serviceStatus" class="success-text" data-testid="service-status">{{ serviceStatus }}</p>
        <pre v-if="serviceResponse" class="raw-message" data-testid="service-response">{{ serviceResponse }}</pre>

        <button
          type="button"
          class="refresh-button"
          :disabled="!selectedService"
          data-testid="service-submit"
          @click="submitServiceCall"
        >
          Call service
        </button>
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
.workspace-grid,
.operations-grid {
  display: grid;
  gap: 0.75rem;
}

.summary-grid {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.summary-grid article,
.catalog-panel,
.viewer-panel,
.operation-panel {
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

.operations-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.panel-header {
  display: flex;
  justify-content: space-between;
  gap: 0.75rem;
  align-items: flex-start;
  margin-bottom: 0.8rem;
}

.panel-header h2 {
  margin: 0;
  color: var(--text-strong);
}

.panel-header p {
  margin: 0.35rem 0 0;
  color: var(--text-muted);
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

.success-text {
  margin: 0.8rem 0 0;
  color: #1d6f42;
}

.table-wrap {
  overflow: auto;
  margin-top: 0.8rem;
}

.service-list-wrap {
  overflow: auto;
  max-height: 220px;
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

.payload-input {
  width: 100%;
  border: 1px solid var(--panel-border);
  border-radius: 0.65rem;
  padding: 0.75rem;
  background: #f9fcfe;
  color: var(--text-strong);
  font: 0.86rem/1.45 "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
  resize: vertical;
}

@media (max-width: 900px) {
  .topics-header,
  .viewer-header,
  .panel-header {
    flex-direction: column;
  }

  .summary-grid,
  .workspace-grid,
  .operations-grid,
  .message-meta {
    grid-template-columns: 1fr;
  }
}
</style>