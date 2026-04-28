# Code Development Log

## Scope
This log records all meaningful implementation activity completed so far for the unified dashboard effort in this branch.

## Repository Context
- Repository: PlaiPin/rosclaw
- Branch: adding-a-unified-dashboard
- Plan source: domain-knowledge/adding_a_unified_dashboard/plan-for-a-unified-dashboard.md
- Spec source: domain-knowledge/adding_a_unified_dashboard/spec-for-a-unified-dashboard.md

## Chronological Record

### 1) Plan and spec intake
- Read and reviewed the unified dashboard implementation plan.
- Read and reviewed the unified dashboard specification.
- Mapped the first execution slice to a Phase 1 style delivery aligned with:
  - shell + routing placeholders
  - connection model
  - rosbridge reconnect/resubscribe hardening
  - test harness bootstrap

### 2) Existing UI baseline assessment
- Inspected current UI entrypoints and styling to understand current behavior.
- Confirmed existing /odom golden path was implemented in a simple single-page dashboard.
- Inspected rosbridge client/composable and canvas component.
- Reviewed E2E testing guidance in docs/ui-e2e-testing.md.

### 3) Phase 1 implementation completed

#### 3.1 App shell and route structure
- Added router configuration with target view placeholders.
- Added shell layout with:
  - top status bar
  - side navigation
  - routed main content panel
- Added overview route preserving the /odom visualization path.
- Added placeholder views for remaining navigation targets.

#### 3.2 Connection store and lifecycle model
- Added a typed UI connection state model with statuses:
  - idle, connecting, connected, stale, reconnecting, failed
- Added store actions for:
  - transport status mapping
  - message freshness tracking
  - stale-state evaluation and recovery
- Added a rosbridge connection service to centralize connect/disconnect lifecycle and periodic freshness checks.

#### 3.3 Rosbridge adapter hardening
- Extended rosbridge transport status type to include reconnecting and failed states.
- Hardened client reconnect behavior to:
  - emit reconnecting status on unexpected close
  - emit failed when reconnect attempts are exhausted
- Preserved and reused topic message types across reconnects.
- Re-subscribed active topic subscriptions after reconnect with type information.

#### 3.4 UI foundation cleanup
- Replaced initial starter CSS with dashboard-oriented global tokens and baseline app styles.
- Wired app bootstrapping to use Pinia and Vue Router.
- Switched app root to shell-first architecture.

### 4) Test harness bootstrap and tests added

#### 4.1 Tooling and config
- Added test dependencies and scripts for:
  - unit tests (Vitest)
  - integration tests (Vitest)
  - E2E smoke tests (Playwright)
- Updated Vite config for Vitest jsdom environment and setup file.
- Added Playwright config and initial E2E directory.
- Updated .gitignore to exclude Playwright artifacts.

#### 4.2 New tests
- Unit tests for connection store transitions and stale/fresh behavior.
- Integration tests for rosbridge reconnect + re-subscribe behavior and failure-state transition.
- E2E smoke test for shell rendering and overview route baseline visibility.

### 5) Validation and execution outcomes

#### 5.1 Successful checks
- Typecheck: passed
- Unit tests: passed
- Integration tests: passed
- E2E smoke test: passed (after environment dependency fixes)

#### 5.2 Issues encountered and resolved
- E2E initially failed because Playwright browser binaries were not installed.
  - Action taken: installed Chromium via Playwright installer.
- E2E then failed due to missing system shared libraries in the dev container.
  - Action taken: installed required Linux runtime libraries via apt-get.
- Attempt to use Playwright --with-deps encountered an external apt repo signature error (Yarn repo key issue).
  - Workaround applied: directly installed required libraries with apt-get, then reran E2E successfully.

### 6) Phase 2 implementation slice started (EPIC 2 / T2.1)

#### 6.1 Canonical event envelope module
- Added canonical event envelope module under `ui/src/core/events/envelope.ts` with:
  - strict source/entity/severity union types
  - canonical envelope interface aligned to spec section 6.1
  - envelope builder with generated `event_id` and timestamp defaults
  - envelope validator returning structured validation errors
  - ROS header stamp (`sec|secs`, `nanosec|nsec|nsecs`) to ISO timestamp helper

#### 6.2 /odom path integration
- Wired overview `/odom` subscription callback to create a canonical envelope before pose mapping.
- Preserved existing golden-path render behavior by mapping pose from normalized envelope payload.
- Preserved freshness marking via existing connection store.

#### 6.3 Test coverage added
- Added unit tests in `ui/src/core/events/envelope.unit.test.ts` for:
  - envelope build defaults and generated identifiers
  - malformed envelope validation errors
  - ROS1/ROS2 header stamp timestamp extraction
  - builder failure on invalid required fields

#### 6.4 Validation and issues encountered during this phase
- Typecheck: passed.
- Unit tests: passed (7 tests total across connection + envelope suites).
- Integration tests: passed (rosbridge reconnect/resubscribe suite).
- E2E smoke: passed (`shell and overview render`).

