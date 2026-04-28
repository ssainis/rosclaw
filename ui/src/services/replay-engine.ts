import type { EventBus } from "../core/events/bus";
import { eventBus as defaultBus } from "../core/events/runtime";
import { buildCanonicalEventEnvelope } from "../core/events/envelope";
import type { SessionCaptureFile } from "../stores/session-capture";
import type { TimelineEventRecord } from "../stores/timeline";

export type ReplayStatus = "idle" | "playing" | "paused" | "ended";

export interface ReplayState {
  status: ReplayStatus;
  currentIndex: number;
  totalEvents: number;
  /** Speed multiplier, e.g. 1.0 = real-time, 2.0 = 2x, 0 = instant */
  speedMultiplier: number;
}

export type ReplayStateHandler = (state: ReplayState) => void;

/**
 * ReplayEngine: deterministic playback of a SessionCaptureFile.
 *
 * Events are published into the event bus in chronological order,
 * respecting relative timing between events scaled by speedMultiplier.
 * Speed 0 means instant (no delay).
 */
export interface ReplayEngine {
  readonly state: ReplayState;
  /** Load a session file. Resets playback to beginning. */
  load(session: SessionCaptureFile): void;
  /** Begin or resume playback. */
  play(): void;
  /** Pause playback without resetting position. */
  pause(): void;
  /** Stop and reset to beginning. */
  stop(): void;
  /** Seek to a specific event index (0-based). */
  seekTo(index: number): void;
  /** Set speed multiplier. */
  setSpeed(multiplier: number): void;
  /** Register a callback that fires on every state transition. */
  onStateChange(handler: ReplayStateHandler): () => void;
  /** Dispose of any pending timers. */
  dispose(): void;
}

function recordToEnvelope(record: TimelineEventRecord): ReturnType<typeof buildCanonicalEventEnvelope> {
  return buildCanonicalEventEnvelope({
    source: record.source,
    entity_type: record.entityType,
    entity_id: record.entityId,
    event_type: record.eventType,
    payload: record.payload,
    timestamp_source: record.timestampSource,
    timestamp_ui_received: record.timestampUiReceived,
    event_id: record.id,
    trace_id: record.traceId ?? undefined,
    severity: record.severity,
  });
}

function parseTs(ts: string | null | undefined): number {
  if (!ts) return 0;
  const n = Date.parse(ts);
  return Number.isFinite(n) ? n : 0;
}

export function createReplayEngine(bus: EventBus = defaultBus): ReplayEngine {
  let events: TimelineEventRecord[] = [];
  let currentIndex = 0;
  let status: ReplayStatus = "idle";
  let speedMultiplier = 1.0;
  let pendingTimer: ReturnType<typeof setTimeout> | null = null;
  const handlers = new Set<ReplayStateHandler>();

  function getState(): ReplayState {
    return {
      status,
      currentIndex,
      totalEvents: events.length,
      speedMultiplier,
    };
  }

  function notify() {
    const s = getState();
    handlers.forEach((h) => h(s));
  }

  function scheduleNext() {
    if (currentIndex >= events.length) {
      status = "ended";
      notify();
      return;
    }

    if (status !== "playing") return;

    const current = events[currentIndex];

    if (currentIndex + 1 >= events.length || speedMultiplier === 0) {
      // Publish immediately then advance
      bus.publish(recordToEnvelope(current));
      currentIndex += 1;
      notify();
      if (currentIndex < events.length) {
        scheduleNext();
      } else {
        status = "ended";
        notify();
      }
      return;
    }

    const next = events[currentIndex + 1];
    const tsA = parseTs(current.timestampSource || current.timestampUiReceived);
    const tsB = parseTs(next.timestampSource || next.timestampUiReceived);
    const rawDelay = Math.max(0, tsB - tsA);
    const delay = speedMultiplier > 0 ? rawDelay / speedMultiplier : 0;

    // Publish current event
    bus.publish(recordToEnvelope(current));
    currentIndex += 1;
    notify();

    pendingTimer = setTimeout(() => {
      pendingTimer = null;
      scheduleNext();
    }, delay);
  }

  function clearTimer() {
    if (pendingTimer !== null) {
      clearTimeout(pendingTimer);
      pendingTimer = null;
    }
  }

  return {
    get state() {
      return getState();
    },

    load(session: SessionCaptureFile): void {
      clearTimer();
      // Sort events chronologically by source timestamp
      events = [...session.events].sort((a, b) => {
        const ta = parseTs(a.timestampSource || a.timestampUiReceived);
        const tb = parseTs(b.timestampSource || b.timestampUiReceived);
        return ta - tb;
      });
      currentIndex = 0;
      status = "idle";
      notify();
    },

    play(): void {
      if (events.length === 0) return;
      if (status === "ended") {
        currentIndex = 0;
      }
      status = "playing";
      notify();
      scheduleNext();
    },

    pause(): void {
      if (status !== "playing") return;
      clearTimer();
      status = "paused";
      notify();
    },

    stop(): void {
      clearTimer();
      currentIndex = 0;
      status = "idle";
      notify();
    },

    seekTo(index: number): void {
      clearTimer();
      currentIndex = Math.max(0, Math.min(index, events.length - 1));
      if (status !== "idle") status = "paused";
      notify();
    },

    setSpeed(multiplier: number): void {
      speedMultiplier = Math.max(0, multiplier);
      notify();
    },

    onStateChange(handler: ReplayStateHandler): () => void {
      handlers.add(handler);
      return () => handlers.delete(handler);
    },

    dispose(): void {
      clearTimer();
      handlers.clear();
    },
  };
}
