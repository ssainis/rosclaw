# Plan for a Unified Dashboard

## Status Note

This document is the phased delivery plan created before and during implementation.

- Treat it as planning history plus execution structure.
- Many items described here are now implemented on the `adding-a-unified-dashboard` branch.
- For the shipped scope, use `docs/unified-dashboard-current-state.md`.
- For completion details and validation history, use `domain-knowledge/adding_a_unified_dashboard/code-development-log.md`.

## 1. Plan Purpose

This plan converts the dashboard spec into an implementation sequence that can be executed by engineering with minimal ambiguity.

Primary outcomes:

- Ship a production-grade unified dashboard in phased increments
- Keep safety, reliability, and observability as first-class constraints
- Enforce unit, integration, and E2E testing throughout delivery

## 2. Delivery Model

### 2.1 Cadence

- Iteration length: 1 week
- Planning horizon: 10 weeks total (3 phases)
- Release style: incremental, behind feature flags where needed

### 2.2 Team Assumptions

- 1 frontend engineer
- 1 full-stack/integration engineer
- 1 robotics/backend engineer part-time for contract alignment
- 1 QA owner (can be shared role)

If team size is smaller, extend timeline but keep order unchanged.

## 3. Execution Principles

1. Build vertical slices, not isolated layers.
2. Keep adapters thin and domain stores explicit.
3. Add tests in the same PR as behavior changes.
4. Do not merge control-path changes without E2E coverage.
5. Preserve the `/odom` golden path at all times.

## 4. Workstream Breakdown

### WS-A: Platform and App Foundation

Scope:

- app shell
- routing/navigation
- layout system baseline
- global status bar

### WS-B: Data Integration Layer

Scope:

- rosbridge adapter hardening
- RL adapter implementation (WS + optional REST fallback)
- canonical event normalization
- reconnect/resubscribe behavior

### WS-C: Domain State and Core UI

Scope:

- stores (connection, robot, agent, mission, alerts)
- selectors/derived state
- reusable panel primitives

### WS-D: Feature Views

Scope:

- overview
- robots
- agents
- topics/messages
- control center
- metrics/rewards
- timeline
- alerts/safety
- settings

### WS-E: Safety, Governance, and Audit

Scope:

- confirmation and permission hooks
- command provenance + trace correlation
- audit event model and audit UI exposure

### WS-F: Testing and Quality Gates

Scope:

- unit/integration harness
- E2E harness and Docker-driven tests
- CI gating + nightly extended suites

### WS-G: Performance and Reliability Hardening

Scope:

- stream throttling/sampling
- virtualized logs/tables
- render performance instrumentation
- degraded mode behavior

## 5. Dependency Graph (High Level)

1. WS-A and WS-F must start first.
2. WS-B starts once WS-A routing and app providers exist.
3. WS-C depends on first stable event contracts from WS-B.
4. WS-D starts with MVP views once WS-C has baseline stores/selectors.
5. WS-E layers into WS-D control flows after command pathways exist.
6. WS-G starts during Phase 1 but intensifies in Phase 2 and 3.

## 6. Ticketized Implementation Plan

Each item includes scope, dependencies, estimate, and exit checks.

Estimate scale:

- S: 0.5-1 day
- M: 2-3 days
- L: 4-5 days
- XL: 6-8 days

### EPIC 0: Baseline Setup

T0.1 Create branch and baseline check
- Scope: ensure working branch, clean install, baseline typecheck
- Depends on: none
- Estimate: S
- Exit checks: install and typecheck pass

T0.2 Project scaffolding alignment
- Scope: create target folder structure under `ui/src`
- Depends on: T0.1
- Estimate: M
- Exit checks: routes and app shell compile

T0.3 Testing harness bootstrap
- Scope: set up unit/integration framework and E2E runner scaffolding
- Depends on: T0.1
- Estimate: L
- Exit checks: sample unit/integration/E2E tests run locally and in CI

### EPIC 1: Core Shell and Connectivity

T1.1 Global shell and navigation
- Scope: top status bar, side navigation, placeholder routes
- Depends on: T0.2
- Estimate: M
- Exit checks: all target views reachable with placeholders

T1.2 Connection store and health model
- Scope: dual-backend status model (`idle/connecting/connected/stale/reconnecting/failed`)
- Depends on: T0.2
- Estimate: M
- Exit checks: status transitions rendered in shell with mocked events

T1.3 Rosbridge adapter hardening
- Scope: reconnect with backoff, resubscribe, error surface
- Depends on: T0.2
- Estimate: L
- Exit checks: integration tests cover reconnect and resubscribe

T1.4 `/odom` golden path migration
- Scope: preserve existing canvas behavior inside Overview or Robots MVP
- Depends on: T1.1, T1.2, T1.3
- Estimate: M
- Exit checks: current E2E path remains green

