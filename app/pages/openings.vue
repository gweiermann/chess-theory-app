<script setup lang="ts">
import { onMounted, ref } from 'vue'
import AppFrame from '../components/base/AppFrame.vue'
import LibraryBrowser from '../components/openings/LibraryBrowser.vue'
import type { Mode } from '../modules/shared'
const workspace = useWorkspace()
const error = ref(false)
const load = async () => {
  error.value = false
  try {
    await workspace.initialize()
  } catch {
    error.value = true
  }
}
onMounted(load)
const practice = (choice: { familyId: string; lineId: string; mode: Mode }) =>
  navigateTo({
    path: '/learn/play',
    query: { family: choice.familyId, line: choice.lineId, mode: choice.mode },
  })
</script>
<template>
  <AppFrame active="library">
    <h1>Eröffnungen</h1>
    <div v-if="error" class="notice error" role="alert">
      Die Bibliothek konnte nicht geladen werden.
      <button class="button" @click="load">Erneut versuchen</button>
    </div>
    <p
      v-else-if="!workspace.catalog.value || !workspace.learning.value"
      class="notice"
      role="status"
    >
      Bibliothek wird geladen …
    </p>
    <div v-else class="library-panel">
      <LibraryBrowser
        :catalog="workspace.catalog.value"
        :library="workspace.library"
        :progress="workspace.learning.value.progress"
        :side="workspace.learning.value.settings.side"
        @practice="practice"
      />
    </div>
  </AppFrame>
</template>
<style scoped>
h1 {
  font-size: 25px;
  margin: 0 0 12px;
  flex-shrink: 0;
}
.library-panel {
  min-height: 0;
  flex: 1;
  overflow: hidden;
}
.library-panel :deep(.library) {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.library-panel :deep(.families),
.library-panel :deep(.variations) {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding-bottom: 8px;
}
.library-panel :deep(header:has(+ nav)),
.library-panel :deep(header > p) {
  display: none;
}
.library-panel :deep(header) {
  margin-bottom: 8px;
  flex-shrink: 0;
}
.library-panel :deep(header h2) {
  font-size: 20px;
  margin: 0;
}
.library-panel :deep(.topics) {
  margin-bottom: 10px;
  gap: 5px;
}
.library-panel :deep(.topics button) {
  padding: 8px 10px;
  border-radius: 12px;
  border-color: var(--line);
  background: var(--paper);
  color: var(--ink);
}
.library-panel :deep(.topics button[aria-pressed='true']) {
  background: var(--green);
  color: white;
  border-color: var(--green);
  box-shadow: 0 2px 0 #224c35;
}
.library-panel :deep(.search) {
  gap: 5px;
}
.library-panel :deep(input) {
  padding: 10px 12px;
  border-radius: 12px;
  background: var(--paper);
  border-color: var(--line);
}
.library-panel :deep(.family-card),
.library-panel :deep(.line-card) {
  background: var(--paper);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  box-shadow: 0 2px 0 #dce3d4;
}
.library-panel :deep(.family-card strong) {
  font-size: 18px;
  color: var(--ink);
}
.library-panel :deep(.family-card span),
.library-panel :deep(.line-meta),
.library-panel :deep(.moves) {
  color: var(--muted);
}
.library-panel :deep(.family-card:hover) {
  border-color: var(--green);
  background: var(--soft-green);
}
.library-panel :deep(.actions button),
.library-panel :deep(.back),
.library-panel :deep(.more) {
  border-color: var(--line);
  border-radius: 12px;
  background: var(--paper);
  color: var(--ink);
  min-height: 40px;
}
.library-panel :deep(.actions .primary) {
  background: var(--green);
  color: white;
  border-color: var(--green);
  box-shadow: 0 2px 0 #224c35;
}
.library-panel :deep(.eco) {
  display: inline-block;
  padding: 3px 8px;
  border-radius: 8px;
  background: var(--soft-green);
  color: var(--green);
}
.library-panel :deep(.muted) {
  margin: 8px 0;
}
.library-panel :deep(.back) {
  align-self: flex-start;
  margin-bottom: 10px;
}
.library-panel :deep(.more) {
  flex-shrink: 0;
  margin: 8px auto 0;
}
@media (max-width: 600px) {
  h1 {
    margin: 0;
  }
  .library-panel :deep(.family-card) {
    padding: 12px;
    gap: 6px;
  }
  .library-panel :deep(.family-card .explore) {
    display: none;
  }
  .library-panel :deep(.line-card) {
    padding: 12px;
  }
}
</style>
