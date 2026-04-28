import { createRouter, createWebHistory } from "vue-router";
import OverviewView from "../views/OverviewView.vue";
import AgentsView from "../views/AgentsView.vue";
import TopicsView from "../views/TopicsView.vue";
import ControlView from "../views/ControlView.vue";
import MetricsView from "../views/MetricsView.vue";
import TimelineView from "../views/TimelineView.vue";
import AlertsView from "../views/AlertsView.vue";
import SettingsView from "../views/SettingsView.vue";
import ReplayView from "../views/ReplayView.vue";
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
    component: AlertsView,
  },
  {
    path: "/settings",
    name: "settings",
    component: SettingsView,
  },
  {
    path: "/replay",
    name: "replay",
    component: ReplayView,
  },
];

export const router = createRouter({
  history: createWebHistory(),
  routes,
});
