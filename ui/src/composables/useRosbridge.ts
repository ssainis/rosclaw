import { ref, onUnmounted } from "vue";
import { RosbridgeClient } from "../rosbridge/index.js";
import type { ConnectionStatus } from "../rosbridge/index.js";

/**
 * Vue composable that manages a single RosbridgeClient instance.
 * Provides reactive `status` and exposes the client for subscriptions.
 */
export function useRosbridge(url: string) {
  const status = ref<ConnectionStatus>("disconnected");

  const client = new RosbridgeClient({ url, reconnect: true });

  const off = client.onConnection((s) => {
    status.value = s;
  });

  client.connect();

  onUnmounted(() => {
    off();
    client.disconnect();
  });

  return { client, status };
}
