<script setup lang="ts">
import { computed, reactive, ref, watch } from "vue";
import {
  useLayoutStore,
  type LayoutRole,
  type OverviewPanelId,
  type RoleLayoutPreset,
} from "../stores/layout";

const layoutStore = useLayoutStore();

const roleOptions: Array<{ value: LayoutRole; label: string }> = [
  { value: "operator", label: "Operator" },
  { value: "rl-engineer", label: "RL Engineer" },
  { value: "incident-responder", label: "Incident Responder" },
];

const panelLabels: Record<OverviewPanelId, string> = {
  canvas: "Mini Canvas",
  alerts: "Top Alerts",
  events: "Event Preview",
};

const selectedRole = ref<LayoutRole>(layoutStore.selectedRole);
const editablePreset = reactive<RoleLayoutPreset>({
  panelOrder: [...layoutStore.activePreset.panelOrder],
  hiddenPanels: [...layoutStore.activePreset.hiddenPanels],
});
const saveStatus = ref<string | null>(null);

watch(selectedRole, (role) => {
  layoutStore.loadRolePreset(role);
  editablePreset.panelOrder = [...layoutStore.activePreset.panelOrder];
  editablePreset.hiddenPanels = [...layoutStore.activePreset.hiddenPanels];
  saveStatus.value = null;
});

const visiblePanels = computed(() => {
  const hidden = new Set(editablePreset.hiddenPanels);
  return editablePreset.panelOrder.filter((panelId) => !hidden.has(panelId));
});

function movePanel(panelId: OverviewPanelId, direction: "up" | "down"): void {
  const index = editablePreset.panelOrder.indexOf(panelId);
  if (index < 0) return;

  const nextIndex = direction === "up" ? index - 1 : index + 1;
  if (nextIndex < 0 || nextIndex >= editablePreset.panelOrder.length) return;

  const nextOrder = [...editablePreset.panelOrder];
  const [entry] = nextOrder.splice(index, 1);
  nextOrder.splice(nextIndex, 0, entry);
  editablePreset.panelOrder = nextOrder;
  saveStatus.value = null;
}

function panelVisible(panelId: OverviewPanelId): boolean {
  return !editablePreset.hiddenPanels.includes(panelId);
}

function setPanelVisibility(panelId: OverviewPanelId, visible: boolean): void {
  if (visible) {
    editablePreset.hiddenPanels = editablePreset.hiddenPanels.filter((id) => id !== panelId);
  } else if (!editablePreset.hiddenPanels.includes(panelId)) {
    editablePreset.hiddenPanels = [...editablePreset.hiddenPanels, panelId];
  }

  saveStatus.value = null;
}

function savePreset(): void {
  layoutStore.saveRolePreset(selectedRole.value, {
    panelOrder: [...editablePreset.panelOrder],
    hiddenPanels: [...editablePreset.hiddenPanels],
  });

  saveStatus.value = `Saved layout preset for ${selectedRole.value}.`;
}
</script>

<template>
  <section class="settings-view" data-testid="settings-view">
    <header>
      <h1>Settings</h1>
      <p>Save and load role-based layout presets for dashboard panels.</p>
    </header>

    <article class="panel" data-testid="settings-layout-panel">
      <header>
        <h2>Layout Presets</h2>
        <p>Choose a role, tune panel visibility/order, then save.</p>
      </header>

      <label class="field" data-testid="settings-layout-role-field">
        <span>Role preset</span>
        <select v-model="selectedRole" data-testid="settings-layout-role">
          <option v-for="option in roleOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
        </select>
      </label>

      <section class="panel-list" data-testid="settings-layout-panels">
        <article v-for="panelId in editablePreset.panelOrder" :key="panelId" class="panel-list-item">
          <div>
            <h3>{{ panelLabels[panelId] }}</h3>
            <small>{{ panelId }}</small>
          </div>

          <div class="panel-actions">
            <label class="toggle">
              <input
                :checked="panelVisible(panelId)"
                :data-testid="`settings-layout-visible-${panelId}`"
                type="checkbox"
                @change="setPanelVisibility(panelId, ($event.target as HTMLInputElement).checked)"
              />
              <span>Visible</span>
            </label>

            <div class="move-actions">
              <button
                type="button"
                :data-testid="`settings-layout-up-${panelId}`"
                @click="movePanel(panelId, 'up')"
              >
                Up
              </button>
              <button
                type="button"
                :data-testid="`settings-layout-down-${panelId}`"
                @click="movePanel(panelId, 'down')"
              >
                Down
              </button>
            </div>
          </div>
        </article>
      </section>

      <p class="preview" data-testid="settings-layout-preview">Visible order: {{ visiblePanels.join(" -> ") || "none" }}</p>

      <button type="button" class="save-button" data-testid="settings-layout-save" @click="savePreset">Save preset</button>
      <p v-if="saveStatus" class="save-status" data-testid="settings-layout-status">{{ saveStatus }}</p>
    </article>
  </section>
</template>

<style scoped>
.settings-view {
  display: grid;
  gap: 1rem;
}

header h1 {
  margin: 0;
  color: var(--text-strong);
  font-size: 1.25rem;
}

header p {
  margin: 0.3rem 0 0;
  color: var(--text-muted);
}

.panel {
  border: 1px solid var(--panel-border);
  border-radius: 0.65rem;
  background: var(--panel-bg);
  padding: 0.8rem;
  display: grid;
  gap: 0.7rem;
}

.field {
  display: grid;
  gap: 0.3rem;
}

.field span {
  font-size: 0.8rem;
  text-transform: uppercase;
  color: var(--text-muted);
}

.field select {
  border: 1px solid var(--panel-border);
  border-radius: 0.45rem;
  padding: 0.45rem 0.5rem;
  font: inherit;
}

.panel-list {
  display: grid;
  gap: 0.5rem;
}

.panel-list-item {
  border: 1px solid var(--panel-border);
  border-radius: 0.45rem;
  padding: 0.5rem;
  display: flex;
  justify-content: space-between;
  gap: 0.7rem;
  align-items: center;
  background: #ffffff;
}

.panel-list-item h3 {
  margin: 0;
  font-size: 0.9rem;
  color: var(--text-strong);
}

.panel-list-item small {
  color: var(--text-muted);
}

.panel-actions {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

.toggle {
  display: flex;
  align-items: center;
  gap: 0.35rem;
}

.move-actions {
  display: flex;
  gap: 0.3rem;
}

.move-actions button,
.save-button {
  border: 1px solid var(--panel-border);
  border-radius: 0.4rem;
  background: #f6fafc;
  color: var(--text-strong);
  padding: 0.35rem 0.55rem;
  font: inherit;
  cursor: pointer;
}

.preview,
.save-status {
  margin: 0;
  color: var(--text-muted);
}

.save-status {
  color: #1d6f42;
}

@media (max-width: 860px) {
  .panel-list-item {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
