# Spec for a Unified Dashboard

## Status Note

This specification is the design target for the unified dashboard.

- It still describes the intended product behavior and acceptance criteria.
- The branch implementation covers a substantial portion of this scope, but not every item is complete yet.
- For the current implemented surface and known gaps, use `docs/unified-dashboard-current-state.md`.

## 1. Document Status

- Name: OpenClaw Canvas Unified Dashboard Specification
- Version: 1.0 draft
- Scope: Web dashboard refactor and expansion in the existing `ui/` app
- Audience: Product owner, robotics engineers, frontend developers, integration engineers, QA

## 2. Executive Summary

This specification defines a complete dashboard that unifies:

- ROS2 observability and control through rosbridge
- OpenClaw-RL observability and control through WebSocket and REST
- One operator experience for mission monitoring, intervention, debugging, and analysis

The existing UI is a minimal transport proof that renders `/odom`. The new dashboard must become a robust operations surface with:

- Multi-panel real time views
- Safe command controls
- RL state and reward visibility
- Unified timeline and event correlation
- Built-in quality gates (unit, integration, E2E)

## 3. Goals and Non-Goals

### 3.1 Goals

1. Provide a single pane of glass for robot plus RL state.
2. Support mission operations with low-latency visual feedback.
3. Enable safe intervention with explicit command provenance.
4. Make failures and reconnect behavior obvious and debuggable.
5. Ship with test coverage that grows with every feature.

### 3.2 Non-Goals (for first delivery)

1. Building a full data warehouse for long-term analytics.
2. Replacing hardware safety systems with software controls.
3. Solving all backend schema instability in the UI layer.
4. Building a mobile-first control interface (mobile is read-only oriented at first).

## 4. Users and Primary Workflows

### 4.1 User Roles

1. Operator
- Watches live state, sends safe commands, responds to alerts.

2. RL Engineer
- Tracks policy outputs, reward signals, episode behavior.

3. Robotics Engineer
- Inspects topics/services, validates motion/telemetry behavior.

4. Incident Responder
- Diagnoses disconnects, stale streams, and unsafe actions.

### 4.2 Core Workflows

1. Bringup and health check
- Connect to rosbridge and RL backend.
- Confirm status badges, stream freshness, and alert baseline.

2. Mission monitoring
- Watch map/canvas, agents, rewards, and events in one layout.

3. Guided intervention
- Pause/resume policy, issue command, verify result and provenance.

4. Debugging session
- Open topic inspector, compare timeline events, replay recent sequence.

## 5. Functional Requirements

### 5.1 Global Application Shell

1. Top status bar
- rosbridge connection state: connecting/connected/disconnected/stale
- RL backend connection state: connecting/connected/disconnected/stale
- mission mode indicator: manual/assist/autonomous
- global clock and latency indicator

2. Left navigation
- Overview
- Robots
- Agents
- Topics and Messages
- Control Center
- Metrics and Rewards
- Mission Timeline
- Alerts and Safety
- Settings

3. Layout manager
- Dockable panels
- Save/load layout presets
- Role-based defaults (operator, RL engineer, incident response)

### 5.2 Overview View

Must include:

- Fleet summary cards (online robots, active agents, alerts)
- Mini canvas with current robot pose markers
- Reward trend sparkline
- Recent critical events list

Acceptance checks:

- Loads under 3 seconds in normal dev environment
- Shows explicit empty state when data is unavailable

### 5.3 Robots View

Must include:

- Robot selector and namespace filter
- Pose, velocity, battery, localization confidence
- Sensor health tiles (camera/lidar/imu stream alive indicators)
- Quick actions: hold position, dock, safe mode

Acceptance checks:

- Telemetry refreshes at configured rates without UI lockups
- Stale telemetry clearly marked with age

### 5.4 Agents View

Must include:

- Agent list with status (idle/running/paused/error)
- Current policy version and objective
- Live action output preview
- Confidence/entropy indicators when available
- State-machine style transition list

Acceptance checks:

- Agent status changes visible within expected network latency
- Action stream failures are visible but non-fatal to other panels

### 5.5 Topics and Messages View

Must include:

- Topic discovery list with namespace/type/rate filters
- Subscribe/unsubscribe controls
- Message inspector (formatted and raw)
- Publish form with schema-aware validation
- Service invocation panel for selected services

