import type {
  ConnectionStatus,
  ConnectionHandler,
  MessageHandler,
  RosbridgeMessage,
} from "./types.js";

/**
 * Browser WebSocket client for the rosbridge v2 protocol.
 * Uses the native browser WebSocket API (no Node.js `ws` dependency).
 */
export class RosbridgeClient {
  private ws: WebSocket | null = null;
  private status: ConnectionStatus = "disconnected";
  private messageHandlers = new Map<string, Set<MessageHandler>>();
  private connectionHandlers = new Set<ConnectionHandler>();
  private intentionalClose = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempts = 0;
  private idCounter = 0;

  private readonly url: string;
  private readonly reconnect: boolean;
  private readonly reconnectInterval: number;
  private readonly maxReconnectAttempts: number;

  constructor(options: {
    url: string;
    reconnect?: boolean;
    reconnectInterval?: number;
    maxReconnectAttempts?: number;
  }) {
    this.url = options.url;
    this.reconnect = options.reconnect ?? true;
    this.reconnectInterval = options.reconnectInterval ?? 3000;
    this.maxReconnectAttempts = options.maxReconnectAttempts ?? 10;
  }

  /** Connect to the rosbridge WebSocket server. */
  connect(): void {
    if (this.status !== "disconnected") return;
    this.intentionalClose = false;
    this.setStatus("connecting");
    this.openSocket();
  }

  /** Disconnect from the rosbridge server. */
  disconnect(): void {
    this.intentionalClose = true;
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.setStatus("disconnected");
  }

  /** Send a rosbridge protocol message to the server. */
  send(message: RosbridgeMessage & Record<string, unknown>): void {
    if (!this.ws || this.status !== "connected") {
      throw new Error("Not connected to rosbridge server");
    }
    this.ws.send(JSON.stringify(message));
  }

  /** Subscribe to incoming messages for a specific ROS topic. */
  subscribe(topic: string, msgType: string, handler: MessageHandler): () => void {
    if (!this.messageHandlers.has(topic)) {
      this.messageHandlers.set(topic, new Set());
    }
    this.messageHandlers.get(topic)!.add(handler);

    if (this.status === "connected") {
      this.send({ op: "subscribe", id: this.nextId("sub"), topic, type: msgType });
    }

    return () => {
      const handlers = this.messageHandlers.get(topic);
      if (handlers) {
        handlers.delete(handler);
        if (handlers.size === 0) {
          this.messageHandlers.delete(topic);
          if (this.status === "connected") {
            this.send({ op: "unsubscribe", id: this.nextId("unsub"), topic });
          }
        }
      }
    };
  }

  /** Publish a message to a ROS topic. */
  publish(topic: string, msgType: string, msg: Record<string, unknown>): void {
    this.send({ op: "publish", topic, type: msgType, msg });
  }

  /** Register a connection status change handler. */
  onConnection(handler: ConnectionHandler): () => void {
    this.connectionHandlers.add(handler);
    // Immediately notify with current status
    handler(this.status);
    return () => {
      this.connectionHandlers.delete(handler);
    };
  }

  /** Current connection status. */
  getStatus(): ConnectionStatus {
    return this.status;
  }

  /** Generate a unique message ID. */
  nextId(prefix = "rosclaw-ui"): string {
    return `${prefix}_${++this.idCounter}`;
  }

  // ── Private helpers ──────────────────────────────────────────────────────

  private openSocket(): void {
    try {
      this.ws = new WebSocket(this.url);
    } catch {
      this.setStatus("disconnected");
      this.scheduleReconnect();
      return;
    }

    this.ws.onopen = () => {
      this.reconnectAttempts = 0;
      this.setStatus("connected");
      // Re-subscribe to all active topics after (re)connect
      for (const [topic] of this.messageHandlers) {
        this.send({ op: "subscribe", id: this.nextId("resub"), topic });
      }
    };

    this.ws.onmessage = (event: MessageEvent<string>) => {
      this.handleMessage(event.data);
    };

    this.ws.onerror = () => {
      // onerror is always followed by onclose; handle cleanup there
    };

    this.ws.onclose = () => {
      this.ws = null;
      this.setStatus("disconnected");
      if (!this.intentionalClose && this.reconnect) {
        this.scheduleReconnect();
      }
    };
  }

  private setStatus(status: ConnectionStatus): void {
    this.status = status;
    for (const handler of this.connectionHandlers) {
      handler(status);
    }
  }

  private handleMessage(data: string): void {
    let msg: Record<string, unknown>;
    try {
      msg = JSON.parse(data) as Record<string, unknown>;
    } catch {
      return;
    }

    const op = msg.op as string | undefined;
    if (op !== "publish") return;

    const topic = msg.topic as string | undefined;
    if (!topic) return;

    const payload = (msg.msg ?? {}) as Record<string, unknown>;
    const handlers = this.messageHandlers.get(topic);
    if (handlers) {
      for (const handler of handlers) {
        handler(payload);
      }
    }
  }

  private scheduleReconnect(): void {
    if (this.intentionalClose) return;
    if (this.reconnectAttempts >= this.maxReconnectAttempts) return;

    this.reconnectAttempts++;
    const delay = Math.min(
      this.reconnectInterval * Math.pow(2, this.reconnectAttempts - 1),
      30_000,
    );

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (!this.intentionalClose) {
        this.setStatus("connecting");
        this.openSocket();
      }
    }, delay);
  }
}