Issues encountered and resolved:
- `pnpm --filter @rosclaw/ui test:unit` originally only executed one file due recursive glob expansion behavior in this environment.
  - Action taken: updated `ui/package.json` test scripts to use `bash` + `globstar` recursive expansion.
- First script revision using quoted globs produced "No test files found".
  - Action taken: replaced with recursive shell expansion approach.
- Second script revision failed with `vitest: command not found` inside `bash -lc`.
  - Action taken: switched to `pnpm exec vitest` in script; reran and confirmed passing.

### 7) Phase 2 implementation continued (EPIC 2 / T2.2)

#### 7.1 Event bus and routing
- Added typed event bus under `ui/src/core/events/bus.ts` with:
  - route subscriptions by `source`, `entity_type`, `entity_id`, `event_type` (string or regex), and `severity`
  - all-events subscription helper
  - malformed-event containment via envelope validation gate + malformed handlers
  - route handler isolation so one failing handler does not prevent other route handlers
  - throttling hooks (`getThrottleMs`, `getThrottleKey`) for burst stream control

#### 7.2 Runtime integration
- Added shared runtime bus singleton in `ui/src/core/events/runtime.ts`.
- Integrated Overview `/odom` callback to publish canonical envelopes into the event bus before local pose mapping.
- Preserved `/odom` golden-path rendering and freshness behavior.

#### 7.3 Test coverage added
- Added integration tests in `ui/src/core/events/bus.integration.test.ts` covering:
  - routing correctness by source and event type filters
  - malformed event containment and malformed handler notification
  - route handler error containment while continuing other routes
  - throttle hook behavior for high-frequency stream suppression

#### 7.4 Validation results for this slice
- Typecheck: passed.
- Unit tests: passed (7 tests).
- Integration tests: passed (6 tests, including new bus suite).
- E2E smoke: passed (`shell and overview render`) because the overview user-visible path was touched.

### 8) Phase 2 implementation completed for EPIC 2 (T2.3)

#### 8.1 Domain stores baseline
- Added baseline stores with selectors/getters and envelope ingestion actions:
  - `ui/src/stores/robot.ts`
  - `ui/src/stores/agent.ts`
  - `ui/src/stores/mission.ts`
  - `ui/src/stores/alerts.ts`
- Store coverage includes:
  - Robot pose state from `/odom` with recency-based online count selector
  - Agent snapshots/status counts/active agent selector
  - Mission status + mode snapshot with active selector
  - Alert feed with severity and unacknowledged counters

#### 8.2 Event-to-store routing integration
- Added domain event routing service in `ui/src/services/domain-event-routing.ts`.
- Wired app lifecycle to initialize and teardown domain event routing in `ui/src/App.vue`.
- Routing behavior:
  - all canonical events from event bus are dispatched to domain stores
  - malformed event containment emits a warning alert entry for visibility

#### 8.3 Tests added
- Unit tests:
  - `ui/src/stores/robot.unit.test.ts`
  - `ui/src/stores/agent.unit.test.ts`
  - `ui/src/stores/mission.unit.test.ts`
  - `ui/src/stores/alerts.unit.test.ts`
- Integration tests:
  - `ui/src/services/domain-event-routing.integration.test.ts`

#### 8.4 Validation results for this slice
- Typecheck: passed.
- Unit tests: passed (13 tests).
- Integration tests: passed (8 tests).
- E2E smoke: passed (`shell and overview render`) because app lifecycle and user-visible data plumbing were touched.

### 9) Phase 3 implementation started (EPIC 3 / T3.1)

#### 9.1 Latest commit confirmation
- Confirmed latest completed branch commit is `0841bd8` on `adding-a-unified-dashboard`.
- Commit subject: `feat: Complete Phase 2 implementation for EPIC 2, including domain stores, event routing, and associated tests`.
- This establishes Phase 2 EPIC 2 as the last committed baseline before starting RL ingest work.

#### 9.2 RL WebSocket adapter ingest slice
- Added RL WebSocket ingest adapter in `ui/src/services/rl-ws-adapter.ts`.
- Added tolerant normalization for unresolved RL contract variants so replayed messages can still map into canonical envelopes when they provide:
  - event kind (`type`, `event`, or `kind`)
  - agent identity (`agent_id`, `agentId`, or nested `agent.id`)
  - optional source timestamp (`timestamp`, `ts`, `created_at`)
  - optional trace id (`trace_id`, `traceId`)
- Canonical event mapping added for:
  - agent status -> `agent:status`
  - reward stream -> `agent:reward`
  - action stream -> `agent:action`
- All normalized RL events use canonical envelope source `rl-ws` and entity type `agent`.

#### 9.3 Agent store merge safety for RL events
- Updated `ui/src/stores/agent.ts` so non-status RL agent events no longer overwrite a valid agent status snapshot with `unknown`.
- Added incremental merge behavior for:
  - `agent:status` -> status/objective/policy version
  - `agent:reward` -> `lastReward`
  - `agent:action` -> `lastAction`
