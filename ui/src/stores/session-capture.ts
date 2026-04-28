import { defineStore } from "pinia";
import type { CanonicalEventEnvelope } from "../core/events/envelope";
import type { TimelineEventRecord } from "./timeline";

export interface SessionCaptureMetadata {
  session_id: string;
  label: string;
  start_timestamp: string;
  end_timestamp: string | null;
  event_count: number;
  sources: string[];
}

export interface SessionCaptureFile {
  schema_version: "1";
  metadata: SessionCaptureMetadata;
  events: TimelineEventRecord[];
}

interface SessionCaptureState {
  isRecording: boolean;
  capturedEvents: TimelineEventRecord[];
  recordingMeta: Omit<SessionCaptureMetadata, "end_timestamp" | "event_count" | "sources"> | null;
  loadedSession: SessionCaptureFile | null;
  exportError: string | null;
  importError: string | null;
}

function envelopeToRecord(event: CanonicalEventEnvelope): TimelineEventRecord {
  const payload = event.payload;
  const text = JSON.stringify(payload);
  const payloadPreview =
    text && text.length > 140 ? `${text.slice(0, 137)}...` : (text ?? "null");

  return {
    id: event.event_id,
    timestampSource: event.timestamp_source,
    timestampUiReceived: event.timestamp_ui_received,
    source: event.source,
    entityType: event.entity_type,
    entityId: event.entity_id,
    eventType: event.event_type,
    severity: event.severity ?? "info",
    traceId: event.trace_id ?? null,
    payload,
    payloadPreview,
  };
}

function uniqueSources(events: TimelineEventRecord[]): string[] {
  return [...new Set(events.map((e) => e.source))];
}

function isValidSessionFile(value: unknown): value is SessionCaptureFile {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  if (v["schema_version"] !== "1") return false;
  if (typeof v["metadata"] !== "object" || v["metadata"] === null) return false;
  if (!Array.isArray(v["events"])) return false;
  const meta = v["metadata"] as Record<string, unknown>;
  if (typeof meta["session_id"] !== "string") return false;
  if (typeof meta["label"] !== "string") return false;
  if (typeof meta["start_timestamp"] !== "string") return false;
  return true;
}

let sessionCounter = 0;

function generateSessionId(): string {
  sessionCounter += 1;
  return `session-${Date.now()}-${sessionCounter}`;
}

export const useSessionCaptureStore = defineStore("sessionCapture", {
  state: (): SessionCaptureState => ({
    isRecording: false,
    capturedEvents: [],
    recordingMeta: null,
    loadedSession: null,
    exportError: null,
    importError: null,
  }),
  getters: {
    capturedCount(state): number {
      return state.capturedEvents.length;
    },
    loadedEventCount(state): number {
      return state.loadedSession?.events.length ?? 0;
    },
  },
  actions: {
    startCapture(label = "Unnamed session"): void {
      if (this.isRecording) return;
      this.capturedEvents = [];
      this.exportError = null;
      this.recordingMeta = {
        session_id: generateSessionId(),
        label,
        start_timestamp: new Date().toISOString(),
      };
      this.isRecording = true;
    },

    stopCapture(): SessionCaptureFile | null {
      if (!this.isRecording || !this.recordingMeta) return null;
      this.isRecording = false;
      const file: SessionCaptureFile = {
        schema_version: "1",
        metadata: {
          ...this.recordingMeta,
          end_timestamp: new Date().toISOString(),
          event_count: this.capturedEvents.length,
          sources: uniqueSources(this.capturedEvents),
        },
        events: [...this.capturedEvents],
      };
      this.recordingMeta = null;
      return file;
    },

    ingestEnvelope(event: CanonicalEventEnvelope): void {
      if (!this.isRecording) return;
      this.capturedEvents.push(envelopeToRecord(event));
    },

    exportSession(): string | null {
      const meta = this.recordingMeta;
      const events = this.capturedEvents;

      // Allow export while recording (snapshot) or after stop (loadedSession)
      const file: SessionCaptureFile = {
        schema_version: "1",
        metadata: {
          session_id: meta?.session_id ?? generateSessionId(),
          label: meta?.label ?? "Snapshot",
          start_timestamp: meta?.start_timestamp ?? new Date().toISOString(),
          end_timestamp: this.isRecording ? null : new Date().toISOString(),
          event_count: events.length,
          sources: uniqueSources(events),
        },
        events: [...events],
      };

      try {
        return JSON.stringify(file, null, 2);
      } catch (err) {
        this.exportError = String(err);
        return null;
      }
    },

    importSession(json: string): boolean {
      this.importError = null;
      let parsed: unknown;
      try {
        parsed = JSON.parse(json);
      } catch {
        this.importError = "Invalid JSON";
        return false;
      }

      if (!isValidSessionFile(parsed)) {
        this.importError = "Invalid session file format";
        return false;
      }

      this.loadedSession = parsed;
      return true;
    },

    clearLoadedSession(): void {
      this.loadedSession = null;
      this.importError = null;
    },
  },
});
