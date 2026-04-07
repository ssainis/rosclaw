<script setup lang="ts">
import { ref, onMounted, watch } from "vue";

/**
 * A single entity drawn on the canvas.
 * Extend as needed for more robot state fields.
 */
export interface RobotPose {
  x: number;
  y: number;
  /** Heading in radians (0 = right, π/2 = up in world frame). */
  theta: number;
  /** Optional label shown next to the robot. */
  label?: string;
}

const props = withDefaults(
  defineProps<{
    /** Array of robot poses to render. */
    robots?: RobotPose[];
    /** Canvas width in pixels. */
    width?: number;
    /** Canvas height in pixels. */
    height?: number;
    /** World units shown across the canvas width. */
    worldWidth?: number;
    /** World units shown across the canvas height. */
    worldHeight?: number;
  }>(),
  {
    robots: () => [],
    width: 600,
    height: 600,
    worldWidth: 10,
    worldHeight: 10,
  },
);

const canvasRef = ref<HTMLCanvasElement | null>(null);

/** Convert world coordinates to canvas pixels. */
function worldToCanvas(
  wx: number,
  wy: number,
  canvasWidth: number,
  canvasHeight: number,
): [number, number] {
  const px = ((wx + props.worldWidth / 2) / props.worldWidth) * canvasWidth;
  // Flip y: world y-up → canvas y-down
  const py = (1 - (wy + props.worldHeight / 2) / props.worldHeight) * canvasHeight;
  return [px, py];
}

function draw(): void {
  const canvas = canvasRef.value;
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const { width, height } = canvas;

  // Background
  ctx.fillStyle = "#1a1a2e";
  ctx.fillRect(0, 0, width, height);

  // Grid lines
  ctx.strokeStyle = "#2a2a4e";
  ctx.lineWidth = 1;
  const gridStep = width / props.worldWidth;
  for (let gx = 0; gx <= props.worldWidth; gx++) {
    const cx = gx * gridStep;
    ctx.beginPath();
    ctx.moveTo(cx, 0);
    ctx.lineTo(cx, height);
    ctx.stroke();
  }
  const gridStepY = height / props.worldHeight;
  for (let gy = 0; gy <= props.worldHeight; gy++) {
    const cy = gy * gridStepY;
    ctx.beginPath();
    ctx.moveTo(0, cy);
    ctx.lineTo(width, cy);
    ctx.stroke();
  }

  // Axes
  const [ox, oy] = worldToCanvas(0, 0, width, height);
  ctx.strokeStyle = "#444466";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(0, oy);
  ctx.lineTo(width, oy);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(ox, 0);
  ctx.lineTo(ox, height);
  ctx.stroke();

  // Robot markers
  const robotRadius = Math.min(width, height) / (props.worldWidth * 2.5);

  for (const robot of props.robots) {
    const [cx, cy] = worldToCanvas(robot.x, robot.y, width, height);

    // Body circle
    ctx.beginPath();
    ctx.arc(cx, cy, robotRadius, 0, 2 * Math.PI);
    ctx.fillStyle = "#4fc3f7";
    ctx.fill();
    ctx.strokeStyle = "#81d4fa";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Heading arrow
    const headingCanvas = -robot.theta; // flip for canvas y-down
    const arrowLen = robotRadius * 1.6;
    const ax = cx + arrowLen * Math.cos(headingCanvas);
    const ay = cy + arrowLen * Math.sin(headingCanvas);

    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(ax, ay);
    ctx.strokeStyle = "#ff8a65";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Arrowhead
    const tipAngle = Math.PI / 6;
    const tipLen = robotRadius * 0.6;
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(
      ax - tipLen * Math.cos(headingCanvas - tipAngle),
      ay - tipLen * Math.sin(headingCanvas - tipAngle),
    );
    ctx.lineTo(
      ax - tipLen * Math.cos(headingCanvas + tipAngle),
      ay - tipLen * Math.sin(headingCanvas + tipAngle),
    );
    ctx.closePath();
    ctx.fillStyle = "#ff8a65";
    ctx.fill();

    // Label
    if (robot.label) {
      ctx.font = `${Math.max(10, robotRadius * 0.9)}px monospace`;
      ctx.fillStyle = "#e0e0e0";
      ctx.textAlign = "center";
      ctx.fillText(robot.label, cx, cy - robotRadius - 4);
    }
  }
}

onMounted(() => {
  draw();
});

watch(
  () => props.robots,
  () => {
    draw();
  },
  { deep: true },
);
</script>

<template>
  <canvas
    ref="canvasRef"
    :width="width"
    :height="height"
    style="border: 1px solid #333; border-radius: 4px; display: block"
  />
</template>
