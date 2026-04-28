import { eventBus } from "../core/events/runtime";
import { buildCanonicalEventEnvelope, rosHeaderStampToIso } from "../core/events/envelope";
import {
  type RosFormValidationResult,
  validatePublishPayload,
  validateServiceArgs,
} from "../core/ros/forms";
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

function asServiceEntries(response: Record<string, unknown>): Array<{ name: string; type: string }> {
  const names = asStringArray(response.services);
  const types = asStringArray(response.types);
  return names.map((name, index) => ({
    name,
    type: types[index] ?? "unknown",
  }));
}

export async function refreshTopicCatalog(client: RosbridgeClient): Promise<void> {
  const response = await client.callService("/rosapi/topics");
  const listedNames = asStringArray(response.topics);
  const listedTypes = asStringArray(response.types);
  const typeByName = new Map(listedNames.map((name, index) => [name, listedTypes[index] ?? ""]));
  const topicNames = [...listedNames].sort((left, right) => left.localeCompare(right));
  const topics = await Promise.all(
    topicNames.map(async (name) => ({
      name,
      type: typeByName.get(name) || (await fetchTopicType(client, name)),
    })),
  );

  useTopicStore().replaceTopics(topics);
}

export async function refreshServiceCatalog(client: RosbridgeClient): Promise<void> {
  const response = await client.callService("/rosapi/services");
  useTopicStore().replaceServices(asServiceEntries(response));
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

export function validateTopicPublishInput(
  topicType: string,
  rawPayload: string,
): RosFormValidationResult {
  return validatePublishPayload(topicType, rawPayload);
}

export function validateServiceCallInput(
  serviceType: string,
  rawPayload: string,
): RosFormValidationResult {
  return validateServiceArgs(serviceType, rawPayload);
}

export function publishToTopic(
  client: RosbridgeClient,
  topicName: string,
  topicType: string,
  payload: Record<string, unknown>,
): void {
  client.publish(topicName, topicType, payload);
  eventBus.publish(
    buildCanonicalEventEnvelope({
      source: "operator",
      entity_type: "system",
      entity_id: topicName,
      event_type: "command:publish",
      payload: {
        topic: topicName,
        type: topicType,
        message: payload,
      },
    }),
  );
}

export async function callRosService(
  client: RosbridgeClient,
  serviceName: string,
  serviceType: string,
  payload: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const response = await client.callService(serviceName, payload, serviceType);
  eventBus.publish(
    buildCanonicalEventEnvelope({
      source: "operator",
      entity_type: "system",
      entity_id: serviceName,
      event_type: "service:call",
      payload: {
        service: serviceName,
        type: serviceType,
        request: payload,
        response,
      },
    }),
  );
  return response;
}