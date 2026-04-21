# RosClaw

Natural-language control and observability for ROS2 robots through OpenClaw.

RosClaw connects OpenClaw to ROS2 using transport adapters (rosbridge by default, with local and WebRTC stubs). This repository contains:

- OpenClaw plugin code for ROS2 tool execution and safety controls
- ROS2 workspace packages for discovery/messages/agent bridge
- A Vue dashboard app for live rosbridge validation and upcoming unified dashboard work
- Docker Compose modes for local, dev, cloud, and robot-side scenarios

## Architecture

```text
User -> OpenClaw Gateway -> RosClaw Plugin -> rosbridge_server -> ROS2 robots
```

## Repository Layout

```text
.
├── extensions/
│   ├── openclaw-plugin/     # Primary OpenClaw extension package
│   └── openclaw-canvas/     # Canvas/dashboard extension package (early stage)
├── ros2_ws/                 # ROS2 workspace (discovery, messages, agent)
├── ui/                      # Vue/Vite dashboard app
├── docker/                  # Compose files + Dockerfiles for multiple modes
├── docs/                    # Architecture and testing docs
├── domain-knowledge/        # Design notes and dashboard planning docs
└── examples/                # Example scenarios
```

## Requirements

- Node.js 20+
- pnpm 9+
- Docker + Docker Compose
- ROS2 Jazzy (for native ROS workflows outside Docker)

## Quick Start

Install dependencies:

```bash
pnpm install
```

Type-check all workspace packages:

```bash
pnpm typecheck
```

Start the default stack:

```bash
docker compose -f docker/docker-compose.yml up --build
```

Default endpoints:

- UI: http://localhost:4173
- rosbridge: ws://localhost:9090

## Docker Compose Modes

- `docker/docker-compose.yml`: default ROS2 + UI stack (optional plugin profile)
- `docker/docker-compose.dev.yml`: development-focused configuration
- `docker/docker-compose.local.yml`: local transport mode
- `docker/docker-compose.robot.yml`: robot-side mode for agent bridge
- `docker/docker-compose.cloud.yml`: cloud-side mode for WebRTC architecture

## UI Validation

For the full UI ROS2-to-canvas validation flow (including reconnect behavior), use:

- `docs/ui-e2e-testing.md`

## Key Packages

- `extensions/openclaw-plugin`: OpenClaw extension with transport abstraction, tools, hooks, and safety checks
- `extensions/openclaw-canvas`: OpenClaw canvas extension package (early-stage)
- `ros2_ws/src/rosclaw_discovery`: capability discovery node
- `ros2_ws/src/rosclaw_msgs`: custom ROS2 message/service definitions
- `ros2_ws/src/rosclaw_agent`: robot-side bridge node for Mode C deployments
- `ui`: Vue dashboard application

## Development Commands

From repository root:

```bash
pnpm install
pnpm build
pnpm typecheck
pnpm lint
pnpm clean
```

## Documentation

- `docs/architecture.md`
- `docs/ui-e2e-testing.md`
- `domain-knowledge/adding_a_unified_dashboard/proposal-for-a-unified-dashboard.md`
- `domain-knowledge/adding_a_unified_dashboard/spec-for-a-unified-dashboard.md`

## Contributing Workflow

### Branch Naming

Use descriptive branch names by change type:

- `feat/<short-description>` for new features
- `fix/<short-description>` for bug fixes
- `chore/<short-description>` for tooling/docs/maintenance
- `refactor/<short-description>` for structural improvements without behavior changes
- `test/<short-description>` for test-only changes

Examples:

- `feat/unified-dashboard-shell`
- `fix/rosbridge-reconnect-loop`

### Pull Request Checklist

Before opening or merging a PR, verify:

1. Scope is focused and matches the PR title.
2. Behavior changes are documented in `docs/` or `domain-knowledge/` as needed.
3. New or modified logic includes tests in the same PR.
4. Any transport changes preserve adapter boundaries and avoid coupling to one transport mode.
5. Safety-affecting changes include clear operator-facing behavior notes.

### Required Quality Gates

Run from repository root:

```bash
pnpm typecheck
pnpm lint
```

For dashboard-related UI work, also run the UI validation path in:

- `docs/ui-e2e-testing.md`

Policy:

1. Unit and integration tests are required for new behavior.
2. E2E coverage is required for user-visible flow changes and reconnect/control behavior.
3. Failing checks block merge.

## License

Apache-2.0