Acceptance checks:

- User can subscribe to `/odom` and see payload updates
- Invalid publish payload is blocked with clear error messages

### 5.6 Control Center View

Must include:

- Manual command form for allowed operations
- Mode switching (manual/assist/autonomous)
- Scenario controls (start/reset episode)
- Batch action support for multi-agent operations
- Prominent E-stop command entry point

Acceptance checks:

- High-risk controls require confirmation
- Command provenance is logged and visible

### 5.7 Metrics and Rewards View

Must include:

- Reward over time chart
- Reward decomposition (task reward, penalties)
- Episode return and success rate
- Action distribution chart
- Command latency and loop timing metrics

Acceptance checks:

- Charts remain responsive under bursty streams
- Time windows and smoothing settings are user-configurable

### 5.8 Mission Timeline View

Must include:

- Unified event stream (ROS, RL, operator actions)
- Filter by source/entity/severity
- Time scrubber with synchronized panel updates
- Bookmark and annotation support

Acceptance checks:

- Timeline events can be traced to command outcomes using `trace_id`

### 5.9 Alerts and Safety View

Must include:

- Severity-based alert list and counters
- Alert acknowledge flow with operator identity
- Safety rule trigger history
- Fast access to E-stop and system diagnostics

Acceptance checks:

- Critical alerts always visible in global shell
- Alert acknowledgment is audit-logged

### 5.10 Settings View

Must include:

- Backend endpoint configuration
- Authentication/session controls
- Topic presets
- Sampling/throttle settings
- Feature flags and debug toggles

Acceptance checks:

- Settings persist across reloads
- Dangerous debug options require explicit confirmation

## 6. Data and Integration Contracts

### 6.1 Canonical Event Envelope

All incoming/outgoing events should be normalized to:

- `event_id: string`
- `timestamp_source: string` (ISO)
- `timestamp_ui_received: string` (ISO)
- `source: 'rosbridge' | 'rl-ws' | 'rl-rest' | 'operator'`
- `entity_type: 'robot' | 'agent' | 'mission' | 'system'`
- `entity_id: string`
- `event_type: string`
- `payload: unknown`
- `trace_id?: string`
- `severity?: 'info' | 'warning' | 'error' | 'critical'`

### 6.2 ROS Adapter Contract

Inputs:

- WebSocket endpoint
- subscribe/unsubscribe requests
- publish requests
- service call requests

Outputs:

- normalized topic events
- connection status events
- error events with recoverability metadata

Rules:

- automatic reconnect with exponential backoff
- automatic re-subscribe after reconnect
- schema validation for publish payloads where message type known

### 6.3 RL Adapter Contract

Inputs:

- WebSocket endpoint and optional REST base URL
- control commands (start/pause/resume/stop/reset)

Outputs:

- agent status events
- reward and action events
- command acknowledgment events

Rules:

- command events carry `trace_id`
- fallback behavior if WS stream down but REST available

### 6.4 Time and Ordering

Requirements:

- preserve source timestamp and UI receive timestamp
- show source clock skew indicator if detected
- avoid strict global ordering assumptions across independent streams

## 7. Reliability and Failure Handling

### 7.1 Connection States

Per backend state machine:

- idle -> connecting -> connected
- connected -> stale
- connected/stale -> reconnecting
- reconnecting -> connected or failed

### 7.2 Degraded Modes

1. ROS only available
- robot panels functional
- RL panels show unavailable state

2. RL only available
- agent/reward panels functional
- robot control disabled with clear reason

3. Partial stream failures
- panel-level error boundaries
- unaffected panels continue running

### 7.3 Error UX Requirements

- human-readable error summary
- expandable technical detail
- retry actions where possible
- no silent failures for control actions

## 8. Safety and Governance

### 8.1 Safety Controls

1. Hardware E-stop remains primary.
2. UI E-stop must be always reachable.
3. High-risk commands require confirmation and reason text.
4. Command rate limiting for risky operations.

### 8.2 Permissions

Suggested role model:

- Viewer: read-only
- Operator: standard commands
- Supervisor: high-risk command permission
- Admin: config and feature flags

### 8.3 Audit Trail

Audit record fields:

