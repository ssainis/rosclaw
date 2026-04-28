import type { EventBus } from "../core/events/bus";
import { eventBus } from "../core/events/runtime";
import { RlStreamClient } from "../rl";
import { useConnectionStore } from "../stores/connection";
import { ingestRlRestPayload, ingestRlWsMessage } from "./rl-ws-adapter";

type ConnectionStore = ReturnType<typeof useConnectionStore>;

export interface RlConnectionRuntimeOptions {
  bus?: EventBus;
  store?: ConnectionStore;
  wsUrl?: string;
  restUrl?: string;
  restPollMs?: number;
  freshnessIntervalMs?: number;
  maxAgeMs?: number;
  createClient?: (url: string) => RlStreamClient;
  fetchImpl?: typeof fetch;
}

const rlWsUrl = import.meta.env.VITE_RL_WS_URL as string | undefined;
const rlRestUrl = import.meta.env.VITE_RL_REST_URL as string | undefined;

let shutdownRuntime: (() => void) | null = null;

function restCandidates(baseUrl: string): string[] {
  const trimmed = baseUrl.replace(/\/$/, "");
  return [...new Set([baseUrl, trimmed, `${trimmed}/agents`, `${trimmed}/agent-state`])];
}

async function fetchRlRestSnapshot(fetchImpl: typeof fetch, baseUrl: string): Promise<unknown> {
  let lastStatus = "no successful RL REST responses";

  for (const url of restCandidates(baseUrl)) {
    const response = await fetchImpl(url);
    if (!response.ok) {
      lastStatus = `${response.status} ${response.statusText}`.trim();
      continue;
    }

    return response.json();
  }

  throw new Error(`RL REST fallback request failed: ${lastStatus}`);
}

export function startRlConnectionRuntime(options: RlConnectionRuntimeOptions = {}): () => void {
  const bus = options.bus ?? eventBus;
  const store = options.store ?? useConnectionStore();
  const wsUrl = options.wsUrl ?? rlWsUrl;
  const restUrl = options.restUrl ?? rlRestUrl;
  const restPollMs = options.restPollMs ?? 5_000;
  const freshnessIntervalMs = options.freshnessIntervalMs ?? 1_000;
  const maxAgeMs = options.maxAgeMs ?? 5_000;
  const fetchImpl = options.fetchImpl ?? globalThis.fetch?.bind(globalThis);
  const createClient = options.createClient ?? ((url: string) => new RlStreamClient({ url }));

  let client: RlStreamClient | null = null;
  let offConnection = () => {};
  let offMessage = () => {};
  let freshnessTimer: ReturnType<typeof setInterval> | null = null;
  let restTimer: ReturnType<typeof setInterval> | null = null;
  let restInFlight = false;

  const stopRestFallback = () => {
    if (restTimer) {
      clearInterval(restTimer);
      restTimer = null;
    }
  };

  const pollRestFallback = async () => {
    if (!restUrl || !fetchImpl || restInFlight) return;
    restInFlight = true;

    try {
      const payload = await fetchRlRestSnapshot(fetchImpl, restUrl);
      const result = ingestRlRestPayload(bus, payload);
      if (result.ok) {
        store.markRlMessageReceived(Date.now(), "rest");
      } else {
        store.setRlFallbackStatus("failed");
      }
    } catch {
      store.setRlFallbackStatus("failed");
    } finally {
      restInFlight = false;
    }
  };

  const startRestFallback = () => {
    if (!restUrl || !fetchImpl || restTimer) return;
    store.setRlFallbackStatus("connecting");
    void pollRestFallback();
    restTimer = setInterval(() => {
      void pollRestFallback();
    }, restPollMs);
  };

  if (!wsUrl && !restUrl) {
    return () => {};
  }

  freshnessTimer = setInterval(() => {
    store.evaluateRlFreshness(maxAgeMs);
  }, freshnessIntervalMs);

  if (wsUrl) {
    client = createClient(wsUrl);
    offConnection = client.onConnection((status) => {
      store.setRlTransportStatus(status);
      if (status === "connected") {
        stopRestFallback();
        return;
      }

      if (status === "failed") {
        startRestFallback();
      }
    });
    offMessage = client.onMessage((message) => {
      const result = ingestRlWsMessage(bus, message);
      if (result.ok) {
        store.markRlMessageReceived();
      }
    });
    client.connect();
  } else {
    startRestFallback();
  }

  return () => {
    stopRestFallback();
    if (freshnessTimer) {
      clearInterval(freshnessTimer);
      freshnessTimer = null;
    }
    offMessage();
    offConnection();
    client?.disconnect();
  };
}

export function ensureRlConnection(): void {
  if (shutdownRuntime) return;
  shutdownRuntime = startRlConnectionRuntime();
}

export function shutdownRlConnection(): void {
  shutdownRuntime?.();
  shutdownRuntime = null;
}