- This preserves the existing domain-store baseline while allowing reward/action ingestion to start before the Agents MVP view is built.

#### 9.4 Test coverage added for T3.1 ingest slice
- Added integration tests in `ui/src/services/rl-ws-adapter.integration.test.ts` covering:
  - replayed RL fixture stream normalization into canonical events
  - bus publication of status/reward/action events
  - domain store update from normalized status event plus reward/action merge behavior
  - malformed RL message containment before bus publication
- Extended `ui/src/stores/agent.unit.test.ts` to verify reward/action events do not clobber running agent status.

#### 9.5 Validation results for this slice
- Focused validation: passed (`ui/src/services/rl-ws-adapter.integration.test.ts`, `ui/src/stores/agent.unit.test.ts`).
- Typecheck: passed.
- Unit tests: passed (14 tests).
- Integration tests: passed (10 tests).
- E2E smoke: passed (`shell and overview render`).

#### 9.6 Scope boundary for this atomic slice
- Completed only the T3.1 ingest start requested here: RL WebSocket message normalization into canonical events plus safe agent-store handling.
- Live RL WebSocket connection lifecycle, runtime app wiring, REST fallback, and Agents view work remain out of scope for this atomic commit.

### 10) Phase 3 implementation continued (EPIC 3 / T3.1 + T3.2)

#### 10.1 Live RL WebSocket runtime wiring completed
- Added a reconnecting RL stream client in `ui/src/rl/client.ts`.
- Added runtime RL connection service in `ui/src/services/rl-connection.ts`.
- Wired app lifecycle in `ui/src/App.vue` so RL connection startup and teardown now happen alongside rosbridge and domain-event routing.
- Added RL connection badge state to `ui/src/components/AppShell.vue` so the shell now reports effective RL backend status instead of a hardcoded idle placeholder.

#### 10.2 Connection model extended for dual backend status
- Extended `ui/src/stores/connection.ts` to track RL backend state independently from rosbridge.
- Added transport attribution (`ws` or `rest`) for backend badges and degraded-mode visibility.
- Added RL freshness evaluation and message-received tracking consistent with the existing rosbridge path.

#### 10.3 RL REST fallback implemented
- Added REST fallback polling to `ui/src/services/rl-connection.ts` for cases where RL WebSocket retries are exhausted.
- Added tolerant snapshot fetching across likely endpoint candidates derived from the configured base URL.
- Extended `ui/src/services/rl-ws-adapter.ts` so REST snapshot payloads normalize into canonical `rl-rest` agent events using the same event bus and store routing path as RL WebSocket messages.
- Current fallback scope is intentionally read-only and state-oriented: polling agent snapshots/status data into canonical events. Control/command fallback remains out of scope for Epic 3.

#### 10.4 Tests added for live runtime and degraded mode
- Added integration tests in `ui/src/services/rl-connection.integration.test.ts` covering:
  - live RL WebSocket message ingest into domain stores
  - REST fallback polling after WebSocket reconnect exhaustion
- Extended `ui/src/stores/connection.unit.test.ts` to cover RL transport and REST fallback state transitions.

#### 10.5 Validation results for T3.2 boundary
- Focused validation: passed (`ui/src/services/rl-connection.integration.test.ts`, `ui/src/services/rl-ws-adapter.integration.test.ts`, `ui/src/stores/connection.unit.test.ts`).
- Typecheck: passed.
- Unit tests: passed (15 tests).
- Integration tests: passed (12 tests).
- E2E smoke: passed (`shell and overview render`).

#### 10.6 Scope status after T3.2
- T3.1 is now complete as a live runtime path, not just a replay-fixture ingest slice.
- T3.2 RL REST fallback is complete for degraded-mode state visibility and agent snapshot ingestion.
- T3.3 Agents MVP view remains the next slice.

### 11) Phase 3 implementation completed (EPIC 3 / T3.3)

#### 11.1 Agents MVP view implementation
- Added `ui/src/views/AgentsView.vue` and replaced the `/agents` placeholder route with the live view.
- Agents view now presents:
  - agent list with status
  - objective and policy version
  - last action preview
  - last reward value
  - compact status summary counters
- The view reads from existing domain stores and does not add a parallel data path.

#### 11.2 Live update verification coverage
- Added component-level view tests in `ui/src/views/AgentsView.unit.test.ts` for:
  - RL unavailable empty state
  - visible live updates after status/action/reward event ingestion
- Extended smoke E2E in `ui/e2e/smoke.spec.ts` with an `/agents` route render check.

#### 11.3 Validation results for T3.3 boundary
- Focused validation: passed (`ui/src/views/AgentsView.unit.test.ts`, `ui/src/stores/agent.unit.test.ts`, `ui/src/services/rl-connection.integration.test.ts`, `ui/e2e/smoke.spec.ts`).
- Typecheck: passed.
- Unit tests: passed (17 tests).
- Integration tests: passed (12 tests).
- E2E smoke: passed (2 tests).