- user identity
- command name
- parameters hash/redacted payload
- timestamp
- target entity
- result status
- trace_id

## 9. UI and Design Specification

This section focuses on practical design guidance for someone new to web app styling and tooling.

### 9.1 What Tailwind Can Do for You

Tailwind is a utility-first CSS framework. It helps you build layouts and component styling quickly without writing large custom CSS files.

Benefits for this project:

1. Fast iteration
- Good for rapidly building many dashboard panels.

2. Consistency
- Shared spacing, typography, color tokens across views.

3. Responsive behavior
- Easy mobile/read-only adaptations with breakpoint utilities.

4. Theming support
- Works well with CSS variables for mission or severity themes.

Tradeoffs:

- Class-heavy templates can look noisy.
- Team needs discipline around reusable component patterns.

Recommendation:

- Use Tailwind for layout, spacing, typography, and states.
- Use small reusable Vue components to avoid giant class strings.
- Define project tokens through CSS variables and map them into Tailwind config.

### 9.2 Preferred Frontend Approach

Recommended stack for this repo:

- Vue 3 + TypeScript
- Pinia for state stores
- Vue Router for top-level views
- Tailwind CSS for styling
- Headless UI patterns (or equivalent) for accessible primitives
- Chart library for telemetry/reward (for example, ECharts or Chart.js)

Why this is reasonable:

- Matches existing Vue foundation.
- Keeps complexity moderate.
- Scales to data-dense operations UIs.

### 9.3 Design Tokens and Visual Language

Define tokens in one source of truth:

- color.background.base
- color.background.panel
- color.text.primary
- color.text.muted
- color.status.info/warn/error/critical
- color.connection.connected/connecting/disconnected/stale
- spacing scale (4, 8, 12, 16, 24, 32)
- radius scale
- shadow scale
- z-index layers

Use severity colors consistently:

- info: blue
- warning: amber
- error: red
- critical: high-contrast red with persistent affordance

### 9.4 Layout Guidance

Desktop (primary):

- 12-column grid
- fixed shell regions for navigation and status bar
- panel cards with resize and drag support

Tablet:

- reduced panel density
- focus mode per panel

Mobile (secondary, read-only first):

- stacked cards
- alerts and status prioritized over editing controls

### 9.5 Accessibility Requirements

- keyboard navigable controls
- focus-visible states
- color contrast at WCAG AA minimum
- ARIA labels for icon-only controls
- reduced-motion mode for animations

### 9.6 Interaction Patterns

- optimistic UI only when safe and reversible
- explicit pending states for command submissions
- inline validation for publish/service forms
- contextual empty states with next-step hints

## 10. Frontend Architecture and File Plan

Target structure under `ui/src`:

- `app/`
  - shell, routes, app providers
- `adapters/`
  - `rosbridge/`
  - `rl/`
- `core/`
  - event bus
  - schema validators
  - logging and tracing helpers
- `stores/`
  - connection store
  - robot store
  - agent store
  - mission store
  - alert store
- `features/`
  - overview
  - robots
  - agents
  - topics
  - control-center
  - metrics
  - timeline
  - alerts
  - settings
- `components/`
  - reusable UI primitives and panel wrappers
- `styles/`
  - tokens
  - Tailwind base/extensions
- `tests/`
  - unit
  - integration
  - e2e

## 11. Testing Specification

### 11.1 Testing Policy

For every feature:

1. Add or update unit tests.
2. Add or update integration tests for adapter/store contracts.
3. Add or update E2E tests if user-visible behavior or transport flow changed.
4. No merge if required suites fail.

### 11.2 Unit Test Scope

Examples:

- parse and normalize rosbridge message
- parse and normalize RL message
- derive connection summary from two backends
- convert quaternion to heading
- render status badge variant by state

### 11.3 Integration Test Scope

Examples:

- adapter emits state transitions on reconnect
- store receives normalized events and updates selectors
- publish form validates payload and dispatches command envelope
- event bus throttles high-rate streams as configured

### 11.4 E2E Scope (baseline from existing guide)

Automate these first:

1. Smoke boot and connection badge state.
2. `/odom` publish causes robot marker render.
3. Pose update changes marker and heading.
4. ros2 stop/start validates reconnect and re-subscribe.

Add next:

