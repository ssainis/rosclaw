import type { ConnectionStatus } from "../rosbridge";

export type RlConnectionHandler = (status: ConnectionStatus) => void;
export type RlMessageHandler = (message: unknown) => void;

export class RlStreamClient {
  private ws: WebSocket | null = null;
  private status: ConnectionStatus = "idle";
  private readonly connectionHandlers = new Set<RlConnectionHandler>();
  private readonly messageHandlers = new Set<RlMessageHandler>();
  private intentionalClose = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempts = 0;

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
    this.maxReconnectAttempts = options.maxReconnectAttempts ?? 3;
  }

  connect(): void {
    if (
      this.status === "connected" ||
      this.status === "connecting" ||
      this.status === "reconnecting"
    ) {
      return;
    }

    this.intentionalClose = false;
    this.setStatus("connecting");
    this.openSocket();
  }

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

  onConnection(handler: RlConnectionHandler): () => void {
    this.connectionHandlers.add(handler);
    handler(this.status);
    return () => {
      this.connectionHandlers.delete(handler);
    };
  }

  onMessage(handler: RlMessageHandler): () => void {
    this.messageHandlers.add(handler);
    return () => {
      this.messageHandlers.delete(handler);
    };
  }

  getStatus(): ConnectionStatus {
    return this.status;
  }

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
    };

    this.ws.onmessage = (event: MessageEvent<string>) => {
      this.handleMessage(event.data);
    };

    this.ws.onerror = () => {
      // onclose owns state transitions.
    };

    this.ws.onclose = () => {
      this.ws = null;
      if (!this.intentionalClose && this.reconnect) {
        this.setStatus("reconnecting");
        this.scheduleReconnect();
        return;
      }

      this.setStatus("disconnected");
    };
  }

  private handleMessage(data: string): void {
    let parsed: unknown = data;
    try {
      parsed = JSON.parse(data) as unknown;
    } catch {
      parsed = data;
    }

    for (const handler of this.messageHandlers) {
      handler(parsed);
    }
  }

  private scheduleReconnect(): void {
    if (this.intentionalClose) return;
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.setStatus("failed");
      return;
    }

    this.reconnectAttempts += 1;
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

  private setStatus(status: ConnectionStatus): void {
    this.status = status;
    for (const handler of this.connectionHandlers) {
      handler(status);
    }
  }
}