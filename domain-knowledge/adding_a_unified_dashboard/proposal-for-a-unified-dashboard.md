# Proposal for a Unified Dashboard

## Status Note

This document captures the original proposal and solution framing for the unified dashboard effort.

- Treat it as historical design context.
- Some folder examples and future-tense statements reflect the proposal stage rather than the exact shipped implementation.
- For the implemented branch state, use `docs/unified-dashboard-current-state.md`.

## 1. Purpose

This document proposes a full "OpenClaw Canvas" dashboard that unifies:

- ROS2 robot observability and control (via rosbridge)
- OpenClaw-RL agent observability and control (via WebSocket and/or REST)
- A single operator experience for live missions, debugging, and training analysis

The key goal is to move from a minimal connectivity test UI to a production-grade operator console.

## 2. Problem Statement

Current state:

- ROS2 and rosbridge are working
- The existing UI in `ui/` proves basic connectivity
- OpenClaw-RL expects richer dashboard capabilities that do not yet exist

Gap:

- No unified frontend architecture for robot state + RL state
- No robust message routing layer
- No panels for multi-agent coordination, reward visualization, action inspection, or mission control

Consequence:

- Operators cannot monitor and control the full stack in one place
- Debugging cross-system issues (robot transport vs policy behavior) remains slow

## 3. Product Outcomes

A successful unified dashboard should enable:

1. Real-time situational awareness
2. Safe intervention and command control
3. RL policy introspection and performance tracking
4. Fast debugging of ROS2 and RL integration issues
5. Multi-agent mission coordination from one interface

## 4. Core Design Principles

1. Safety first: emergency stop and command gating are always available
2. Explainability: every action and state transition is traceable
3. Progressive disclosure: simple defaults with advanced drill-down panels
4. Loose coupling: independent adapters for ROS and RL backends
5. Time alignment: all streams normalized to a common timeline
6. Failure transparency: explicit degraded mode and reconnection states
7. Shift-left quality: every feature ships with unit, integration, and E2E coverage at the right level

## 5. Proposed System Architecture

### 5.1 Frontend Module Layers

1. Presentation layer
- Dashboard shell, sidebar, views, panel layout manager
- Operator-centric widgets (maps, telemetry charts, tables, logs)

2. Domain state layer
- Robot domain store (pose, battery, sensors, nav state)
- RL domain store (agent status, action vectors, rewards, episode metadata)
- Mission domain store (task queue, policy mode, goals, alerts)

3. Data integration layer
- ROS adapter: rosbridge subscriptions/publications/service calls
- RL adapter: WebSocket streams + REST queries/commands
- Event bus and schema normalizer

4. Persistence and replay layer
- Session metadata (mission id, environment, policy version)
- Optional local event ring buffer for quick replay and bug reports

### 5.2 Backend Interfaces Expected by UI

ROS side (via rosbridge):

- Topic discovery (list topics and message types)
- Subscribe and unsubscribe controls
- Publish controls with message validation
- Service call UI (for supported service contracts)

RL side (WebSocket/REST):

- Agent registry and live status
- Per-agent state snapshots and deltas
- Action output stream
- Reward stream and episode summaries
- Control endpoints (start, pause, stop, reset, set mode)

## 6. Dashboard Information Architecture

### 6.1 Global Navigation

1. Overview
2. Robots
3. Agents
4. Topics and Messages
5. Control Center
6. Metrics and Rewards
7. Mission Timeline
8. Alerts and Safety
9. Settings

### 6.2 Suggested Main Views

Overview
- Fleet summary cards (online/offline, mission state, active policy)
- Mini map/canvas and top alerts
- Recent critical actions and failures

Robots
- Per-robot pose, velocity, battery, health, localization confidence
- Sensor tiles (camera status, lidar stats, imu quality)
- Quick actions (dock, hold position, safe mode)

Agents
- Agent list with status, current objective, policy version
- Live action vectors and confidence/entropy indicators
- Per-agent debug stream and state machine visualization

Topics and Messages
- Topic explorer with filter by namespace/type/frequency
- Message inspector with pretty JSON and raw view
- Message rate, drop indicators, and latency estimates
- Publish panel with schema-aware form builder

Control Center
- Manual command panel
- RL mode controls (manual, assist, autonomous)
- Scenario controls (start episode, reset environment)
- Batch controls for multi-agent orchestration

Metrics and Rewards
- Reward over time charts
- Episode return, success rate, and safety penalties
- Action distribution histograms
- ROS execution metrics (loop frequency, command lag)

Mission Timeline
- Unified event log across ROS and RL channels
- Time scrubbing with synchronized state snapshots
- Bookmarking for anomaly investigation

Alerts and Safety
- Severity-based alert list
- Safety rule violations and threshold breaches
- Acknowledge/escalate workflow
- Always-on emergency stop banner/button