5. E-stop flow and audit entry appears.
6. Mode switch manual <-> autonomous with confirmation.
7. RL agent state stream visible in Agents view.

### 11.5 CI Gates

Required checks on PR:

- type-check
- lint
- unit tests
- integration tests
- E2E smoke tests

Nightly or scheduled checks:

- full E2E suite
- replay determinism tests
- performance regression checks

## 12. Performance and Scalability

### 12.1 Targets

- initial view usable under 3 seconds on dev hardware
- visible telemetry update cadence 5 to 20 Hz depending on panel
- no dropped frame storms in normal operation

### 12.2 Techniques

- sampling and throttling in adapters
- virtualized lists for high-volume event logs
- chart point decimation for long windows
- worker-based parsing if payload volume requires it

## 13. Security and Privacy

- sanitize all displayed payloads
- protect against script injection in message viewers
- redact sensitive fields in logs and audit exports
- avoid storing credentials in plain local storage

## 14. Observability of the Dashboard Itself

Include frontend telemetry for:

- connection uptime by backend
- reconnect counts
- command success/failure rates
- render/frame performance for heavy panels
- uncaught exception counts

This helps detect UI regressions quickly during operation.

## 15. Phased Delivery Plan with Spec-Level Exit Criteria

### Phase 1: Foundation

Deliverables:

- App shell and navigation
- Connection manager for ROS and RL
- Topics inspector MVP
- Agents list MVP
- E-stop entry and confirmation flow
- Test harness (unit + integration + smoke E2E)

Exit criteria:

- `/odom` path tested end-to-end in CI
- reconnect behavior proven by automated test
- one robot + one agent visible on same dashboard

### Phase 2: Operations

Deliverables:

- Multi-panel layout persistence
- Mission timeline and filters
- Alert acknowledgment flow
- Expanded control center
- reward/action analytics panel v1

Exit criteria:

- operator can investigate an incident without external UI tools
- critical command paths covered by E2E tests

### Phase 3: Analytics and Replay

Deliverables:

- session recording
- replay timeline synchronization
- episode comparison
- anomaly highlighting

Exit criteria:

- deterministic replay verification passes
- post-run root-cause analysis possible entirely in dashboard

## 16. Detailed Acceptance Criteria Matrix

1. Connectivity
- Given valid ROS and RL endpoints, when app starts, then both status badges become connected and show last heartbeat.

2. Odometry rendering
- Given valid `/odom` messages, when messages arrive, then marker position and heading update within expected latency.

3. Reconnect behavior
- Given ROS backend restarts, when connection drops and returns, then subscriptions recover automatically without manual refresh.

4. Safety controls
- Given a high-risk command, when user submits, then confirmation is required and action is audit-logged.

5. Alerting
- Given a critical fault event, when event is received, then global shell highlights alert and alerts panel contains details.

6. Timeline correlation
- Given command and resulting telemetry, when filtering by `trace_id`, then related events appear together.

7. Test enforcement
- Given a PR to dashboard code, when CI runs, then required test suites gate merge.

## 17. Open Questions for Detailed Refactor Spec

1. RL backend authoritative contract: exact WebSocket schemas and REST endpoints?
2. Auth model for operator identity and role mapping?
3. Required retention period for audit and timeline data?
4. Should replay recording be local-only at first or server-backed?
5. Preferred charting library after quick spike evaluation?

## 18. Recommended Defaults (if you want fast progress)

1. Use Tailwind for styling with strict component conventions.
2. Use Pinia stores split by domain (robot, agent, mission, alerts, connection).
3. Use Playwright for E2E against docker compose.
4. Treat `/odom` flow as the first golden test path.
5. Keep adapters thin and schema-validated; keep view components dumb.

## 19. Implementation Kickoff Checklist

1. Create folder structure under `ui/src` per this spec.
2. Add Tailwind with design token scaffolding.
3. Implement connection store and dual-backend status bar.
4. Port existing `/odom` canvas behavior into Robots or Overview panel.
5. Add baseline unit and integration tests.
6. Add smoke E2E test based on existing `docs/ui-e2e-testing.md` flow.
7. Wire CI to enforce test gates.

---

This specification is intended to be the direct input for the next artifact: a task-level refactor plan with ticketized work items, estimate ranges, and dependency ordering.
