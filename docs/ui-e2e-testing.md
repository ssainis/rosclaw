# Dashboard UI Validation Guide

This guide covers the current RosClaw dashboard validation paths.

Use two complementary checks:

1. Full-stack ROS validation for the real `/odom` golden path.
2. Browser-level Playwright smoke tests for the routed dashboard shell, topics workflows, control/audit behavior, settings persistence, degraded-mode UX, replay, and episode comparison entry points.

## What Is Actually Validated Today

Real backend path:

- ROS2 publishes odometry
- rosbridge exposes WebSocket messages
- the dashboard subscribes to `/odom`
- Overview renders the mini-canvas and updates shared stores

Mocked browser smoke path:

- routed shell and navigation
- Agents, Metrics, Timeline, Alerts, Settings, Replay, and Episodes routes
- Topics subscription, publish validation, and service call flow
- Control mode/scenario actions and Timeline audit visibility
- global E-stop confirmation flow
- degraded banner visibility
- settings persistence via local storage

The mocked Playwright suite does not require real RL or control backends. Those flows are simulated in-browser with a mocked WebSocket transport.

## Prerequisites

From the repository root:

```bash
pnpm install
pnpm --filter @rosclaw/ui exec playwright install chromium
```

Optional environment variables for the UI:

- `VITE_ROSBRIDGE_URL`
- `VITE_RL_WS_URL`
- `VITE_RL_REST_URL`

If RL endpoints are not configured, the dashboard still runs. RL-specific views will show empty or unavailable states.

## Automated Smoke Suite

Run from the repository root:

```bash
pnpm --filter @rosclaw/ui test:e2e -- ui/e2e/smoke.spec.ts
```

Current smoke coverage includes:

- shell and Overview route render
- Agents route render
- Metrics route render
- Timeline route render
- Alerts route render
- Settings layout preset persistence across reload
- Topics subscribe/publish/service-call behavior with transport mocks
- Control mode/scenario actions with Timeline audit assertions
- global E-stop confirmation and audit visibility
- degraded banner visibility and recovery-state rendering
- Replay route render
- Episodes route render

Use this suite for dashboard regression checks even when the full ROS stack is not running.

## Start The Local Stack

For the real `/odom` path, run from the repository root:

```bash
docker compose -f docker/docker-compose.yml up --build
```

Default endpoints:

- UI: `http://localhost:4173`
- rosbridge: `ws://localhost:9090`

Notes:

- This stack starts `ros2` and `ui` by default.
- The `rosclaw` plugin service is optional and behind the `plugin` profile.
- RL services are not part of the default compose stack in this repository.

## Full-Stack ROS Validation

### 1. Shell and Overview baseline

1. Open `http://localhost:4173/overview`.
2. Confirm the top bar and side navigation render.
3. Confirm the `rosbridge` badge progresses into a healthy connected state.
4. Confirm the Overview mini-canvas is visible.
5. Confirm the waiting hint is visible before any odometry arrives.

Expected notes:

- The shell shows separate `rosbridge` and `rl` badges.
- The `rl` badge may remain idle or unavailable unless RL endpoints are configured.
- The global `E-Stop` entry should always be visible in the top bar.

### 2. Publish test odometry

In a second terminal, publish odometry from the ROS2 container:

```bash
docker compose -f docker/docker-compose.yml exec ros2 bash -lc "source /opt/ros/jazzy/setup.bash && ros2 topic pub -r 2 /odom nav_msgs/msg/Odometry '{pose: {pose: {position: {x: 1.5, y: -0.5, z: 0.0}, orientation: {z: 0.7071, w: 0.7071}}}}'"
```

Expected result:

- the waiting hint disappears
- a robot marker appears in the mini-canvas
- heading rotates according to orientation
- Overview summary cards begin reflecting active robot/topic state

### 3. Movement update test

Publish a different pose:

```bash
docker compose -f docker/docker-compose.yml exec ros2 bash -lc "source /opt/ros/jazzy/setup.bash && ros2 topic pub -r 5 /odom nav_msgs/msg/Odometry '{pose: {pose: {position: {x: 2.5, y: 1.0, z: 0.0}, orientation: {z: 0.0, w: 1.0}}}}'"
```

Expected result:

- marker position changes on the canvas
- heading updates to match the new orientation

### 4. Topics view `/odom` check

If `rosapi` is available in the rosbridge environment:

1. Open `http://localhost:4173/topics`.
2. Refresh topics if needed.
3. Select `/odom` and subscribe.
4. Confirm the message viewer receives payload updates.

Expected result:

- `/odom` appears in the discovery table
- the latest payload is visible in the message viewer
- topic metadata and raw JSON are shown together

### 5. Reconnect test

1. Stop ROS2 temporarily:

```bash
docker compose -f docker/docker-compose.yml stop ros2
```

2. Watch the `rosbridge` badge transition away from healthy state.
3. Start ROS2 again:

```bash
docker compose -f docker/docker-compose.yml start ros2
```

4. Publish `/odom` again and confirm updates resume.

This validates reconnect and re-subscribe behavior for the real ROS path.

## Manual Dashboard Checks Without Backend Contracts

Some dashboard surfaces are currently best validated through the mocked smoke suite rather than the default Docker stack because the repository does not yet provide all finalized backend contracts locally.

These include:

- Topics publish validation for known message schemas
- service-call workflows used by the Topics panel
- Control Center mode and scenario service flows
- Timeline audit entries for control actions
- global E-stop submission flow
- degraded banner rendering through injected connection state
- Replay and Episode Comparison route-level behavior

Use the Playwright smoke suite as the source of truth for those flows unless you have a local environment that implements the required services.

## Optional Plugin Profile

If you want the optional plugin container as well:

```bash
docker compose -f docker/docker-compose.yml --profile plugin up --build
```

## Troubleshooting

If the `rosbridge` badge never reaches a healthy state:

1. Check ROS container logs:

```bash
docker compose -f docker/docker-compose.yml logs -f ros2
```

2. Verify rosbridge is listening on `9090`.
3. Verify the UI is using the intended `VITE_ROSBRIDGE_URL`.

If Overview stays empty after publishing `/odom`:

1. Confirm `/odom` messages are actually being published.
2. Verify message shape is `nav_msgs/msg/Odometry`.
3. Check browser console for WebSocket or JSON parsing errors.

If Topics discovery is empty:

1. Confirm `rosapi` services are available through rosbridge.
2. Refresh the Topics panel after the connection is healthy.
3. Check the panel for service or discovery errors.