Settings
- Backend endpoints and auth
- Topic presets and panel layout profiles
- Sampling and retention controls
- Feature flags for experimental modules

## 7. Essential Feature Set

### 7.1 ROS2 Capabilities

- Dynamic topic discovery and namespace grouping
- Subscription manager with per-topic QoS-aware settings where possible
- Topic echo with pause/resume and export
- Topic publishing templates for frequent commands
- Service invocation with known service schemas

### 7.2 RL Capabilities

- Agent lifecycle controls (start, pause, resume, stop)
- Live policy outputs and selected action explanations
- Reward decomposition (task reward vs penalty terms)
- Episode management and comparison
- Multi-agent coordination view (roles, dependencies, contention)

### 7.3 Cross-Domain Capabilities

- Correlate action outputs with robot telemetry changes
- Display command provenance (human vs policy vs automation)
- End-to-end latency tracking:
  - policy decision time
  - command publish time
  - robot response signal
- Unified mission state model shared across ROS and RL

## 8. Data Contracts and Normalization

Define stable UI-facing contracts regardless of transport source.

Recommended canonical event envelope:

- `event_id`
- `timestamp_source`
- `timestamp_ui_received`
- `source` (`rosbridge`, `rl-ws`, `rl-rest`, `operator`)
- `entity_type` (`robot`, `agent`, `mission`, `system`)
- `entity_id`
- `event_type`
- `payload`
- `trace_id` (for command-response correlation)

Benefits:

- Consistent rendering and filtering
- Easier replay and debugging
- Clear ownership between adapter and UI panel code

## 9. Reliability and Failure Modes

The dashboard should explicitly handle:

- rosbridge disconnected, RL connected
- RL disconnected, rosbridge connected
- both connected but stale data
- partial topic failures
- malformed payloads from either side

UX behavior in degraded mode:

- Non-blocking warning banners
- Last-known-state markers with staleness age
- Automatic reconnect with exponential backoff
- Manual reconnect and diagnostics panel

## 10. Safety and Governance

Baseline safety requirements:

- Hardware E-stop remains physical source of truth
- UI E-stop command prominently visible and protected
- Critical command confirmation for destructive actions
- Role-based command permissions
- Immutable audit trail for all operator and agent actions

Safety analytics:

- Rate-limit violations
- Unexpected action magnitude spikes
- Out-of-bound reward penalties indicating unsafe behavior

## 11. Visual and Interaction Model

The interface should be built for long operator sessions:

- Dense but readable telemetry layouts
- High contrast alerting and clear severity colors
- Dockable/resizable panel grid for different workflows
- Keyboard shortcuts for high-frequency operations
- Mobile compatibility for read-only status checks

## 12. Suggested Implementation in This Repository

Near-term path using existing structure:

- Evolve `ui/` into the main dashboard app
- Implement adapter modules in `ui/src`:
  - `adapters/rosbridge/`
  - `adapters/rl/`
  - `core/event-bus/`
  - `stores/`
  - `panels/`
- Keep transport concerns isolated from view components
- Reuse and align with plugin transport abstractions from `extensions/openclaw-plugin/src/transport/` where practical

## 13. Delivery Plan (Phased)

### Phase 1: Foundation (MVP)

- App shell, navigation, connection manager
- ROS topic explorer + echo + publish
- RL agent list + status stream
- Basic reward chart and action stream
- Safety banner + E-stop control panel
- Initial automated test harness (unit + integration + smoke E2E)

Exit criteria:

- One robot and one agent can be monitored and controlled from a single screen
- CI runs unit and integration tests on every PR
- A smoke E2E test validates connection badge + canvas + waiting state

### Phase 2: Operational Dashboard

- Multi-panel layout system
- Mission timeline and event correlation
- Multi-agent coordination panel
- Alerting rules and acknowledgment flow
- Command provenance and latency tracing
- Expanded E2E coverage for reconnect and publish/observe workflows

Exit criteria:

- Operators can diagnose cross-system issues without external tooling
- PRs modifying control or transport code require updated E2E expectations

### Phase 3: Advanced Analytics and Replay

- Session recording and replay
- Episode comparison tooling
- Reward decomposition and anomaly highlighting
- Historical trend analysis and exports
- Deterministic replay test suite for timeline correctness

Exit criteria:

- Teams can perform post-run root-cause analysis inside the dashboard
- Replay output is verifiably consistent across test runs

## 14. Test Strategy and Quality Gates

Testing should be treated as a development requirement, not a post-build activity. For this refactor, the expectation is:

- New code includes tests in the same PR
- Existing code touched by a change gains or updates tests
- Failing tests block merge for dashboard packages