#### 11.4 Epic 3 completion status
- T3.1 complete.
- T3.2 complete.
- T3.3 complete.
- Epic 3 is now complete and validated for the current scope.

### 12) Phase 4 implementation started (EPIC 4 / T4.1)

#### 12.1 Topics explorer MVP delivered scope
- Added rosbridge service-call support in the UI transport so the dashboard can query topic metadata through rosapi without creating a separate transport path.
- Added a dedicated topic store and integrated it into the existing canonical event bus + domain event routing path.
- Added a live Topics and Messages view on `/topics` with:
  - topic discovery list
  - text filter by topic name, namespace, or type
  - subscribe/unsubscribe controls
  - message viewer with formatted metadata and raw payload JSON
- Preserved the `/odom` golden path by keeping the existing Overview subscription untouched and adding explicit `/topics` `/odom` subscribe visibility coverage in tests.

#### 12.2 Files changed for T4.1
- domain-knowledge/adding_a_unified_dashboard/code-development-log.md
- ui/e2e/smoke.spec.ts
- ui/src/App.vue
- ui/src/core/events/envelope.ts
- ui/src/core/events/envelope.unit.test.ts
- ui/src/router/index.ts
- ui/src/rosbridge/client.integration.test.ts
- ui/src/rosbridge/client.ts
- ui/src/rosbridge/types.ts
- ui/src/services/domain-event-routing.integration.test.ts
- ui/src/services/domain-event-routing.ts
- ui/src/services/topic-explorer.integration.test.ts
- ui/src/services/topic-explorer.ts
- ui/src/stores/topic.ts
- ui/src/stores/topic.unit.test.ts
- ui/src/views/TopicsView.unit.test.ts
- ui/src/views/TopicsView.vue

#### 12.3 Validation results for T4.1
- Focused validation: passed (`src/rosbridge/client.integration.test.ts`, `src/stores/topic.unit.test.ts`, `src/services/topic-explorer.integration.test.ts`, `src/views/TopicsView.unit.test.ts`, `src/services/domain-event-routing.integration.test.ts`).
- Typecheck: passed.
- Unit tests: passed (21 tests).
- Integration tests: passed (15 tests).
- E2E smoke: passed (3 tests), including explicit `/topics` `/odom` subscription visibility and payload viewer coverage.

#### 12.4 Known limitations after T4.1
- Topic discovery currently depends on rosapi service availability at `/rosapi/topics` and `/rosapi/topic_type`.
- Filter scope is MVP text filtering only; dedicated namespace/type/rate controls remain future work.
- Message inspection currently shows the latest payload with metadata and raw JSON; publish forms and service invocation are intentionally deferred to T4.2.

### 13) Phase 4 implementation continued (EPIC 4 / T4.2)

#### 13.1 Publish and service forms delivered scope
- Extended the Topics view with schema-aware publish and service-call forms without introducing a new data pipeline.
- Added a lightweight ROS validation registry under `ui/src/core/ros/forms.ts` for known message and service contracts used in this repository:
  - `geometry_msgs/msg/Twist`
  - `std_srvs/srv/Trigger`
  - `std_srvs/srv/SetBool`
  - `rosclaw_msgs/srv/GetCapabilities`
- Added service discovery via rosapi (`/rosapi/services`) and surfaced discovered services alongside the existing topic explorer.
- Added typed rosbridge service-call support so service invocations can include the requested service type when available.
- Added publish execution and service-call execution helpers in the existing topic-explorer service, with operator event-bus publication for both actions.
- Added Topics view validation UX so invalid payloads are blocked locally and surfaced with clear error text before any transport request is sent.

#### 13.2 Files changed for T4.2
- domain-knowledge/adding_a_unified_dashboard/code-development-log.md
- ui/e2e/smoke.spec.ts
- ui/src/core/ros/forms.ts
- ui/src/core/ros/forms.unit.test.ts
- ui/src/rosbridge/client.integration.test.ts
- ui/src/rosbridge/client.ts
- ui/src/services/topic-explorer.integration.test.ts
- ui/src/services/topic-explorer.ts
- ui/src/stores/topic.ts
- ui/src/stores/topic.unit.test.ts
- ui/src/views/TopicsView.unit.test.ts
- ui/src/views/TopicsView.vue

#### 13.3 Validation results for T4.2
- Focused validation: passed (`src/core/ros/forms.unit.test.ts`, `src/rosbridge/client.integration.test.ts`, `src/services/topic-explorer.integration.test.ts`, `src/views/TopicsView.unit.test.ts`, `src/stores/topic.unit.test.ts`).
- Typecheck: passed.
- Unit tests: passed (27 tests).
- Integration tests: passed (16 tests).
- E2E smoke: passed (3 tests), including invalid publish blocking plus successful publish and service-call flows on `/topics`.

#### 13.4 Known limitations after T4.2
- Schema-aware validation is currently limited to the small registry of known message and service types above; unknown contracts fall back to JSON-object validation only.
- Publish and service forms live inside the Topics view for this slice; dedicated control workflows remain deferred to T4.3.
- Service responses are currently shown as raw formatted JSON; richer typed response rendering remains future work.

