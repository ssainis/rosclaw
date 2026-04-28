import type { EventBus, EventPublishResult } from "../core/events/bus";
import type { CanonicalEventEnvelope, EventSource } from "../core/events/envelope";
import { buildCanonicalEventEnvelope } from "../core/events/envelope";

type RlWsEventKind = "agent:status" | "agent:reward" | "agent:action";

export interface RlWsNormalizationResult {
  ok: boolean;
  envelope?: CanonicalEventEnvelope;
  errors: string[];
}

export interface RlWsIngestResult {
  ok: boolean;
  envelope?: CanonicalEventEnvelope;
  errors: string[];
  publishResult?: EventPublishResult;
}

export interface RlBatchNormalizationResult {
  ok: boolean;
  envelopes: CanonicalEventEnvelope[];
  errors: string[];
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null) return null;
  return value as Record<string, unknown>;
}

function asNonEmptyString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function asFiniteNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function asIsoTimestamp(value: unknown): string | undefined {
  const candidate = asNonEmptyString(value);
  if (!candidate || Number.isNaN(Date.parse(candidate))) {
    return undefined;
  }
  return candidate;
}

function firstDefinedString(...values: unknown[]): string | undefined {
  for (const value of values) {
    const candidate = asNonEmptyString(value);
    if (candidate) return candidate;
  }
  return undefined;
}

function normalizeKind(value: unknown): RlWsEventKind | null {
  const raw = asNonEmptyString(value);
  if (!raw) return null;

  const normalized = raw.toLowerCase().replace(/[^a-z0-9]+/g, "_");
  if (["agent_status", "status", "agent_state", "state"].includes(normalized)) {
    return "agent:status";
  }
  if (["reward", "reward_update", "reward_signal"].includes(normalized)) {
    return "agent:reward";
  }
  if (["action", "action_output", "action_preview"].includes(normalized)) {
    return "agent:action";
  }

  return null;
}

function extractPayloadRoot(message: Record<string, unknown>): Record<string, unknown> {
  return (
    asRecord(message.payload) ??
    asRecord(message.data) ??
    asRecord(message.event) ??
    message
  );
}

function extractAgentRecord(payload: Record<string, unknown>): Record<string, unknown> | null {
  return asRecord(payload.agent) ?? asRecord(payload.agent_state);
}

function extractAgentId(
  message: Record<string, unknown>,
  payload: Record<string, unknown>,
): string | undefined {
  const agent = extractAgentRecord(payload);
  return firstDefinedString(
    payload.agent_id,
    payload.agentId,
    payload.id,
    agent?.id,
    message.agent_id,
    message.agentId,
    message.id,
    asRecord(message.agent)?.id,
  );
}

function buildStatusPayload(payload: Record<string, unknown>): Record<string, unknown> {
  const agent = extractAgentRecord(payload);
  const status = firstDefinedString(payload.status, payload.state, payload.agent_status, agent?.status);
  const objective = firstDefinedString(payload.objective, payload.goal, agent?.objective);
  const policyVersion = firstDefinedString(
    payload.policy_version,
    payload.policyVersion,
    asRecord(payload.policy)?.version,
    agent?.policy_version,
  );

  return {
    ...payload,
    ...(status ? { status } : {}),
    ...(objective ? { objective } : {}),
    ...(policyVersion ? { policy_version: policyVersion } : {}),
  };
}

function buildRewardPayload(payload: Record<string, unknown>): Record<string, unknown> {
  const reward =
    asFiniteNumber(payload.reward) ??
    asFiniteNumber(payload.value) ??
    asFiniteNumber(payload.total_reward);

  return {
    ...payload,
    ...(reward !== undefined ? { reward } : {}),
  };
}

function buildActionPayload(payload: Record<string, unknown>): Record<string, unknown> {
  const action = firstDefinedString(
    payload.action,
    payload.action_name,
    payload.actionName,
    payload.preview,
  );

  return {
    ...payload,
    ...(action ? { action } : {}),
  };
}

function buildNormalizedPayload(
  eventType: RlWsEventKind,
  payload: Record<string, unknown>,
): Record<string, unknown> {
  if (eventType === "agent:status") {
    return buildStatusPayload(payload);
  }
  if (eventType === "agent:reward") {
    return buildRewardPayload(payload);
  }
  return buildActionPayload(payload);
}

