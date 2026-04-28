import { createRouter, createWebHistory } from "vue-router";
import OverviewView from "../views/OverviewView.vue";
import AgentsView from "../views/AgentsView.vue";
import TopicsView from "../views/TopicsView.vue";
import ControlView from "../views/ControlView.vue";
import MetricsView from "../views/MetricsView.vue";
import TimelineView from "../views/TimelineView.vue";
import PlaceholderView from "../views/PlaceholderView.vue";

export const routes = [
  { path: "/", redirect: "/overview" },
  { path: "/overview", name: "overview", component: OverviewView },
  {
    path: "/robots",
    name: "robots",
    component: PlaceholderView,
    props: {
      title: "Robots",
      description: "Robot telemetry and quick actions land in this view during Phase 2.",
    },
  },
  {
    path: "/agents",
    name: "agents",
    component: AgentsView,
  },
  {
    path: "/topics",
    name: "topics",
    component: TopicsView,
  },
  {
    path: "/control",
    name: "control",
    component: ControlView,
  },
  {
    path: "/metrics",
    name: "metrics",
    component: MetricsView,
  },
  {
    path: "/timeline",
    name: "timeline",
    component: TimelineView,
  },
  {
    path: "/alerts",
    name: "alerts",
    component: PlaceholderView,
    props: {
      title: "Alerts and Safety",
      description: "Severity feeds and safety workflows land in this view during Phase 2.",
    },
  },
  {
    path: "/settings",
    name: "settings",
    component: PlaceholderView,
    props: {
      title: "Settings",
      description: "Backend, feature flag, and sampling controls land in this view during Phase 2.",
    },
  },
];

export const router = createRouter({
  history: createWebHistory(),
  routes,
});