### 14) Phase 4 implementation continued (EPIC 4 / T4.3)

#### 14.1 Control center MVP delivered scope
- Replaced the `/control` placeholder with a dedicated Control Center view for guided mode and scenario operations.
- Added explicit mode controls for `manual`, `assist`, and `autonomous`, including an inline confirmation gate before switching into autonomous mode.
- Added scenario controls for start and reset episode flows with explicit scenario ID and comma-separated multi-agent target inputs.
- Added a focused control action store to track submission state, pending buttons, recent action history, trace identifiers, endpoint provenance, and transport outcomes.
- Added a control-center service layer that reuses the existing rosbridge service-call path and operator event bus, and publishes mission-state snapshots back through the canonical routing path after successful submissions.
- Added smoke, unit, and integration coverage for command submit path behavior, pending/result state transitions, and visible action provenance on `/control`.

#### 14.2 Files changed for T4.3
- domain-knowledge/adding_a_unified_dashboard/code-development-log.md
- ui/e2e/smoke.spec.ts
- ui/src/router/index.ts
- ui/src/services/control-center.integration.test.ts
- ui/src/services/control-center.ts
- ui/src/stores/control.ts
- ui/src/stores/control.unit.test.ts
- ui/src/views/ControlView.unit.test.ts
- ui/src/views/ControlView.vue

#### 14.3 Validation results for T4.3
- Focused validation: passed (`src/stores/control.unit.test.ts`, `src/services/control-center.integration.test.ts`, `src/views/ControlView.unit.test.ts`).
- Typecheck: passed.
- Unit tests: passed (31 tests).
- Integration tests: passed (18 tests).
- E2E smoke: passed (4 tests), including mode confirmation, mode switch, scenario start, and visible action provenance coverage on `/control`.

#### 14.4 Known limitations after T4.3
- Control endpoints and service types are currently dashboard-configurable defaults for the MVP because the repository does not yet expose a finalized backend control-service contract for mode and scenario actions.
- The control center currently covers single-mode and scenario actions with comma-separated multi-agent targeting, but does not yet provide richer batch orchestration workflows or role-based gating.
- Prominent global E-stop entry, confirmation, and audit assertions remain intentionally deferred to T4.4.

### 15) Phase 4 implementation completed (EPIC 4 / T4.4)

#### 15.1 E-stop entry and confirmation delivered scope
- Added a globally reachable top-bar E-stop entry in the shell so emergency stop is available from any dashboard route.
- Added a dedicated E-stop confirmation flow requiring:
  - non-empty operator reason
  - explicit confirmation checkbox before submission
- Added emergency-stop submission logic in the control-center service layer using the existing rosbridge service-call pathway and control action provenance store.
- Added critical alert emission on successful E-stop through the canonical event bus (`alert:raised`) so E-stop is visible as a safety event.
- Added mission snapshot update on successful E-stop to force paused/manual state projection through the existing mission routing path.

#### 15.2 Files changed for T4.4
- domain-knowledge/adding_a_unified_dashboard/code-development-log.md
- ui/e2e/smoke.spec.ts
- ui/src/components/AppShell.vue
- ui/src/services/control-center.integration.test.ts
- ui/src/services/control-center.ts

#### 15.3 Validation results for T4.4
- Focused validation: passed (`src/services/control-center.integration.test.ts`, E2E `global e-stop entry requires confirmation and records audit trail`).
- Typecheck: passed.
- Unit tests: passed (31 tests).
- Integration tests: passed (19 tests).
- E2E smoke: passed (5 tests), including global E-stop confirmation/reason flow and control-center audit trail assertion.

#### 15.4 Known limitations after T4.4
- E-stop currently targets the MVP endpoint default (`/control/estop`, `rosclaw_msgs/srv/EStop`) and assumes backend availability for this contract.
- Reason capture is required and persisted in control action provenance, but richer operator identity/sign-off metadata is not yet modeled.
- Alert/audit exposure is currently validated through control history and critical alert emission, while a dedicated audit UI remains future work.

### 16) Phase 5 implementation started (EPIC 5 / T5.1)

#### 16.1 Overview productionization delivered scope
- Productionized `ui/src/views/OverviewView.vue` with store-backed operational panels while preserving the existing `/odom` golden-path subscription and mini-canvas rendering flow.
- Added summary cards for:
  - robots online/total and subscribed topics
  - agents running/total and error count
  - mission status and mode snapshot
  - open and critical alert counts
- Added top-alert preview panel sourced from `alerts` store selectors.
- Added recent-event preview table sourced from the existing topic-domain pathway (new `recentMessages` getter in `ui/src/stores/topic.ts`), without introducing parallel transport or event pipelines.
- Added empty-state handling for alerts and event preview when streams are unavailable or cold.