function safeParseRlInput(input: unknown): Record<string, unknown> | null {
  if (typeof input === "string") {
    try {
      return asRecord(JSON.parse(input) as unknown);
    } catch {
      return null;
    }
  }

  return asRecord(input);
}

function normalizeRlMessage(
  input: unknown,
  source: EventSource,
  receivedAt = new Date(),
  defaultEventType?: RlWsEventKind,
): RlWsNormalizationResult {
  const message = safeParseRlInput(input);
  if (!message) {
    return { ok: false, errors: ["RL message must be a JSON object"] };
  }

  const payload = extractPayloadRoot(message);
  const eventType =
    normalizeKind(message.type) ??
    normalizeKind(message.event) ??
    normalizeKind(message.kind) ??
    normalizeKind(payload.type) ??
    normalizeKind(payload.event) ??
    normalizeKind(payload.kind) ??
    defaultEventType ??
    null;

  if (!eventType) {
    return { ok: false, errors: ["RL message type was not recognized"] };
  }

  const entityId = extractAgentId(message, payload);
  if (!entityId) {
    return { ok: false, errors: ["RL message is missing agent_id"] };
  }

  const timestampSource =
    asIsoTimestamp(payload.timestamp) ??
    asIsoTimestamp(payload.ts) ??
    asIsoTimestamp(payload.created_at) ??
    asIsoTimestamp(message.timestamp) ??
    asIsoTimestamp(message.ts) ??
    asIsoTimestamp(message.created_at);

  const traceId = firstDefinedString(
    payload.trace_id,
    payload.traceId,
    message.trace_id,
    message.traceId,
  );

  const envelope = buildCanonicalEventEnvelope(
    {
      source,
      entity_type: "agent",
      entity_id: entityId,
      event_type: eventType,
      payload: buildNormalizedPayload(eventType, payload),
      ...(timestampSource ? { timestamp_source: timestampSource } : {}),
      ...(traceId ? { trace_id: traceId } : {}),
    },
    receivedAt,
  );

  return { ok: true, envelope, errors: [] };
}

function collectRlRestRecords(input: unknown): unknown[] {
  if (Array.isArray(input)) {
    return input;
  }

  const record = safeParseRlInput(input);
  if (!record) {
    return [input];
  }

  const collections = [record.events, record.agents, record.items, record.data];
  for (const collection of collections) {
    if (Array.isArray(collection)) {
      return collection;
    }
  }

  return [record];
}

export function normalizeRlWsMessage(
  input: unknown,
  receivedAt = new Date(),
): RlWsNormalizationResult {
  return normalizeRlMessage(input, "rl-ws", receivedAt);
}

export function normalizeRlRestPayload(
  input: unknown,
  receivedAt = new Date(),
): RlBatchNormalizationResult {
  const envelopes: CanonicalEventEnvelope[] = [];
  const errors: string[] = [];

  for (const record of collectRlRestRecords(input)) {
    const normalized = normalizeRlMessage(record, "rl-rest", receivedAt, "agent:status");
    if (normalized.ok && normalized.envelope) {
      envelopes.push(normalized.envelope);
      continue;
    }

    errors.push(...normalized.errors);
  }

  return {
    ok: errors.length === 0,
    envelopes,
    errors,
  };
}

export function ingestRlWsMessage(
  bus: EventBus,
  input: unknown,
  receivedAt = new Date(),
): RlWsIngestResult {
  try {
    const normalized = normalizeRlWsMessage(input, receivedAt);
    if (!normalized.ok || !normalized.envelope) {
      return { ok: false, errors: normalized.errors };
    }

    return {
      ok: true,
      envelope: normalized.envelope,
      errors: [],
      publishResult: bus.publish(normalized.envelope),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, errors: [message] };
  }
}

export function ingestRlRestPayload(
  bus: EventBus,
  input: unknown,
  receivedAt = new Date(),
): { ok: boolean; errors: string[]; publishResults: EventPublishResult[] } {
  const normalized = normalizeRlRestPayload(input, receivedAt);
  if (!normalized.ok) {
    return { ok: false, errors: normalized.errors, publishResults: [] };
  }

  return {
    ok: true,
    errors: [],
    publishResults: normalized.envelopes.map((envelope) => bus.publish(envelope)),
  };
}