### 14.1 Test Pyramid for This Dashboard

Unit tests (fast, high volume):

- Message parsers and schema guards
- Event normalization and timestamp handling
- Domain stores/selectors and derived state
- Utility math (pose transforms, heading conversion)
- Component rendering logic with mocked stores

Integration tests (medium speed, contract-focused):

- rosbridge adapter:
  - connect/disconnect state transitions
  - subscribe/unsubscribe request flow
  - reconnect and re-subscribe behavior
- RL adapter:
  - WebSocket stream ingestion
  - REST fallback behavior
  - command-response correlation via `trace_id`
- Event bus:
  - routing correctness
  - backpressure handling/throttling behavior
  - malformed message containment

End-to-end tests (slower, high confidence):

- Full docker-compose path from ROS2 publication to UI rendering
- Critical operator flows (E-stop, mode switch, command publish)
- Connection recovery and stale-state behavior

### 14.2 Incorporating Current E2E Guidance

The existing validation flow in `docs/ui-e2e-testing.md` should be incorporated as formal automated E2E scenarios and kept as manual fallback checks.

Baseline E2E scenarios to automate first:

1. Smoke boot:
- UI loads
- connection badge reaches `connected`
- canvas is visible
- waiting hint appears before first odometry

2. Odometry render path:
- publish `/odom`
- waiting hint disappears
- marker appears
- heading arrow reflects orientation

3. Movement update:
- publish changed pose
- marker position and heading update

4. Reconnect and re-subscribe:
- stop ROS2 container
- badge transitions to `disconnected`/`connecting`
- restart ROS2
- publish `/odom` and confirm updates resume

These tests should run in CI against docker compose services so the real transport chain is validated.

### 14.3 Definition of Done for Every Feature PR

Each feature PR should include:

1. Unit tests for new domain logic and utilities
2. Integration tests for adapter/store interactions impacted by the change
3. E2E updates if user-visible behavior, transport behavior, or control paths changed
4. Updated docs for any new operational checks

Required merge gate for dashboard PRs:

- Type-check passes
- Lint passes
- Unit tests pass
- Integration tests pass
- E2E smoke suite passes

### 14.4 Suggested Test Ownership by Layer

- `ui/src/adapters/*`: integration-first, with targeted unit tests
- `ui/src/stores/*`: unit tests for transitions/selectors + integration tests with adapters
- `ui/src/components/*`: unit/component tests for rendering and interaction states
- cross-stack behavior: E2E tests using docker compose

### 14.5 Early Tooling Direction

Recommended practical setup (can be adjusted during detailed spec phase):

- Unit and integration: Vitest + Vue Test Utils
- E2E browser automation: Playwright
- Cross-service orchestration: existing docker compose stack

## 15. Non-Functional Requirements

- UI update rate targets:
  - telemetry: 5-20 Hz per stream depending on panel
  - charts: throttled rendering to maintain smoothness
- Startup to usable screen: under 3 seconds on dev hardware
- Graceful handling of burst traffic and backpressure
- Typed contracts end-to-end (TypeScript strict mode)
- Automated UI tests for critical control flows (E-stop, mode switch, publish), with these flows included in CI

## 16. Risks and Mitigations

Risk: Data model drift between ROS messages and RL payloads
Mitigation: Strict adapter boundaries + schema validation at ingress

Risk: Operator overload from too many panels
Mitigation: Preset layouts by role (operator, researcher, incident response)

Risk: Unsafe command issuance
Mitigation: Confirmation gates + permission model + audit trail

Risk: Performance degradation under high message rates
Mitigation: Sampling controls, virtualization, and render throttling

Risk: Test flakiness from real-time async streams
Mitigation: deterministic fixtures, bounded waits, and explicit retry policy for container startup only

## 17. Definition of Done for the Unified Dashboard

The dashboard can be considered successful when:

1. ROS and RL systems are both connected and observable in one app
2. Operators can issue safe commands and verify outcomes in real time
3. Reward and action behavior can be correlated with robot telemetry
4. Multi-agent mission status is visible and actionable
5. Failures are clearly surfaced with enough context to debug quickly
6. Unit, integration, and E2E suites cover critical paths and are enforced in CI

## 18. Recommended Next Build Slice

A practical first implementation slice:

1. Connection status bar for rosbridge and RL backend
2. Topic explorer with subscribe and message inspector
3. Agent list with live state and reward sparkline
4. Unified event log with source filter
5. Control panel with E-stop and mode toggle
6. Automated tests for the above slice:
  - unit tests for connection state and message normalization
  - integration test for rosbridge reconnect + re-subscribe
  - E2E smoke based on `docs/ui-e2e-testing.md`

This first slice delivers immediate operational value while setting the architecture needed for full OpenClaw Canvas capabilities.
