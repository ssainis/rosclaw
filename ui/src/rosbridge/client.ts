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
  private status: ConnectionStatus = "idle";
  private messageHandlers = new Map<string, Set<MessageHandler>>();
  private topicTypes = new Map<string, string>();
  private pendingServiceCalls = new Map<
    string,
    {
      reject: (reason?: unknown) => void;
      resolve: (value: Record<string, unknown>) => void;
      timer: ReturnType<typeof setTimeout>;
    }
  >();
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
    if (this.status === "connected" || this.status === "connecting" || this.status === "reconnecting") {
      return;
    }
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
    this.topicTypes.set(topic, msgType);

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
          this.topicTypes.delete(topic);
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

  /** Call a ROS service exposed through rosbridge. */
  callService(
    service: string,
    args: Record<string, unknown> = {},
    typeOrTimeout?: string | number,
    timeoutMsMaybe = 5000,
  ): Promise<Record<string, unknown>> {
    if (!this.ws || this.status !== "connected") {
      return Promise.reject(new Error("Not connected to rosbridge server"));
    }

    const id = this.nextId("svc");
    const type = typeof typeOrTimeout === "string" ? typeOrTimeout : undefined;
    const timeoutMs = typeof typeOrTimeout === "number" ? typeOrTimeout : timeoutMsMaybe;

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingServiceCalls.delete(id);
        reject(new Error(`rosbridge service call timed out: ${service}`));
      }, timeoutMs);

      this.pendingServiceCalls.set(id, { resolve, reject, timer });

      this.send({
        op: "call_service",
        id,
        service,
        args,
        ...(type ? { type } : {}),
      });
    });
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
        this.send({
          op: "subscribe",
          id: this.nextId("resub"),
          topic,
          type: this.topicTypes.get(topic),
        });
      }
    };

    this.ws.onmessage = (event: MessageEvent<string>) => {
      this.handleMessage(event.data);
    };

    this.ws.onerror = () => {
      // onerror is always followed by onclose; handle cleanup there
    };

    this.ws.onclose = () => {
      this.rejectPendingServiceCalls("Rosbridge disconnected before service response");
      this.ws = null;
      if (!this.intentionalClose && this.reconnect) {
        this.setStatus("reconnecting");
        this.scheduleReconnect();
        return;
      }

      this.setStatus("disconnected");
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
    if (op === "service_response") {
      this.handleServiceResponse(msg);
      return;
    }

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

  private handleServiceResponse(message: Record<string, unknown>): void {
    const id = message.id;
    if (typeof id !== "string") return;

    const pending = this.pendingServiceCalls.get(id);
    if (!pending) return;

    clearTimeout(pending.timer);
    this.pendingServiceCalls.delete(id);

    if (message.result === false) {
      const service = typeof message.service === "string" ? message.service : "unknown-service";
      const values = message.values;
      const valuesRecord =
        typeof values === "object" && values !== null ? (values as Record<string, unknown>) : null;
      const detail =
        valuesRecord && typeof valuesRecord.error === "string"
          ? ` (${valuesRecord.error})`
          : "";
      pending.reject(new Error(`rosbridge service call failed: ${service}${detail}`));
      return;
    }

    const values = message.values;
    pending.resolve(
      typeof values === "object" && values !== null ? (values as Record<string, unknown>) : {},
    );
  }

  private rejectPendingServiceCalls(reason: string): void {
    for (const [id, pending] of this.pendingServiceCalls) {
      clearTimeout(pending.timer);
      pending.reject(new Error(reason));
      this.pendingServiceCalls.delete(id);
    }
  }

  private scheduleReconnect(): void {
    if (this.intentionalClose) return;
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.setStatus("failed");
      return;
    }

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