### EPIC 2: Event Contracts and Stores

T2.1 Canonical event envelope module
- Scope: normalizer and validators for all incoming streams
- Depends on: T1.3
- Estimate: M
- Exit checks: unit tests for envelope and validation errors

T2.2 Event bus and routing
- Scope: typed bus, source routing, throttling hooks
- Depends on: T2.1
- Estimate: L
- Exit checks: integration tests for routing correctness and malformed containment

T2.3 Domain stores baseline
- Scope: robot, agent, mission, alert stores plus selectors
- Depends on: T2.2
- Estimate: L
- Exit checks: store tests for key transitions and derived state

### EPIC 3: RL Integration and Agents View

T3.1 RL adapter (WebSocket)
- Scope: ingest agent state, reward, action events
- Depends on: T2.1
- Estimate: L
- Exit checks: integration tests with replayed RL fixture stream

T3.2 RL REST fallback
- Scope: fallback polling/queries when WS unavailable
- Depends on: T3.1
- Estimate: M
- Exit checks: degraded-mode behavior verified by integration tests

T3.3 Agents MVP view
- Scope: agent list, status, objective, action preview
- Depends on: T2.3, T3.1
- Estimate: L
- Exit checks: E2E or component-level flow for visible live updates

### EPIC 4: Topics and Control Flows

T4.1 Topics explorer MVP
- Scope: topic list, filter, subscribe/unsubscribe, message viewer
- Depends on: T1.3, T2.3
- Estimate: L
- Exit checks: `/odom` subscribe visible in UI and tests

T4.2 Publish and service forms
- Scope: schema-aware validation, publish actions, service calls
- Depends on: T4.1, T2.1
- Estimate: XL
- Exit checks: invalid payload blocked and surfaced with clear errors

T4.3 Control center MVP
- Scope: mode controls, scenario controls, action submission states
- Depends on: T3.1, T2.3
- Estimate: L
- Exit checks: command submit path and pending state coverage

T4.4 E-stop entry and confirmation
- Scope: globally reachable control, confirmation and reason capture
- Depends on: T4.3
- Estimate: M
- Exit checks: E2E test and audit record assertion

### EPIC 5: Observability Views and Timeline

T5.1 Overview productionization
- Scope: summary cards, mini canvas, top alerts, event preview
- Depends on: T2.3, T3.1
- Estimate: M
- Exit checks: under-target load time and empty states

T5.2 Metrics and rewards panel v1
- Scope: reward trends, return/success, action histogram, latency metrics
- Depends on: T3.1, T2.3
- Estimate: XL
- Exit checks: chart responsiveness under burst fixtures

T5.3 Mission timeline v1
- Scope: unified event list, filter, trace-based correlation
- Depends on: T2.2, T2.3
- Estimate: XL
- Exit checks: acceptance criteria for trace-based correlation pass

T5.4 Alerts and safety panel
- Scope: alert feed, severity counters, acknowledge flow
- Depends on: T2.3, T4.4
- Estimate: L
- Exit checks: critical alerts shown globally and in panel

### EPIC 6: Governance, Performance, and Hardening

T6.1 Audit trail UI + API wiring
- Scope: display command provenance and audit entries
- Depends on: T4.3, T4.4
- Estimate: L
- Exit checks: command actions linked to trace and result status

T6.2 Layout persistence and role presets
- Scope: save/load panel layout presets by role
- Depends on: T1.1, T5.1
- Estimate: L
- Exit checks: reload restores selected layout profile

T6.3 Performance hardening
- Scope: virtualized lists, chart decimation, parse optimization
- Depends on: T5.2, T5.3
- Estimate: XL
- Exit checks: no frame collapse in performance scenario tests

T6.4 Reliability hardening
- Scope: stale-state UX, partial failure boundaries, diagnostics actions
- Depends on: T1.2, T3.2, T5.4
- Estimate: L
- Exit checks: degraded-mode acceptance scenarios pass

### EPIC 7: Replay and Advanced Analytics (Phase 3)

T7.1 Session capture model
- Scope: record normalized event stream with metadata
- Depends on: T2.1, T5.3
- Estimate: XL
- Exit checks: replay file generation and import validated

T7.2 Replay engine and synchronized scrubber
- Scope: deterministic event playback across panels
- Depends on: T7.1
- Estimate: XL
- Exit checks: deterministic replay test suite passes

T7.3 Episode comparison and anomaly indicators
- Scope: compare runs, identify deltas, surface anomalies
- Depends on: T7.2, T5.2
- Estimate: XL
- Exit checks: analysis views match fixture expectations

## 7. Week-by-Week Rollout

### Week 1

- T0.1, T0.2, T0.3
- T1.1 started

### Week 2

- T1.1, T1.2, T1.3
- T1.4

### Week 3

