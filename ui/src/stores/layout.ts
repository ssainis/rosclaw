import { defineStore } from "pinia";

export type LayoutRole = "operator" | "rl-engineer" | "incident-responder";
export type OverviewPanelId = "canvas" | "alerts" | "events";

export interface RoleLayoutPreset {
  panelOrder: OverviewPanelId[];
  hiddenPanels: OverviewPanelId[];
}

interface LayoutState {
  selectedRole: LayoutRole;
  presets: Record<LayoutRole, RoleLayoutPreset>;
}

const STORAGE_KEY = "rosclaw.dashboard.layout.v1";
const OVERVIEW_PANEL_IDS: OverviewPanelId[] = ["canvas", "alerts", "events"];
const ROLE_IDS: LayoutRole[] = ["operator", "rl-engineer", "incident-responder"];

const DEFAULT_PRESETS: Record<LayoutRole, RoleLayoutPreset> = {
  operator: {
    panelOrder: ["canvas", "alerts", "events"],
    hiddenPanels: [],
  },
  "rl-engineer": {
    panelOrder: ["events", "canvas", "alerts"],
    hiddenPanels: [],
  },
  "incident-responder": {
    panelOrder: ["alerts", "events", "canvas"],
    hiddenPanels: [],
  },
};

function clonePreset(preset: RoleLayoutPreset): RoleLayoutPreset {
  return {
    panelOrder: [...preset.panelOrder],
    hiddenPanels: [...preset.hiddenPanels],
  };
}

function normalizePanelOrder(panelOrder: OverviewPanelId[]): OverviewPanelId[] {
  const uniq = panelOrder.filter((panelId, index) => panelOrder.indexOf(panelId) === index);
  const known = uniq.filter((panelId): panelId is OverviewPanelId => OVERVIEW_PANEL_IDS.includes(panelId));

  for (const panelId of OVERVIEW_PANEL_IDS) {
    if (!known.includes(panelId)) {
      known.push(panelId);
    }
  }

  return known;
}

function normalizeHiddenPanels(hiddenPanels: OverviewPanelId[]): OverviewPanelId[] {
  return hiddenPanels.filter((panelId, index) => {
    return hiddenPanels.indexOf(panelId) === index && OVERVIEW_PANEL_IDS.includes(panelId);
  });
}

function normalizePreset(input: RoleLayoutPreset): RoleLayoutPreset {
  return {
    panelOrder: normalizePanelOrder(input.panelOrder),
    hiddenPanels: normalizeHiddenPanels(input.hiddenPanels),
  };
}

function defaultState(): LayoutState {
  return {
    selectedRole: "operator",
    presets: {
      operator: clonePreset(DEFAULT_PRESETS.operator),
      "rl-engineer": clonePreset(DEFAULT_PRESETS["rl-engineer"]),
      "incident-responder": clonePreset(DEFAULT_PRESETS["incident-responder"]),
    },
  };
}

function readPersistedState(): LayoutState {
  if (typeof window === "undefined") {
    return defaultState();
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return defaultState();
  }

  try {
    const parsed = JSON.parse(raw) as Partial<LayoutState>;
    const state = defaultState();

    if (parsed.selectedRole && ROLE_IDS.includes(parsed.selectedRole)) {
      state.selectedRole = parsed.selectedRole;
    }

    if (parsed.presets) {
      for (const role of ROLE_IDS) {
        const preset = parsed.presets[role] as RoleLayoutPreset | undefined;
        if (!preset) continue;
        state.presets[role] = normalizePreset(preset);
      }
    }

    return state;
  } catch {
    return defaultState();
  }
}

function persistLayoutState(state: LayoutState): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      selectedRole: state.selectedRole,
      presets: state.presets,
    }),
  );
}

export const useLayoutStore = defineStore("layout", {
  state: (): LayoutState => readPersistedState(),
  getters: {
    activePreset(state): RoleLayoutPreset {
      return state.presets[state.selectedRole];
    },
    orderedOverviewPanels(state): OverviewPanelId[] {
      return normalizePanelOrder(state.presets[state.selectedRole].panelOrder);
    },
  },
  actions: {
    loadRolePreset(role: LayoutRole): void {
      this.selectedRole = role;
      persistLayoutState(this.$state);
    },

    saveRolePreset(role: LayoutRole, preset: RoleLayoutPreset): void {
      this.selectedRole = role;
      this.presets[role] = normalizePreset(preset);
      persistLayoutState(this.$state);
    },
  },
});

export function resetLayoutPersistenceForTests(): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(STORAGE_KEY);
}
