# Code Development Log

## Scope
This log records all meaningful implementation activity completed so far for the unified dashboard effort in this branch.

## Repository Context
- Repository: PlaiPin/rosclaw
- Branch: fix/docker-compose-sync-ui-e2e
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

## Current status
- Phase 1 remains complete and validated.
- Phase 2 (EPIC 2) has started with T2.1 completed and validated.
- Work is paused at the end of this atomic phase slice before T2.2.

## Commit History Ledger
Use this section to keep an atomized record of commits as each phase is completed.

| Date (UTC) | Commit | Message | Scope |
|---|---|---|---|
| TBD | TBD | TBD | Phase 1 |
| 2026-04-21 | TBD | TBD | Phase 2 - T2.1 canonical event envelope |

### Ledger update rules
- Add one row per atomic commit.
- Prefer one commit per completed phase slice.
- Include abbreviated commit SHA (7-12 chars).
- Keep scope explicit (for example: "Phase 2 - event envelope + bus").
