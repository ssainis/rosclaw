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

## Current status
- Phase 1 remains complete and validated.
- Phase 2 EPIC 2 (T2.1, T2.2, T2.3) is complete and validated.
- EPIC 3 (T3.1, T3.2, T3.3) is complete and validated.
- Next planned work begins with EPIC 4.

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
| 2026-04-28 | TBD (this commit) | feat: complete Epic 3 Agents MVP view | Phase 3 - T3.3 Agents MVP |

### Ledger update rules
- Add one row per atomic commit.
- Prefer one commit per completed phase slice.
- Include abbreviated commit SHA (7-12 chars).
- Keep scope explicit (for example: "Phase 2 - event envelope + bus").
