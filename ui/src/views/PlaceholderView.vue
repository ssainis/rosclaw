<script setup lang="ts">
defineProps<{
  title: string;
  description: string;
}>();
</script>

<template>
  <section class="view">
    <h1>{{ title }}</h1>
    <p>{{ description }}</p>
  </section>
</template>

<style scoped>
.view {
  padding: 1.25rem;
  border: 1px solid var(--panel-border);
  border-radius: 0.75rem;
  background: var(--panel-bg);
}

h1 {
  margin: 0 0 0.75rem;
  color: var(--text-strong);
  font-size: 1.2rem;
}

p {
  margin: 0;
  color: var(--text-muted);
}
</style>
