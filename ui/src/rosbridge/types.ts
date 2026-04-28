/** Connection states for the rosbridge WebSocket client. */
export type ConnectionStatus =
  | "idle"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "failed"
  | "disconnected";

/** Handler invoked when a topic message arrives. */
export type MessageHandler = (msg: Record<string, unknown>) => void;

/** Handler invoked when connection status changes. */
export type ConnectionHandler = (status: ConnectionStatus) => void;

/** Minimal rosbridge protocol message shape. */
export interface RosbridgeMessage {
  op: string;
  id?: string;
  topic?: string;
  type?: string;
  service?: string;
  args?: Record<string, unknown>;
  msg?: unknown;
  values?: Record<string, unknown>;
  result?: boolean;
}
