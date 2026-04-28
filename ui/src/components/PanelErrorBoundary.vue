<script setup lang="ts">
import { ref, onErrorCaptured } from "vue";

const props = withDefaults(
  defineProps<{
    panelLabel?: string;
  }>(),
  { panelLabel: "Panel" },
);

const error = ref<string | null>(null);

function reset(): void {
  error.value = null;
}

onErrorCaptured((err) => {
  error.value = err instanceof Error ? err.message : String(err);
  // Return false to prevent the error propagating further up the tree.
  return false;
});

// Expose error ref so unit tests can directly inject an error state.
defineExpose({ error, reset });
</script>

<template>
  <div
    v-if="error"
    class="panel-error"
    :data-testid="`panel-error-${props.panelLabel.toLowerCase().replace(/\s+/g, '-')}`"
    role="alert"
  >
    <p class="panel-error-title">{{ props.panelLabel }} encountered an error.</p>
    <p class="panel-error-detail">{{ error }}</p>
    <button type="button" class="panel-error-retry" @click="reset">Retry</button>
  </div>
  <slot v-else />
</template>

<style scoped>
.panel-error {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 1rem;
  border: 1px solid #f5c6cb;
  border-radius: 0.4rem;
  background: #fff5f5;
  color: #5c1a1a;
}

.panel-error-title {
  font-weight: 600;
}

.panel-error-detail {
  font-size: 0.85rem;
  font-family: monospace;
  word-break: break-word;
}

.panel-error-retry {
  align-self: flex-start;
  padding: 0.3rem 0.8rem;
  border: 1px solid #c87272;
  border-radius: 0.3rem;
  background: #fdecea;
  color: #5c1a1a;
  cursor: pointer;
  font: inherit;
}

.panel-error-retry:hover {
  background: #f5d0d0;
}
</style>
