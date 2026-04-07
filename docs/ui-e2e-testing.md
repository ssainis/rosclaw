# UI End-to-End Testing Guide

This guide validates the full data path for the RosClaw dashboard UI:

1. ROS2 publishes odometry
2. rosbridge exposes WebSocket messages
3. UI subscribes to `/odom`
4. Canvas renders position and heading updates

## What To Expect

When the UI is healthy, you should see:

- A connection badge that moves between `connecting`, `connected`, and `disconnected`
- A canvas grid centered at world origin
- A robot marker and heading arrow once `/odom` data arrives
- A waiting hint when connected but no `/odom` has been received

## Start The Stack

Run from the repository root:

```bash
docker compose -f docker/docker-compose.yml up --build
```

Notes:

- This starts `ros2` and `ui` by default.
- The `rosclaw` plugin service is optional and behind the `plugin` profile.
- UI is served on `http://localhost:4173`.
- rosbridge is exposed on `ws://localhost:9090`.

## Basic Smoke Test

1. Open `http://localhost:4173`.
2. Confirm the status badge reaches `connected`.
3. Confirm the canvas is visible.
4. Confirm you see a waiting message if no odometry is present.

## Publish Test Odometry

In a second terminal, publish odometry from the ROS2 container:

```bash
docker compose -f docker/docker-compose.yml exec ros2 bash -lc "source /opt/ros/jazzy/setup.bash && ros2 topic pub -r 2 /odom nav_msgs/msg/Odometry '{pose: {pose: {position: {x: 1.5, y: -0.5, z: 0.0}, orientation: {z: 0.7071, w: 0.7071}}}}'"
```

Expected result:

- Waiting message disappears
- A robot marker appears
- Heading arrow rotates according to orientation

## Movement Update Test

Publish a different pose:

```bash
docker compose -f docker/docker-compose.yml exec ros2 bash -lc "source /opt/ros/jazzy/setup.bash && ros2 topic pub -r 5 /odom nav_msgs/msg/Odometry '{pose: {pose: {position: {x: 2.5, y: 1.0, z: 0.0}, orientation: {z: 0.0, w: 1.0}}}}'"
```

Expected result:

- Marker position changes on the canvas
- Heading updates to match new orientation

## Reconnect Test

1. Stop ROS2 temporarily:

```bash
docker compose -f docker/docker-compose.yml stop ros2
```

2. Watch UI badge change to `disconnected`/`connecting`.
3. Start ROS2 again:

```bash
docker compose -f docker/docker-compose.yml start ros2
```

4. Publish `/odom` again and confirm updates resume.

This validates reconnect + re-subscribe behavior.

## Optional: Include Plugin Service

If you want to start the optional plugin container as well:

```bash
docker compose -f docker/docker-compose.yml --profile plugin up --build
```

## Troubleshooting

If the badge never reaches `connected`:

1. Check ros2 logs:

```bash
docker compose -f docker/docker-compose.yml logs -f ros2
```

2. Verify rosbridge port is listening on `9090`.
3. Verify UI container has `VITE_ROSBRIDGE_URL=ws://ros2:9090`.

If the badge is connected but nothing renders:

1. Confirm `/odom` messages are actually being published.
2. Verify message shape is `nav_msgs/msg/Odometry`.
3. Check browser console for JSON/WebSocket errors.