#### 16.2 Files changed for T5.1
- domain-knowledge/adding_a_unified_dashboard/code-development-log.md
- ui/src/stores/topic.ts
- ui/src/views/OverviewView.vue
- ui/src/views/OverviewView.unit.test.ts

#### 16.3 Validation results for T5.1
- Typecheck: passed (`pnpm --filter @rosclaw/ui typecheck`).
- Unit tests: passed (`pnpm --filter @rosclaw/ui test:unit`, 33 tests).
- Integration tests: passed (`pnpm --filter @rosclaw/ui test:integration`, 19 tests).
- E2E smoke: passed (`pnpm --filter @rosclaw/ui test:e2e -- ui/e2e/smoke.spec.ts`, 5 tests).

#### 16.4 Known limitations after T5.1
- Event preview currently focuses on topic-domain events and does not yet include mission/control/operator events in the same table.
- Summary and panel refresh cadence is event-driven only; no explicit sampling/decimation controls are added in this slice.
- Load-time budget instrumentation is not yet automated; performance hardening remains scheduled for Epic 6.

### 17) Phase 5 implementation continued (EPIC 5 / T5.2)

#### 17.1 Metrics and rewards panel v1 delivered scope
- Added `ui/src/views/MetricsView.vue` and replaced the `/metrics` placeholder route with a live Metrics and Rewards view.
- Reused existing domain-store pathways to present:
  - reward trend sparklines by agent
  - aggregate reward sample and average reward cards
  - action histogram across agents
  - control command success rate and p95 latency summary
  - recent control latency table
- Extended the existing agent store (`ui/src/stores/agent.ts`) to track rolling reward series and action-frequency counters from canonical `agent:reward` and `agent:action` events.
- Added component-level and store-level tests to validate burst reward/action fixture handling and panel rendering.

#### 17.2 Files changed for T5.2
- domain-knowledge/adding_a_unified_dashboard/code-development-log.md
- ui/e2e/smoke.spec.ts
- ui/src/router/index.ts
- ui/src/stores/agent.ts
- ui/src/stores/agent.unit.test.ts
- ui/src/views/MetricsView.unit.test.ts
- ui/src/views/MetricsView.vue

#### 17.3 Validation results for T5.2
- Typecheck: passed (`pnpm --filter @rosclaw/ui typecheck`).
- Unit tests: passed (`pnpm --filter @rosclaw/ui test:unit`, 35 tests).
- Integration tests: passed (`pnpm --filter @rosclaw/ui test:integration`, 19 tests).
- E2E smoke: passed (`pnpm --filter @rosclaw/ui test:e2e -- ui/e2e/smoke.spec.ts`, 6 tests).

#### 17.4 Known limitations after T5.2
- Reward trend rendering uses CSS sparkline bars without a dedicated charting library yet; richer axis and zoom interactions are deferred.
- Latency metrics currently summarize control-store action history only, which is bounded to the existing in-memory history window.
- RL and control metrics are visualized in near-real-time but do not yet include long-horizon persistence or replay overlays.

### 18) Phase 5 implementation continued (EPIC 5 / T5.3)

#### 18.1 Mission timeline v1 delivered scope
- Added `ui/src/stores/timeline.ts` and wired it into the existing event routing pipeline so all canonical envelopes are captured in one bounded timeline store without introducing a new transport/data path.
- Updated domain routing setup and app wiring to include `timelineStore` alongside existing robot/agent/mission/alert/topic stores.
- Replaced the `/timeline` placeholder with `ui/src/views/TimelineView.vue`, including:
  - unified event stream table (newest first)
  - free-text filtering across event metadata and payload preview
  - source filter (`rosbridge`, `rl-ws`, `rl-rest`, `operator`)
  - trace filter and click-to-focus trace selection
  - trace correlation panel showing grouped events for the selected trace id
- Added unit and integration coverage for timeline ingest, routing, and view-level correlation/filter behavior.

#### 18.2 Files changed for T5.3
- domain-knowledge/adding_a_unified_dashboard/code-development-log.md
- ui/e2e/smoke.spec.ts
- ui/src/App.vue
- ui/src/router/index.ts
- ui/src/services/control-center.integration.test.ts
- ui/src/services/domain-event-routing.integration.test.ts
- ui/src/services/domain-event-routing.ts
- ui/src/services/rl-connection.integration.test.ts
- ui/src/services/rl-ws-adapter.integration.test.ts
- ui/src/services/topic-explorer.integration.test.ts
- ui/src/stores/timeline.ts
- ui/src/stores/timeline.unit.test.ts
- ui/src/views/TimelineView.unit.test.ts
- ui/src/views/TimelineView.vue

#### 18.3 Validation results for T5.3
- Typecheck: passed (`pnpm --filter @rosclaw/ui typecheck`).
- Unit tests: passed (`pnpm --filter @rosclaw/ui test:unit`, 38 tests).
- Integration tests: passed (`pnpm --filter @rosclaw/ui test:integration`, 19 tests).
- E2E smoke: passed (`pnpm --filter @rosclaw/ui test:e2e -- ui/e2e/smoke.spec.ts`, 7 tests).

