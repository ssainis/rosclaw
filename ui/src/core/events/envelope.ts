export type EventSource = "rosbridge" | "rl-ws" | "rl-rest" | "operator";

export type EventEntityType = "robot" | "agent" | "mission" | "system" | "topic";

export type EventSeverity = "info" | "warning" | "error" | "critical";

export interface CanonicalEventEnvelope {
  event_id: string;
  timestamp_source: string;
  timestamp_ui_received: string;
  source: EventSource;
  entity_type: EventEntityType;
  entity_id: string;
  event_type: string;
  payload: unknown;
  trace_id?: string;
  severity?: EventSeverity;
}

export interface CanonicalEventInput {
  source: EventSource;
  entity_type: EventEntityType;
  entity_id: string;
  event_type: string;
  payload: unknown;
  timestamp_source?: string;
  timestamp_ui_received?: string;
  event_id?: string;
  trace_id?: string;
  severity?: EventSeverity;
}

export interface EnvelopeValidationResult {
  ok: boolean;
  errors: string[];
}

const EVENT_SOURCE_VALUES: readonly EventSource[] = [
  "rosbridge",
  "rl-ws",
  "rl-rest",
  "operator",
];

const EVENT_ENTITY_TYPE_VALUES: readonly EventEntityType[] = [
  "robot",
  "agent",
  "mission",
  "system",
  "topic",
];

const EVENT_SEVERITY_VALUES: readonly EventSeverity[] = [
  "info",
  "warning",
  "error",
  "critical",
];

let eventCounter = 0;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isIsoTimestamp(value: unknown): value is string {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

function makeEventId(receivedAtIso: string): string {
  eventCounter += 1;
  return `evt_${receivedAtIso}_${eventCounter}`;
}

export function resetEventCounterForTests(): void {
  eventCounter = 0;
}

export function validateCanonicalEventEnvelope(value: unknown): EnvelopeValidationResult {
  const errors: string[] = [];

  if (!isRecord(value)) {
    return { ok: false, errors: ["Envelope must be an object"] };
  }

  if (!isNonEmptyString(value.event_id)) {
    errors.push("event_id must be a non-empty string");
  }

  if (!isIsoTimestamp(value.timestamp_source)) {
    errors.push("timestamp_source must be an ISO timestamp string");
  }

  if (!isIsoTimestamp(value.timestamp_ui_received)) {
    errors.push("timestamp_ui_received must be an ISO timestamp string");
  }

  if (!EVENT_SOURCE_VALUES.includes(value.source as EventSource)) {
    errors.push("source must be one of: rosbridge, rl-ws, rl-rest, operator");
  }

  if (!EVENT_ENTITY_TYPE_VALUES.includes(value.entity_type as EventEntityType)) {
    errors.push("entity_type must be one of: robot, agent, mission, system, topic");
  }

  if (!isNonEmptyString(value.entity_id)) {
    errors.push("entity_id must be a non-empty string");
  }

  if (!isNonEmptyString(value.event_type)) {
    errors.push("event_type must be a non-empty string");
  }

  if (value.trace_id !== undefined && !isNonEmptyString(value.trace_id)) {
    errors.push("trace_id must be a non-empty string when provided");
  }

  if (
    value.severity !== undefined &&
    !EVENT_SEVERITY_VALUES.includes(value.severity as EventSeverity)
  ) {
    errors.push("severity must be one of: info, warning, error, critical when provided");
  }

  return { ok: errors.length === 0, errors };
}

export function buildCanonicalEventEnvelope(
  input: CanonicalEventInput,
  receivedAt = new Date(),
): CanonicalEventEnvelope {
  const receivedAtIso = receivedAt.toISOString();

  const envelope: CanonicalEventEnvelope = {
    event_id: input.event_id ?? makeEventId(receivedAtIso),
    timestamp_source: input.timestamp_source ?? receivedAtIso,
    timestamp_ui_received: input.timestamp_ui_received ?? receivedAtIso,
    source: input.source,
    entity_type: input.entity_type,
    entity_id: input.entity_id,
    event_type: input.event_type,
    payload: input.payload,
    ...(input.trace_id ? { trace_id: input.trace_id } : {}),
    ...(input.severity ? { severity: input.severity } : {}),
  };

  const validation = validateCanonicalEventEnvelope(envelope);
  if (!validation.ok) {
    throw new Error(`Invalid canonical event envelope: ${validation.errors.join("; ")}`);
  }

  return envelope;
}

export function rosHeaderStampToIso(payload: unknown): string | undefined {
  if (!isRecord(payload)) return undefined;

  const header = payload.header;
  if (!isRecord(header)) return undefined;

  const stamp = header.stamp;
  if (!isRecord(stamp)) return undefined;

  const secRaw = stamp.sec ?? stamp.secs;
  const nanosecRaw = stamp.nanosec ?? stamp.nsec ?? stamp.nsecs;

  if (typeof secRaw !== "number" || !Number.isFinite(secRaw)) {
    return undefined;
  }

  if (typeof nanosecRaw !== "number" || !Number.isFinite(nanosecRaw)) {
    return undefined;
  }

  const millis = secRaw * 1000 + Math.floor(nanosecRaw / 1_000_000);
  return new Date(millis).toISOString();
}