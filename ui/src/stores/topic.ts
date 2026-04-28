import { defineStore } from "pinia";
import type { CanonicalEventEnvelope } from "../core/events/envelope";

const MESSAGE_HISTORY_LIMIT = 25;

export interface TopicCatalogEntry {
  name: string;
  namespace: string;
  type: string;
  isSubscribed: boolean;
  messageCount: number;
  lastMessageAt: string | null;
}

export interface TopicMessageRecord {
  eventId: string;
  eventType: string;
  topic: string;
  timestampSource: string;
  timestampUiReceived: string;
  payload: unknown;
  rawJson: string;
}

export interface RosServiceEntry {
  name: string;
  type: string;
}

interface TopicState {
  selectedServiceName: string | null;
  selectedTopicName: string | null;
  servicesByName: Record<string, RosServiceEntry>;
  topicsByName: Record<string, TopicCatalogEntry>;
  topicMessagesByName: Record<string, TopicMessageRecord[]>;
}

function namespaceFromTopic(topicName: string): string {
  const segments = topicName.split("/").filter(Boolean);
  if (segments.length <= 1) return "/";
  return `/${segments.slice(0, -1).join("/")}`;
}

function payloadToJson(payload: unknown): string {
  const text = JSON.stringify(payload, null, 2);
  return typeof text === "string" ? text : "null";
}

export const useTopicStore = defineStore("topic", {
  state: (): TopicState => ({
    selectedServiceName: null,
    selectedTopicName: null,
    servicesByName: {},
    topicsByName: {},
    topicMessagesByName: {},
  }),
  getters: {
    services(state): RosServiceEntry[] {
      return Object.values(state.servicesByName).sort((left, right) => left.name.localeCompare(right.name));
    },
    topics(state): TopicCatalogEntry[] {
      return Object.values(state.topicsByName).sort((left, right) => left.name.localeCompare(right.name));
    },
    selectedService(state): RosServiceEntry | null {
      if (!state.selectedServiceName) return null;
      return state.servicesByName[state.selectedServiceName] ?? null;
    },
    selectedTopic(state): TopicCatalogEntry | null {
      if (!state.selectedTopicName) return null;
      return state.topicsByName[state.selectedTopicName] ?? null;
    },
    selectedTopicMessages(state): TopicMessageRecord[] {
      if (!state.selectedTopicName) return [];
      return state.topicMessagesByName[state.selectedTopicName] ?? [];
    },
    recentMessages(state): TopicMessageRecord[] {
      const merged = Object.values(state.topicMessagesByName).flat();
      return merged
        .slice()
        .sort((left, right) => right.timestampUiReceived.localeCompare(left.timestampUiReceived));
    },
    subscribedTopicCount(): number {
      return this.topics.filter((topic) => topic.isSubscribed).length;
    },
  },
  actions: {
    replaceTopics(entries: Array<{ name: string; type: string }>): void {
      const nextTopics: Record<string, TopicCatalogEntry> = {};

      for (const entry of entries) {
        const existing = this.topicsByName[entry.name];
        nextTopics[entry.name] = {
          name: entry.name,
          namespace: namespaceFromTopic(entry.name),
          type: entry.type,
          isSubscribed: existing?.isSubscribed ?? false,
          messageCount: existing?.messageCount ?? 0,
          lastMessageAt: existing?.lastMessageAt ?? null,
        };
      }

      this.topicsByName = nextTopics;

      if (this.selectedTopicName && this.topicsByName[this.selectedTopicName]) {
        return;
      }

      this.selectedTopicName = entries[0]?.name ?? null;
    },

    replaceServices(entries: RosServiceEntry[]): void {
      const nextServices: Record<string, RosServiceEntry> = {};
      for (const entry of entries) {
        nextServices[entry.name] = entry;
      }

      this.servicesByName = nextServices;

      if (this.selectedServiceName && this.servicesByName[this.selectedServiceName]) {
        return;
      }

      this.selectedServiceName = entries[0]?.name ?? null;
    },

    setSelectedService(serviceName: string | null): void {
      this.selectedServiceName = serviceName;
    },

    setSelectedTopic(topicName: string | null): void {
      this.selectedTopicName = topicName;
    },

    setTopicSubscription(topicName: string, isSubscribed: boolean, type = "unknown"): void {
      const existing = this.topicsByName[topicName];
      this.topicsByName[topicName] = {
        name: topicName,
        namespace: existing?.namespace ?? namespaceFromTopic(topicName),
        type: existing?.type ?? type,
        isSubscribed,
        messageCount: existing?.messageCount ?? 0,
        lastMessageAt: existing?.lastMessageAt ?? null,
      };

      if (!this.selectedTopicName) {
        this.selectedTopicName = topicName;
      }
    },

    ingestEnvelope(event: CanonicalEventEnvelope): void {
      if (event.entity_type !== "topic") return;

      const topicName = event.entity_id;
      const existing = this.topicsByName[topicName];
      this.topicsByName[topicName] = {
        name: topicName,
        namespace: existing?.namespace ?? namespaceFromTopic(topicName),
        type: existing?.type ?? "unknown",
        isSubscribed: existing?.isSubscribed ?? false,
        messageCount: (existing?.messageCount ?? 0) + 1,
        lastMessageAt: event.timestamp_ui_received,
      };

      const nextMessages = [
        {
          eventId: event.event_id,
          eventType: event.event_type,
          topic: topicName,
          timestampSource: event.timestamp_source,
          timestampUiReceived: event.timestamp_ui_received,
          payload: event.payload,
          rawJson: payloadToJson(event.payload),
        },
        ...(this.topicMessagesByName[topicName] ?? []),
      ].slice(0, MESSAGE_HISTORY_LIMIT);

      this.topicMessagesByName[topicName] = nextMessages;

      if (!this.selectedTopicName) {
        this.selectedTopicName = topicName;
      }
    },
  },
});