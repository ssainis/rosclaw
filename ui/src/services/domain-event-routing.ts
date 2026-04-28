import type { EventBus } from "../core/events/bus";
import { eventBus } from "../core/events/runtime";
import { buildCanonicalEventEnvelope } from "../core/events/envelope";
import type { useAgentStore } from "../stores/agent";
import type { useAlertsStore } from "../stores/alerts";
import type { useMissionStore } from "../stores/mission";
import type { useRobotStore } from "../stores/robot";
import type { useTopicStore } from "../stores/topic";

type RobotStore = ReturnType<typeof useRobotStore>;
type AgentStore = ReturnType<typeof useAgentStore>;
type MissionStore = ReturnType<typeof useMissionStore>;
type AlertsStore = ReturnType<typeof useAlertsStore>;
type TopicStore = ReturnType<typeof useTopicStore>;

export interface DomainStores {
  robotStore: RobotStore;
  agentStore: AgentStore;
  missionStore: MissionStore;
  alertsStore: AlertsStore;
  topicStore: TopicStore;
}

let teardown: (() => void) | null = null;

function routeToDomainStores(eventBusInstance: EventBus, stores: DomainStores): () => void {
  const offAll = eventBusInstance.subscribeAll((event) => {
    stores.robotStore.ingestEnvelope(event);
    stores.agentStore.ingestEnvelope(event);
    stores.missionStore.ingestEnvelope(event);
    stores.alertsStore.ingestEnvelope(event);
    stores.topicStore.ingestEnvelope(event);
  });

  const offMalformed = eventBusInstance.onMalformed((_input, errors) => {
    const systemAlert = buildCanonicalEventEnvelope({
      source: "operator",
      entity_type: "system",
      entity_id: "event-bus",
      event_type: "alert:raised",
      severity: "warning",
      payload: {
        alert_id: "event-bus-malformed",
        severity: "warning",
        message: `Malformed event contained (${errors.length} validation error(s))`,
      },
    });

    stores.alertsStore.ingestEnvelope(systemAlert);
  });

  return () => {
    offAll();
    offMalformed();
  };
}

export function ensureDomainEventRouting(stores: DomainStores): () => void {
  if (teardown) return teardown;
  teardown = routeToDomainStores(eventBus, stores);
  return teardown;
}

export function shutdownDomainEventRouting(): void {
  teardown?.();
  teardown = null;
}

export function setupDomainEventRoutingForBus(
  bus: EventBus,
  stores: DomainStores,
): () => void {
  return routeToDomainStores(bus, stores);
}