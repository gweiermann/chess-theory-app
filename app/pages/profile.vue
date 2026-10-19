<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import AppFrame from '../components/base/AppFrame.vue'
import SettingsPanel from '../components/learning/SettingsPanel.vue'
import type { Mode, Settings, Side } from '../modules/shared'
import { terminalLines } from '../modules/openings'
const workspace = useWorkspace()
const saving = ref(false)
const message = ref('')
const error = ref(false)
const lineNames = ref<Record<string, string>>({})
const lessonIds = ref(new Set<string>())
const currentProgress = computed(() =>
  Object.fromEntries(
    Object.entries(workspace.learning.value?.progress ?? {}).filter(
      ([, record]) => lessonIds.value.has(record.lineId),
    ),
  ),
)
const currentActivity = computed(() =>
  (workspace.learning.value?.activity ?? []).filter(
    (event) => lineNames.value[event.lineId],
  ),
)
const load = async () => {
  error.value = false
  try {
    await workspace.initialize()
    for (const summary of workspace.catalog.value!.families) {
      const family = await workspace.library.family(summary.id)
      for (const line of family.lines) lineNames.value[line.id] = line.name
      for (const line of terminalLines(family.lines))
        lessonIds.value.add(line.id)
    }
  } catch {
    error.value = true
  }
}
onMounted(load)
const save = async (settings: Settings) => {
  saving.value = true
  const result = await workspace.repository.updateSettings(settings)
  message.value =
    result.status === 'failed'
      ? 'Die Einstellungen konnten nicht gespeichert werden.'
      : 'Einstellungen gespeichert.'
  await workspace.refresh()
  saving.value = false
}
const resume = (item: {
  familyId: string
  lineId: string
  side: Side
  mode: Mode
}) =>
  navigateTo({
    path: '/learn/play',
    query: {
      family: item.familyId,
      line: item.lineId,
      side: item.side,
      mode: item.mode,
    },
  })
</script>
<template>
  <AppFrame active="profile">
    <h1>Dein Profil</h1>
    <p v-if="workspace.warning.value" class="notice">
      {{ workspace.warning.value }}
    </p>
    <p v-if="message" role="status" class="notice">{{ message }}</p>
    <div v-if="error" class="notice error" role="alert">
      Dein Profil konnte nicht geladen werden.
      <button class="button" @click="load">Erneut versuchen</button>
    </div>
    <div v-else-if="workspace.learning.value" class="profile-panel">
      <SettingsPanel
        :settings="workspace.learning.value.settings"
        :activity="currentActivity"
        :progress="currentProgress"
        :line-names="lineNames"
        :saving="saving"
        @save="save"
        @resume="resume"
      />
    </div>
    <p v-else class="notice" role="status">Dein Profil wird geladen …</p>
  </AppFrame>
</template>
<style scoped>
h1 {
  font-size: 25px;
  margin: 0 0 12px;
  flex-shrink: 0;
}
.profile-panel {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding-bottom: 8px;
}
.profile-panel :deep(.card) {
  background: var(--paper);
  border-color: var(--line);
  border-radius: var(--radius);
  box-shadow: 0 2px 0 #dce3d4;
}
.profile-panel :deep(button),
.profile-panel :deep(input),
.profile-panel :deep(select) {
  border-radius: 12px;
  border-color: var(--line);
  color: var(--ink);
  background: var(--paper);
}
.profile-panel :deep(button.primary) {
  background: var(--green);
  color: white;
  border-color: var(--green);
  box-shadow: 0 3px 0 #224c35;
}
.profile-panel :deep(h3) {
  font-size: 20px;
  color: var(--ink);
}
.profile-panel :deep(.counts strong) {
  color: var(--green);
}
.profile-panel :deep(.counts span) {
  font-size: 14px;
  color: var(--muted);
}
@media (max-width: 600px) {
  h1 {
    margin: 0;
  }
}
</style>
