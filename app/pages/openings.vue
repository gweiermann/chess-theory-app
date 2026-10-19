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
    <h1>Bibliothek</h1>
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
@media (max-width: 600px) {
  h1 {
    margin: 0;
  }
}
</style>
