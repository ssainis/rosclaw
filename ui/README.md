# RosClaw UI

The UI package is the Vue/Vite dashboard for RosClaw. It now goes beyond the original `/odom` transport proof and provides a routed operator surface for ROS telemetry, RL visibility, control actions, safety flows, replay, and comparison tooling.

For a current implementation summary, see `../docs/unified-dashboard-current-state.md`.

## Current Scope

Implemented routes:

- `/overview`: fleet summary, `/odom` mini-canvas, alerts preview, recent topic events
- `/agents`: RL agent status, objective, policy version, last action, last reward
- `/topics`: topic discovery, subscribe/unsubscribe, payload viewer, publish validation, service calls
- `/control`: mission mode changes, scenario controls, provenance history
- `/metrics`: reward trends, action histogram, command success and latency summaries
- `/timeline`: canonical event stream, trace correlation, audit trail
- `/alerts`: alert filtering and acknowledgment flow
- `/settings`: layout role presets and Overview panel persistence
- `/replay`: session capture, import/export, replay controls
- `/episodes`: replay session comparison and anomaly analysis

Known gap:

- `/robots` is still a placeholder route while the dedicated robot telemetry view is being finished.

## Configuration

Copy `./.env.example` to `.env` if you want explicit local settings.

Supported environment variables:

- `VITE_ROSBRIDGE_URL`: rosbridge WebSocket URL. Defaults to `ws://<current-host>:9090`.
- `VITE_RL_WS_URL`: optional RL WebSocket stream URL.
- `VITE_RL_REST_URL`: optional RL REST fallback base URL.

If both RL variables are unset, the dashboard still runs, but RL-specific views will remain empty or show unavailable-state messaging.

## Development

From the repository root:

```bash
pnpm install
pnpm --filter @rosclaw/ui dev
```

The default local stack is documented in `../docker/docker-compose.yml`. When that stack is running, the UI is typically available on `http://localhost:4173` and rosbridge on `ws://localhost:9090`.

## Test Commands

Run from the repository root:

```bash
pnpm --filter @rosclaw/ui typecheck
pnpm --filter @rosclaw/ui test:unit
pnpm --filter @rosclaw/ui test:integration
pnpm --filter @rosclaw/ui test:e2e -- ui/e2e/smoke.spec.ts
```

The unit and integration scripts intentionally use recursive bash glob expansion because nested Vitest globs are not expanded correctly by default in this environment.

## Architecture Notes

- Transport adapters stay separate from view logic.
- Incoming ROS, RL, and operator events are normalized into a canonical event envelope before routing.
- Shared Pinia stores back the routed dashboard views.
- Replay and episode comparison reuse the same canonical event path rather than a separate visualization pipeline.

Key implementation areas:

- `src/core/events/`: canonical envelope and event bus
- `src/services/`: rosbridge, RL runtime, control, topic explorer, replay, alert flows
- `src/stores/`: connection, agent, topic, mission, alerts, timeline, control, layout, session capture
- `src/views/`: routed dashboard surfaces

## Validation Guidance

Use `../docs/ui-e2e-testing.md` for the current dashboard validation flow. That guide covers the active shell, route smoke checks, `/odom` golden path, topics and control workflows, degraded-mode behavior, and replay-related caveats.
