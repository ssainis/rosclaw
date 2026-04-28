<script setup lang="ts">
import { ref, computed } from "vue";
import { useSessionCaptureStore } from "../stores/session-capture";

const captureStore = useSessionCaptureStore();

const sessionLabel = ref("Session " + new Date().toISOString().slice(0, 10));
const importError = computed(() => captureStore.importError);
const loadedMeta = computed(() => captureStore.loadedSession?.metadata ?? null);

function startRecording() {
  captureStore.startCapture(sessionLabel.value.trim() || "Unnamed session");
}

function stopAndSave() {
  const file = captureStore.stopCapture();
  if (!file) return;
  const json = JSON.stringify(file, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${file.metadata.session_id}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function exportSnapshot() {
  const json = captureStore.exportSession();
  if (!json) return;
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `snapshot-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function onFileInput(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    const text = e.target?.result as string;
    captureStore.importSession(text);
  };
  reader.readAsText(file);
  // Reset so same file can be re-selected
  input.value = "";
}

function clearLoaded() {
  captureStore.clearLoadedSession();
}
</script>

<template>
  <div class="replay-view">
    <h1>Replay</h1>
    <p class="view-subtitle">Record and import session captures for deterministic replay.</p>

    <!-- Capture controls -->
    <section class="panel" aria-label="Session capture controls">
      <h2>Capture</h2>
      <div class="capture-form">
        <label for="session-label">Session label</label>
        <input
          id="session-label"
          v-model="sessionLabel"
          type="text"
          :disabled="captureStore.isRecording"
          placeholder="e.g. patrol-run-1"
        />
      </div>

      <div class="capture-status" :class="{ recording: captureStore.isRecording }">
        <span v-if="captureStore.isRecording" class="status-badge recording" aria-label="Recording active">
          ● REC
        </span>
        <span v-else class="status-badge idle" aria-label="Not recording">
          ○ Idle
        </span>
        <span class="event-count" aria-label="Captured events">
          {{ captureStore.capturedCount }} events captured
        </span>
      </div>

      <div class="capture-actions">
        <button
          v-if="!captureStore.isRecording"
          class="btn btn-start"
          @click="startRecording"
          aria-label="Start recording"
        >
          Start recording
        </button>
        <template v-else>
          <button class="btn btn-stop" @click="stopAndSave" aria-label="Stop and save session">
            Stop &amp; save
          </button>
          <button class="btn btn-snapshot" @click="exportSnapshot" aria-label="Export snapshot">
            Export snapshot
          </button>
        </template>
      </div>
    </section>

    <!-- Import / load -->
    <section class="panel" aria-label="Session import">
      <h2>Load session file</h2>
      <p class="import-hint">Import a previously exported <code>.json</code> session file to enable replay.</p>
      <label class="file-label" aria-label="Choose session file">
        <input type="file" accept=".json,application/json" @change="onFileInput" aria-label="Session file input" />
        Choose file
      </label>
      <p v-if="importError" class="import-error" role="alert">{{ importError }}</p>

      <div v-if="loadedMeta" class="loaded-session" aria-label="Loaded session summary">
        <p><strong>Loaded:</strong> {{ loadedMeta.label }}</p>
        <p><strong>Events:</strong> {{ loadedMeta.event_count }}</p>
        <p><strong>Sources:</strong> {{ loadedMeta.sources.join(", ") }}</p>
        <p><strong>Recorded:</strong> {{ loadedMeta.start_timestamp }}</p>
        <button class="btn btn-clear" @click="clearLoaded" aria-label="Clear loaded session">Clear</button>
      </div>
      <p v-else class="no-session">No session loaded.</p>
    </section>
  </div>
</template>

<style scoped>
.replay-view {
  padding: var(--space-md, 1rem);
  display: flex;
  flex-direction: column;
  gap: var(--space-md, 1rem);
}
h1 { margin: 0 0 0.25rem; font-size: 1.4rem; }
.view-subtitle { margin: 0 0 0.5rem; color: var(--color-text-secondary, #888); font-size: 0.9rem; }
.panel {
  background: var(--color-surface, #1e1e2e);
  border: 1px solid var(--color-border, #333);
  border-radius: 6px;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}
.panel h2 { margin: 0; font-size: 1rem; }
.capture-form { display: flex; flex-direction: column; gap: 0.25rem; }
.capture-form label { font-size: 0.8rem; color: var(--color-text-secondary, #aaa); }
.capture-form input {
  padding: 0.35rem 0.5rem;
  background: var(--color-bg, #12121a);
  border: 1px solid var(--color-border, #444);
  border-radius: 4px;
  color: inherit;
  width: 240px;
}
.capture-status { display: flex; align-items: center; gap: 0.75rem; }
.status-badge { font-size: 0.8rem; font-weight: 600; }
.status-badge.recording { color: #f87171; }
.status-badge.idle { color: #9ca3af; }
.event-count { font-size: 0.85rem; color: var(--color-text-secondary, #aaa); }
.capture-actions { display: flex; gap: 0.5rem; flex-wrap: wrap; }
.btn {
  padding: 0.35rem 0.85rem;
  border-radius: 4px;
  border: none;
  cursor: pointer;
  font-size: 0.85rem;
  font-weight: 500;
}
.btn-start { background: #22c55e; color: #000; }
.btn-stop { background: #ef4444; color: #fff; }
.btn-snapshot { background: #3b82f6; color: #fff; }
.btn-clear { background: transparent; border: 1px solid #555; color: inherit; }
.import-hint { margin: 0; font-size: 0.85rem; color: var(--color-text-secondary, #aaa); }
.file-label {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.35rem 0.85rem;
  border-radius: 4px;
  border: 1px solid #555;
  cursor: pointer;
  font-size: 0.85rem;
}
.file-label input { display: none; }
.import-error { color: #f87171; font-size: 0.85rem; margin: 0; }
.loaded-session {
  background: var(--color-bg, #12121a);
  border-radius: 4px;
  padding: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}
.loaded-session p { margin: 0; font-size: 0.85rem; }
.no-session { color: var(--color-text-secondary, #888); font-size: 0.85rem; margin: 0; }
</style>
