import { eventBus } from "../core/events/runtime";
import { buildCanonicalEventEnvelope, rosHeaderStampToIso } from "../core/events/envelope";
import type { RosbridgeClient } from "../rosbridge";
import { useConnectionStore } from "../stores/connection";
import { useTopicStore } from "../stores/topic";

const activeSubscriptions = new Map<string, () => void>();

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];
}

async function fetchTopicType(client: RosbridgeClient, topicName: string): Promise<string> {
  const response = await client.callService("/rosapi/topic_type", { topic: topicName });
  return typeof response.type === "string" ? response.type : "unknown";
}

export async function refreshTopicCatalog(client: RosbridgeClient): Promise<void> {
  const response = await client.callService("/rosapi/topics");
  const topicNames = asStringArray(response.topics).sort((left, right) => left.localeCompare(right));
  const topics = await Promise.all(
    topicNames.map(async (name) => ({
      name,
      type: await fetchTopicType(client, name),
    })),
  );

  useTopicStore().replaceTopics(topics);
}

export function subscribeToTopic(client: RosbridgeClient, topicName: string, topicType: string): void {
  if (activeSubscriptions.has(topicName)) return;

  const connectionStore = useConnectionStore();
  const topicStore = useTopicStore();
  const unsubscribe = client.subscribe(topicName, topicType, (message) => {
    connectionStore.markRosbridgeMessageReceived();
    eventBus.publish(
      buildCanonicalEventEnvelope({
        source: "rosbridge",
        entity_type: "topic",
        entity_id: topicName,
        event_type: `topic:${topicName}`,
        timestamp_source: rosHeaderStampToIso(message),
        payload: message,
      }),
    );
  });

  activeSubscriptions.set(topicName, unsubscribe);
  topicStore.setTopicSubscription(topicName, true, topicType);
  topicStore.setSelectedTopic(topicName);
}

export function unsubscribeFromTopic(topicName: string): void {
  activeSubscriptions.get(topicName)?.();
  activeSubscriptions.delete(topicName);
  useTopicStore().setTopicSubscription(topicName, false);
}

export function teardownTopicExplorer(): void {
  for (const unsubscribe of activeSubscriptions.values()) {
    unsubscribe();
  }
  activeSubscriptions.clear();
}