#### 18.4 Known limitations after T5.3
- Timeline retention is currently in-memory and bounded to a fixed event limit; persistence/export remains future work.
- Trace correlation currently relies on existing `trace_id` presence in upstream events and does not infer synthetic traces.
- Timeline display is table-based MVP and does not yet include grouped swimlanes or time-scale zoom interactions.

### 19) Phase 5 implementation completed (EPIC 5 / T5.4)

#### 19.1 Alerts and safety panel delivered scope
- Added `ui/src/views/AlertsView.vue` and replaced the `/alerts` placeholder route with a live alerts and safety panel.
- Panel capabilities include:
  - severity/open-state summary cards
  - severity filtering and acknowledged-toggle filtering
  - explicit acknowledge button for open alerts
  - source/time/trace visibility on alert records
- Added `ui/src/services/alerts-safety.ts` for canonical alert acknowledgment publication through the existing event bus and routing pathway.
- Added integration coverage in `ui/src/services/alerts-safety.integration.test.ts` to verify raised-alert to acknowledged-alert transition through shared domain-event routing.
- Added view-level unit coverage in `ui/src/views/AlertsView.unit.test.ts` for filtering and acknowledgment action wiring.

#### 19.2 Files changed for T5.4
- domain-knowledge/adding_a_unified_dashboard/code-development-log.md
- ui/e2e/smoke.spec.ts
- ui/src/router/index.ts
- ui/src/services/alerts-safety.integration.test.ts
- ui/src/services/alerts-safety.ts
- ui/src/views/AlertsView.unit.test.ts
- ui/src/views/AlertsView.vue

#### 19.3 Validation results for T5.4
- Typecheck: passed (`pnpm --filter @rosclaw/ui typecheck`).
- Unit tests: passed (`pnpm --filter @rosclaw/ui test:unit`, 40 tests).
- Integration tests: passed (`pnpm --filter @rosclaw/ui test:integration`, 20 tests).
- E2E smoke: passed (`pnpm --filter @rosclaw/ui test:e2e -- ui/e2e/smoke.spec.ts`, 8 tests).

#### 19.4 Known limitations after T5.4
- Acknowledgment currently updates in-memory dashboard state via canonical `alert:ack` events; backend persistence/audit storage remains a later governance scope.
- The panel currently supports operator acknowledgment but does not yet enforce role-based authorization controls.
- Alert history retention is bounded by the current in-memory store model.

### 20) Phase 6 implementation started (EPIC 6 / T6.1)

#### 20.1 Audit trail UI and API wiring delivered scope
- Extended the control-center service layer to publish canonical `audit:entry` events through the existing event bus for each control action lifecycle transition (`pending`, `succeeded`, `failed`).
- Audit payloads now include command provenance and execution context for each entry:
  - actor and transport provenance
  - action key/label
  - endpoint name/type
  - request payload
  - result status, response payload, and error text
- Reused the existing domain-event routing and timeline store pathway (no parallel pipeline) so audit entries are available anywhere timeline events are consumed.
- Added a dedicated audit trail panel to the Mission Timeline view showing command provenance entries linked to trace and result status.

#### 20.2 Files changed for T6.1
- domain-knowledge/adding_a_unified_dashboard/code-development-log.md
- ui/e2e/smoke.spec.ts
- ui/src/services/control-center.integration.test.ts
- ui/src/services/control-center.ts
- ui/src/stores/timeline.ts
- ui/src/stores/timeline.unit.test.ts
- ui/src/views/TimelineView.unit.test.ts
- ui/src/views/TimelineView.vue

#### 20.3 Validation results for T6.1
- Typecheck: passed (`pnpm --filter @rosclaw/ui typecheck`).
- Unit tests: passed (`pnpm --filter @rosclaw/ui test:unit`, 40 tests).
- Integration tests: passed (`pnpm --filter @rosclaw/ui test:integration`, 20 tests).
- E2E smoke: passed (`pnpm --filter @rosclaw/ui test:e2e -- ui/e2e/smoke.spec.ts`, 8 tests).

#### 20.4 Known limitations after T6.1
- Audit trail is currently in-memory and session-scoped via timeline retention; durable backend audit persistence is still pending.
- Provenance is currently modeled as operator-triggered rosbridge service submissions and does not yet include role-derived authorization metadata.
- The audit panel is integrated into Mission Timeline for this slice; dedicated export/search workflows remain future work.

