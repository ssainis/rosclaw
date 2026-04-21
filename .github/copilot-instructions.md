# Copilot Instructions for RosClaw

Use this file as the default coding guidance for this repository.

## Project Context

RosClaw integrates OpenClaw and ROS2 so natural-language requests can trigger robot actions through rosbridge.

High-level path:

- User -> OpenClaw Gateway -> RosClaw Plugin -> rosbridge_server -> ROS2 robots

## Repository Structure

- `extensions/openclaw-plugin/`: primary OpenClaw extension package (`@rosclaw/openclaw-plugin`)
- `extensions/openclaw-canvas/`: dashboard extension package (`@rosclaw/openclaw-canvas`, currently early-stage)
- `ui/`: Vue/Vite dashboard app used for ROS/Canvas work
- `ros2_ws/`: ROS2 workspace (`rosclaw_discovery`, `rosclaw_msgs`, `rosclaw_agent`)
- `docker/`: compose files and container definitions for local/dev/robot/cloud modes
- `docs/` and `domain-knowledge/`: design notes, specs, and test guides

## Core Technical Conventions

- ESM-only JavaScript/TypeScript (`"type": "module"`)
- TypeScript strict mode, ES2022 target, NodeNext module resolution
- pnpm workspace-based dependency management
- npm package scope is `@rosclaw/`
- ROS2 package names use `rosclaw_` prefix
- Plugin config should be validated with Zod (parse once during registration)
- OpenClaw plugin source is loaded directly from TypeScript (jiti), so avoid assumptions about a separate build artifact

## Transport Architecture

When editing transport code, preserve adapter boundaries under `extensions/openclaw-plugin/src/transport/`:

- `rosbridge` (default): WebSocket bridge to ROS2
- `local` (stub): direct DDS mode
- `webrtc` (stub): signaling/datachannel mode

Prefer extending interfaces and factories rather than coupling feature logic directly to one transport implementation.

## Coding Guidelines

- Keep changes small, focused, and composable.
- Preserve existing public APIs unless a change request requires a breaking update.
- Keep transport, domain, and UI concerns separated.
- Prefer explicit types over `any`.
- Validate external payloads at boundaries.
- Handle reconnect/disconnect and stale-state paths explicitly.
- Add brief comments only where logic is non-obvious.

## UI and Dashboard Guidance

For `ui/` work:

- Treat real-time state as first-class: connection status, freshness, and error states should always be visible.
- Preserve the end-to-end `/odom` validation path when refactoring.
- Build reusable panel components and centralized stores.
- Keep command/safety controls explicit and auditable.

## Testing Expectations

For new behavior, add tests in the same change whenever practical:

- Unit tests for pure logic and state transforms
- Integration tests for adapter/store interactions
- E2E tests for critical user-visible workflows and reconnect behavior

Use the repository testing documentation as baseline guidance:

- `docs/ui-e2e-testing.md`

## Common Commands

From repository root:

```bash
pnpm install
pnpm typecheck
```

Use docker compose files in `docker/` for full-stack local integration validation.

## Documentation Discipline

- If behavior changes, update related docs/specs in `docs/` or `domain-knowledge/`.
- Keep examples and command snippets aligned with current compose files and ports.
