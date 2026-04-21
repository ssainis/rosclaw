import { RosbridgeClient } from "../rosbridge";
import { useConnectionStore } from "../stores/connection";

const rosbridgeUrl =
  (import.meta.env.VITE_ROSBRIDGE_URL as string | undefined) ??
  `ws://${window.location.hostname}:9090`;

let client: RosbridgeClient | null = null;
let unsubscribeStatus: (() => void) | null = null;
let freshnessTimer: ReturnType<typeof setInterval> | null = null;

export function ensureRosbridgeConnection(): RosbridgeClient {
  if (client) return client;

  const store = useConnectionStore();
  client = new RosbridgeClient({
    url: rosbridgeUrl,
    reconnect: true,
    reconnectInterval: 1000,
    maxReconnectAttempts: 10,
  });

  unsubscribeStatus = client.onConnection((status) => {
    store.setRosbridgeTransportStatus(status);
  });

  freshnessTimer = setInterval(() => {
    store.evaluateRosbridgeFreshness();
  }, 1000);

  client.connect();
  return client;
}

export function getRosbridgeClient(): RosbridgeClient | null {
  return client;
}

export function shutdownRosbridgeConnection(): void {
  if (freshnessTimer) {
    clearInterval(freshnessTimer);
    freshnessTimer = null;
  }

  if (unsubscribeStatus) {
    unsubscribeStatus();
    unsubscribeStatus = null;
  }

  if (client) {
    client.disconnect();
    client = null;
  }
}
