/** Connection states for the rosbridge WebSocket client. */
export type ConnectionStatus = "disconnected" | "connecting" | "connected";

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
  msg?: unknown;
}
