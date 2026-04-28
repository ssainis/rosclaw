<script setup lang="ts">
import { ref, computed, onUnmounted } from "vue";
import { useSessionCaptureStore } from "../stores/session-capture";
import { createReplayEngine } from "../services/replay-engine";
import { eventBus } from "../core/events/runtime";

const captureStore = useSessionCaptureStore();

const sessionLabel = ref("Session " + new Date().toISOString().slice(0, 10));
const importError = computed(() => captureStore.importError);
const loadedMeta = computed(() => captureStore.loadedSession?.metadata ?? null);

// Replay engine
const engine = createReplayEngine(eventBus);
const replayState = ref(engine.state);
const offStateChange = engine.onStateChange((s) => { replayState.value = { ...s }; });

onUnmounted(() => {
  offStateChange();
  engine.dispose();
});

const scrubberMax = computed(() => Math.max(0, replayState.value.totalEvents - 1));
const scrubberValue = computed(() => replayState.value.currentIndex);

function loadSessionForReplay() {
  if (captureStore.loadedSession) {
    engine.load(captureStore.loadedSession);
  }
}

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
    const ok = captureStore.importSession(text);
    if (ok && captureStore.loadedSession) {
      engine.load(captureStore.loadedSession);
    }
  };
  reader.readAsText(file);
  input.value = "";
}

function clearLoaded() {
  engine.stop();
  captureStore.clearLoadedSession();
}

function onScrubberInput(event: Event) {
  const input = event.target as HTMLInputElement;
  engine.seekTo(Number(input.value));
}

const SPEED_OPTIONS = [
  { label: "0.5×", value: 0.5 },
  { label: "1×", value: 1 },
  { label: "2×", value: 2 },
  { label: "Instant", value: 0 },
];
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
        <div class="loaded-actions">
          <button class="btn btn-load-replay" @click="loadSessionForReplay" aria-label="Load into replay engine">
            Load into replay
          </button>
          <button class="btn btn-clear" @click="clearLoaded" aria-label="Clear loaded session">Clear</button>
        </div>
      </div>
      <p v-else class="no-session">No session loaded.</p>
    </section>

    <!-- Replay engine controls -->
    <section v-if="replayState.totalEvents > 0" class="panel" aria-label="Replay controls">
      <h2>Replay engine</h2>
      <div class="replay-status">
        <span class="status-badge" :class="replayState.status" aria-label="Replay status">
          {{ replayState.status.toUpperCase() }}
        </span>
        <span class="event-pos">
          Event {{ replayState.currentIndex }} / {{ replayState.totalEvents }}
        </span>
      </div>
      <div class="scrubber-row" aria-label="Replay scrubber">
        <input
          type="range"
          min="0"
          :max="scrubberMax"
          :value="scrubberValue"
          class="scrubber"
          aria-label="Seek position"
          @input="onScrubberInput"
        />
      </div>
      <div class="replay-actions">
        <button
          v-if="replayState.status !== 'playing'"
          class="btn btn-start"
          @click="engine.play()"
          aria-label="Play replay"
        >
          ▶ Play
        </button>
        <button
          v-else
          class="btn btn-stop"
          @click="engine.pause()"
          aria-label="Pause replay"
        >
          ⏸ Pause
        </button>
        <button class="btn btn-clear" @click="engine.stop()" aria-label="Stop and reset replay">
          ■ Stop
        </button>
        <span class="speed-label">Speed:</span>
        <button
          v-for="opt in SPEED_OPTIONS"
          :key="opt.value"
          class="btn btn-speed"
          :class="{ active: replayState.speedMultiplier === opt.value }"
          :aria-label="`Set speed ${opt.label}`"
          @click="engine.setSpeed(opt.value)"
        >
          {{ opt.label }}
        </button>
      </div>
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
.loaded-actions { display: flex; gap: 0.5rem; margin-top: 0.5rem; }
.btn-load-replay { background: #3b82f6; color: #fff; }
.no-session { color: var(--color-text-secondary, #888); font-size: 0.85rem; margin: 0; }

/* Replay controls */
.replay-status { display: flex; align-items: center; gap: 0.75rem; }
.status-badge { font-weight: 600; font-size: 0.8rem; }
.status-badge.idle { color: #9ca3af; }
.status-badge.playing { color: #22c55e; }
.status-badge.paused { color: #f59e0b; }
.status-badge.ended { color: #888; }
.event-pos { font-size: 0.85rem; color: var(--color-text-secondary, #aaa); }

.scrubber-row { display: flex; align-items: center; gap: 0.5rem; }
.scrubber { flex: 1; height: 4px; }

.replay-actions { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
.speed-label { font-size: 0.8rem; color: var(--color-text-secondary, #aaa); }
.btn-speed { 
  background: transparent; 
  border: 1px solid #555; 
  color: inherit; 
  font-size: 0.75rem;
  padding: 0.25rem 0.5rem;
}
.btn-speed.active { background: #3b82f6; border-color: #3b82f6; color: #fff; }
</style>