- T2.1, T2.2
- T2.3 started

### Week 4

- T2.3 complete
- T3.1, T3.2

### Week 5

- T3.3
- T4.1

### Week 6

- T4.2
- T4.3
- T4.4

### Week 7

- T5.1
- T5.2 started

### Week 8

- T5.2 complete
- T5.3 started

### Week 9

- T5.3 complete
- T5.4
- T6.1

### Week 10

- T6.2, T6.3, T6.4
- Phase gate review

Phase 3 work (T7.1-T7.3) begins immediately after Week 10 if contracts and staffing are stable.

## 8. PR Slicing Strategy

Keep PRs focused and mergeable.

Recommended PR template sequence:

1. PR-1: shell + routing + test harness baseline
2. PR-2: connection store + rosbridge reconnect hardening
3. PR-3: event envelope + event bus
4. PR-4: domain stores + selectors
5. PR-5: `/odom` golden path migration and smoke E2E
6. PR-6: RL adapter + agents MVP
7. PR-7: topics explorer + message inspector
8. PR-8: publish/service + control center + E-stop
9. PR-9: metrics + timeline + alerts
10. PR-10: layout persistence + performance and reliability hardening

For each PR:

- include tests in same PR
- include docs update when behavior changes
- avoid unrelated refactors

## 9. Definition of Ready for Tickets

A ticket is ready only when:

1. Input contracts are documented.
2. Acceptance criteria are testable.
3. Dependencies are identified.
4. Required fixtures/mocks are available.
5. UI states (loading/error/empty/success) are specified.

## 10. Definition of Done for Tickets

A ticket is done only when:

1. Code merged behind agreed feature flag state.
2. Unit tests added/updated and passing.
3. Integration tests added/updated and passing.
4. E2E updates included if user-visible or transport/control path changed.
5. Docs updated where behavior changed.
6. No critical lint/type/test regression.

## 11. Test Plan by Layer

### 11.1 Unit

Must cover:

- adapters parsing helpers
- envelope normalization
- stores and selectors
- math transforms for heading/pose
- key component state rendering

### 11.2 Integration

Must cover:

- rosbridge reconnect and resubscribe
- RL WS ingest and REST fallback
- event bus routing and containment
- publish/service validation dispatch

### 11.3 E2E

Minimum gating E2E:

1. boot and connection badge
2. `/odom` render path
3. movement update path
4. reconnect and resubscribe path
5. E-stop with audit presence

Nightly extended E2E:

- mode switch flow
- RL state visibility
- alert acknowledgment
- timeline trace correlation

## 12. CI/CD Gate Plan

PR required jobs:

- typecheck
- lint
- unit tests
- integration tests
- E2E smoke

Nightly required jobs:

- full E2E
- replay determinism suite (Phase 3)
- performance regression checks

Merge policy:

- no bypass for red checks on dashboard-impacting PRs

## 13. Risk Register and Mitigation Actions

R1: RL contract instability
- Impact: high
- Mitigation: define versioned contract fixtures early; isolate adapter parsing

R2: Realtime test flakiness
- Impact: high
- Mitigation: deterministic fixtures, bounded waits, startup retries only

R3: UI performance regressions under burst streams
- Impact: medium-high
- Mitigation: early perf instrumentation, virtualized logs, throttle controls

R4: Safety regressions in control flows
- Impact: very high
- Mitigation: mandatory E2E for control changes; explicit confirmation guards

R5: Scope growth in Phase 2
- Impact: medium
- Mitigation: strict phase gates and backlog triage every week

## 14. Phase Gates

### Gate A (end Phase 1)

Must pass:

- `/odom` golden path stable in CI E2E
- shell + core navigation + connection model complete
- rosbridge reconnect/resubscribe validated

### Gate B (end Phase 2)

Must pass:

- operators can monitor and intervene via control center
- topics, agents, metrics, timeline, and alerts available
- critical control paths protected and auditable

### Gate C (end Phase 3)

Must pass:

- deterministic replay works across key panels
- anomaly and comparison views available
- post-run analysis possible without external tooling

## 15. Open Decisions to Resolve Before Implementation Starts

1. RL authoritative WS and REST schemas (finalized contract docs)
2. Auth approach and role mapping source of truth
3. Audit retention and storage strategy
4. Charting library selection after quick spike
5. Feature flag mechanism for staged rollout

## 16. Immediate Next Actions (Start This Week)

1. Approve this plan and lock phase scope.
2. Create tracker issues from ticket list (T0.1 onward).
3. Implement T0.1-T0.3 and open PR-1.
4. Establish CI jobs for required gates.
5. Begin T1.1 in parallel once scaffolding PR is open.

---

This plan is the execution blueprint for implementation. The spec remains the product and system contract; this plan defines sequence, ownership-ready tasks, and enforcement gates.
