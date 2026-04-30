# Unified Dashboard Current State

This document describes the dashboard as implemented on the `adding-a-unified-dashboard` branch. Use it as the current-state reference for contributors, reviewers, and testers.

For original design intent and phased delivery planning, see the documents under `domain-knowledge/adding_a_unified_dashboard/`.

## Status

The dashboard is no longer only a rosbridge proof-of-connectivity app. It now includes a routed application shell, shared event normalization, domain stores, safety and audit surfaces, and replay tooling.

Implemented today:

- Overview, Agents, Topics, Control, Metrics, Timeline, Alerts, Settings, Replay, and Episodes routes
- shared canonical event envelope for ROS, RL, and operator events
- rosbridge connection lifecycle and RL runtime with REST fallback
- global E-stop entry and audit-linked control workflows
- layout persistence for Overview panels by role
- session capture, replay, and episode comparison tooling

Not fully implemented yet:

- dedicated Robots view
- full dockable panel manager across the entire app
- durable backend persistence for alerts, audit, and replay data
- synchronized multi-operator layout storage
- finalized backend control contracts beyond the current MVP defaults

## Route Coverage

### `/overview`

- Summary cards for robots, agents, mission status, and alerts
- `/odom` mini-canvas preserving the golden path
- top alerts panel
- recent topic event preview

### `/robots`

- Placeholder route only
- planned destination for richer robot telemetry, health, and quick actions

### `/agents`

- RL connection status
- agent summary counts
- status, objective, policy version, last action, last reward

### `/topics`

- topic discovery and filtering
- subscribe and unsubscribe controls
- payload viewer with formatted metadata and raw JSON
- schema-aware publish validation for known message types
- service discovery and service-call form for known service types

### `/control`

- mode switching for `manual`, `assist`, and `autonomous`
- autonomous-mode confirmation gate
- scenario start and reset actions
- action provenance history with trace identifiers

### `/metrics`

- reward trend sparklines
- action histogram
- command success rate and latency summaries
- performance-conscious decimation for render-heavy series

### `/timeline`

- unified event stream across `rosbridge`, `rl-ws`, `rl-rest`, and `operator`
- source, trace, and free-text filters
- trace correlation panel
- audit trail table for control actions
- virtualized event list rendering

### `/alerts`

- severity and acknowledgment filtering
- open and critical counts
- acknowledgment action published back through the canonical event flow

### `/settings`

- role-based Overview presets for `operator`, `rl-engineer`, and `incident-responder`
- panel visibility and ordering controls
- persistence in browser local storage

### `/replay`

- session capture start/stop flow
- export and import of session files
- replay engine controls with scrubber and speed options

### `/episodes`

- replay-session comparison
- anomaly indicators and recommendations
- currently operates on loaded replay data rather than a backend session catalog

## Architecture Summary

Core implementation areas:

- `ui/src/core/events/`: canonical event envelope and event bus
- `ui/src/services/`: rosbridge, RL runtime, control, topic explorer, replay, alerts
- `ui/src/stores/`: connection, robot, agent, mission, topic, alerts, timeline, control, layout, session capture
- `ui/src/views/`: routed UI surfaces

The important design choice is that new flows reuse the same canonical event path wherever possible. Replay, audit, alerts, and view updates are all built on top of that shared normalization and routing layer.

## Configuration

Supported UI environment variables:

- `VITE_ROSBRIDGE_URL`
- `VITE_RL_WS_URL`
- `VITE_RL_REST_URL`

If RL endpoints are not configured, RL views remain available but will show empty or unavailable-state messaging.

## Validation

Recommended checks from the repository root:

```bash
pnpm --filter @rosclaw/ui typecheck
pnpm --filter @rosclaw/ui test:unit
pnpm --filter @rosclaw/ui test:integration
pnpm --filter @rosclaw/ui test:e2e -- ui/e2e/smoke.spec.ts
```

For the real ROS `/odom` path, use `docs/ui-e2e-testing.md` and the default Docker stack.

## Documentation Map

- `docs/unified-dashboard-current-state.md`: this file, the implementation snapshot
- `docs/ui-e2e-testing.md`: current validation paths
- `domain-knowledge/adding_a_unified_dashboard/spec-for-a-unified-dashboard.md`: design specification and target behaviors
- `domain-knowledge/adding_a_unified_dashboard/plan-for-a-unified-dashboard.md`: phased delivery plan
- `domain-knowledge/adding_a_unified_dashboard/proposal-for-a-unified-dashboard.md`: original solution framing
- `domain-knowledge/adding_a_unified_dashboard/background-information.md`: historical pre-implementation context
- `domain-knowledge/adding_a_unified_dashboard/code-development-log.md`: implementation and validation log