## Files introduced or modified during completed work
- ui/src/router/index.ts
- ui/src/views/OverviewView.vue
- ui/src/views/PlaceholderView.vue
- ui/src/components/AppShell.vue
- ui/src/stores/connection.ts
- ui/src/services/rosbridge-connection.ts
- ui/src/stores/connection.unit.test.ts
- ui/src/rosbridge/client.integration.test.ts
- ui/e2e/smoke.spec.ts
- ui/playwright.config.ts
- ui/src/test/setup.ts
- ui/src/main.ts
- ui/src/App.vue
- ui/src/style.css
- ui/src/rosbridge/client.ts
- ui/src/rosbridge/types.ts
- ui/vite.config.ts
- ui/package.json
- ui/.gitignore
- pnpm-lock.yaml
- ui/src/services/rl-ws-adapter.ts
- ui/src/services/rl-ws-adapter.integration.test.ts
- ui/src/rl/client.ts
- ui/src/rl/index.ts
- ui/src/services/rl-connection.ts
- ui/src/services/rl-connection.integration.test.ts
- ui/src/views/AgentsView.vue
- ui/src/views/AgentsView.unit.test.ts
- ui/src/services/topic-explorer.ts
- ui/src/services/topic-explorer.integration.test.ts
- ui/src/stores/topic.ts
- ui/src/stores/topic.unit.test.ts
- ui/src/views/TopicsView.vue
- ui/src/views/TopicsView.unit.test.ts
- ui/src/core/ros/forms.ts
- ui/src/core/ros/forms.unit.test.ts
- ui/src/stores/control.ts
- ui/src/stores/control.unit.test.ts
- ui/src/services/control-center.ts
- ui/src/services/control-center.integration.test.ts
- ui/src/views/ControlView.vue
- ui/src/views/ControlView.unit.test.ts
- ui/src/components/AppShell.vue

## Current status
- Phase 1 remains complete and validated.
- Phase 2 EPIC 2 (T2.1, T2.2, T2.3) is complete and validated.
- EPIC 3 (T3.1, T3.2, T3.3) is complete and validated.
- EPIC 4 / T4.1 Topics explorer MVP is complete and validated.
- EPIC 4 / T4.2 Publish and service forms is complete and validated.
- EPIC 4 / T4.3 Control center MVP is complete and validated.
- EPIC 4 / T4.4 E-stop entry and confirmation is complete and validated.
- EPIC 4 (T4.1-T4.4) is complete and validated for this branch scope.
- EPIC 5 / T5.1 Overview productionization is complete and validated.
- EPIC 5 / T5.2 Metrics and rewards panel v1 is complete and validated.
- EPIC 5 / T5.3 Mission timeline v1 is complete and validated.
- EPIC 5 / T5.4 Alerts and safety panel is complete and validated.
- EPIC 5 (T5.1-T5.4) is complete and validated for this branch scope.
- EPIC 6 / T6.1 Audit trail UI and API wiring is complete and validated.

## Commit History Ledger
Use this section to keep an atomized record of commits as each phase is completed.

| Date (UTC) | Commit | Message | Scope |
|---|---|---|---|
| 2026-04-21 | 442c23b | feat: Add unified dashboard documentation and implementation plans | Planning docs and implementation blueprint |
| 2026-04-21 | 4ab29c7 | feat: Refactor Rosbridge connection and UI components | Phase 1 foundation, shell path, and rosbridge lifecycle baseline |
| 2026-04-21 | ce8bb5d | feat: Implement canonical event envelope and associated validation logic | Phase 2 - T2.1 canonical event envelope |
| 2026-04-21 | 3abe450 | feat: Implement event bus and routing for canonical event envelopes | Phase 2 - T2.2 event bus and routing |
| 2026-04-21 | 0841bd8 | feat: Complete Phase 2 implementation for EPIC 2, including domain stores, event routing, and associated tests | Phase 2 - T2.3 domain stores baseline |
| 2026-04-28 | 2960b4b | feat: complete Epic 3 RL runtime and REST fallback | Phase 3 - T3.1 live RL WS + T3.2 REST fallback |
| 2026-04-28 | c8cc455 | feat: complete Epic 3 Agents MVP view | Phase 3 - T3.3 Agents MVP |
| 2026-04-28 | 5db3686 | feat: complete Epic 4 T4.1 Topics explorer MVP | Phase 4 - T4.1 topics explorer MVP |
| 2026-04-28 | f308ad2 | feat: complete Epic 4 T4.2 publish and service forms | Phase 4 - T4.2 publish and service forms |
| 2026-04-28 | 9fdef32 | feat: complete Epic 4 T4.3 control center MVP | Phase 4 - T4.3 control center MVP |
| 2026-04-28 | 8c3e43b | feat: complete Epic 4 T4.4 emergency stop entry and confirmation | Phase 4 - T4.4 emergency stop and audit path |
| 2026-04-28 | 7555afc | feat: complete Epic 5 T5.1 overview productionization | Phase 5 - T5.1 overview productionization |
| 2026-04-28 | c6018d8 | feat: complete Epic 5 T5.2 metrics and rewards panel | Phase 5 - T5.2 metrics and rewards panel |
| 2026-04-28 | b6d1f24 | feat: complete Epic 5 T5.3 mission timeline view | Phase 5 - T5.3 mission timeline v1 |

### Ledger update rules
- Add one row per atomic commit.
- Prefer one commit per completed phase slice.
- Include abbreviated commit SHA (7-12 chars).
- Keep scope explicit (for example: "Phase 2 - event envelope + bus").
