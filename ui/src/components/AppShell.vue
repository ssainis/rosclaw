<script setup lang="ts">
import { computed } from "vue";
import { RouterLink, RouterView } from "vue-router";
import { useConnectionStore } from "../stores/connection";

const navItems = [
  { to: "/overview", label: "Overview" },
  { to: "/robots", label: "Robots" },
  { to: "/agents", label: "Agents" },
  { to: "/topics", label: "Topics" },
  { to: "/control", label: "Control" },
  { to: "/metrics", label: "Metrics" },
  { to: "/timeline", label: "Timeline" },
  { to: "/alerts", label: "Alerts" },
  { to: "/settings", label: "Settings" },
];

const store = useConnectionStore();

const rosbridgeBadge = computed(() => {
  const status = store.rosbridge.status;
  const tone =
    status === "connected"
      ? "is-ok"
      : status === "stale" || status === "reconnecting"
        ? "is-warning"
        : status === "failed"
          ? "is-error"
          : "is-neutral";

  return {
    tone,
    label: status,
  };
});

const rlBadge = computed(() => {
  const status = store.rl.status;
  const tone =
    status === "connected"
      ? "is-ok"
      : status === "stale" || status === "reconnecting"
        ? "is-warning"
        : status === "failed"
          ? "is-error"
          : "is-neutral";

  return {
    tone,
    label: store.rl.transport ? `${status} (${store.rl.transport})` : status,
  };
});
</script>

<template>
  <div class="shell">
    <header class="topbar" data-testid="topbar">
      <div class="brand">RosClaw Unified Dashboard</div>
      <div class="badges">
        <span class="badge" :class="rosbridgeBadge.tone" data-testid="rosbridge-status">
          rosbridge: {{ rosbridgeBadge.label }}
        </span>
        <span class="badge" :class="rlBadge.tone" data-testid="rl-status">
          rl: {{ rlBadge.label }}
        </span>
      </div>
    </header>

    <div class="body">
      <nav class="side-nav" data-testid="side-nav">
        <RouterLink v-for="item in navItems" :key="item.to" :to="item.to">
          {{ item.label }}
        </RouterLink>
      </nav>

      <main class="content" data-testid="content-panel">
        <RouterView />
      </main>
    </div>
  </div>
</template>

<style scoped>
.shell {
  min-height: 100vh;
  display: grid;
  grid-template-rows: auto 1fr;
}

.topbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  padding: 0.9rem 1.2rem;
  border-bottom: 1px solid var(--panel-border);
  background: linear-gradient(120deg, #071f2e, #0b2f3d 55%, #184f64);
  color: #f4fbff;
}

.brand {
  font-weight: 700;
  letter-spacing: 0.02em;
}

.badges {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.badge {
  text-transform: uppercase;
  font-size: 0.72rem;
  letter-spacing: 0.04em;
  padding: 0.2rem 0.55rem;
  border-radius: 999px;
  border: 1px solid transparent;
}

.is-ok {
  background: rgba(40, 192, 95, 0.17);
  border-color: rgba(77, 255, 136, 0.35);
}

.is-warning {
  background: rgba(255, 174, 0, 0.18);
  border-color: rgba(255, 213, 0, 0.4);
}

.is-error {
  background: rgba(220, 67, 67, 0.2);
  border-color: rgba(255, 90, 90, 0.42);
}

.is-neutral {
  background: rgba(126, 147, 161, 0.2);
  border-color: rgba(174, 193, 206, 0.32);
}

.body {
  min-height: 0;
  display: grid;
  grid-template-columns: 220px 1fr;
}

.side-nav {
  padding: 1rem;
  border-right: 1px solid var(--panel-border);
  background: var(--panel-bg);
  display: grid;
  align-content: start;
  gap: 0.3rem;
}

.side-nav a {
  color: var(--text-muted);
  text-decoration: none;
  padding: 0.5rem 0.6rem;
  border-radius: 0.5rem;
  transition: background-color 160ms ease, color 160ms ease;
}

.side-nav a.router-link-active {
  background: var(--chip-bg);
  color: var(--text-strong);
  font-weight: 600;
}

.content {
  padding: 1rem;
  background: radial-gradient(circle at 18% 0%, #f4f8fb, #e7eef2 44%, #dfe8ed);
}

@media (max-width: 900px) {
  .body {
    grid-template-columns: 1fr;
  }

  .side-nav {
    border-right: 0;
    border-bottom: 1px solid var(--panel-border);
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 0.4rem;
  }

  .content {
    padding: 0.85rem;
  }
}
</style>
