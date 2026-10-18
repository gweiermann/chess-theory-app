<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, shallowRef } from 'vue'
import TrainingPanel from '../../components/training/TrainingPanel.vue'
import knightIcon from '../../assets/pieces/wN.svg'
import { createBoard } from '../../modules/board'
import { createTraining } from '../../modules/training'
import { chooseLesson } from '../../modules/selection'
import type { BoardSnapshot } from '../../modules/board'
import type {
  TrainingController,
  TrainingSnapshot,
} from '../../modules/training'
import type {
  Family,
  Mode,
  MoveInput,
  SavedSession,
} from '../../modules/shared'
const route = useRoute()
const router = useRouter()
const workspace = useWorkspace()
const board = createBoard()
const boardState = shallowRef<BoardSnapshot>(board.snapshot())
const state = shallowRef<TrainingSnapshot | null>(null)
const family = shallowRef<Family | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)
let training: TrainingController | null = null
let unsubscribe: (() => void) | undefined
const unsubscribeBoard = board.subscribe(() => {
  boardState.value = board.snapshot()
})
let disposed = false
const begin = async (lineId: string, mode: Mode, saved?: SavedSession) => {
  training?.dispose()
  unsubscribe?.()
  const learning = workspace.learning.value!
  const side =
    route.query.side === 'black' || route.query.side === 'white'
      ? route.query.side
      : learning.settings.side
  training = createTraining({
    board,
    repository: workspace.repository,
    family: family.value!,
    learning,
    settings: { ...learning.settings, side },
    datasetRevision: workspace.catalog.value!.revision,
  })
  unsubscribe = training.subscribe(() => {
    state.value = training!.snapshot()
  })
  training.start(lineId, mode, side, saved)
  state.value = training.snapshot()
  await training.retrySaving()
  if (!disposed)
    await router.replace({
      query: {
        family: family.value!.summary.id,
        line: state.value.line.id,
        mode,
        side,
        resume: '1',
      },
    })
}
const load = async () => {
  error.value = null
  loading.value = true
  try {
    await workspace.initialize()
    const summary = workspace.catalog.value!.families.find(
      (item) => item.id === route.query.family,
    )
    if (!summary)
      throw new Error(
        'Diese Eröffnung ist nicht mehr verfügbar. Wähle eine andere in der Bibliothek.',
      )
    const loaded = await workspace.library.family(summary.id)
    if (disposed) return
    family.value = loaded
    const line = loaded.lines.find((item) => item.id === route.query.line)
    if (!line)
      throw new Error(
        'Diese Zugfolge ist nicht mehr verfügbar. Wähle eine andere in der Bibliothek.',
      )
    const mode: Mode =
      route.query.mode === 'sparring' || route.query.mode === 'review'
        ? route.query.mode
        : 'guided'
    await begin(
      line.id,
      mode,
      route.query.resume === '1'
        ? (workspace.learning.value?.session ?? undefined)
        : undefined,
    )
  } catch (caught) {
    if (!disposed)
      error.value =
        caught instanceof Error
          ? caught.message
          : 'Die Runde konnte nicht geladen werden.'
  } finally {
    if (!disposed) loading.value = false
  }
}
onMounted(load)
const next = async () => {
  await training?.retrySaving()
  await workspace.refresh()
  const learning = workspace.learning.value!
  const current = state.value!
  const choice = chooseLesson({
    lines: family.value!.lines,
    progress: learning.progress,
    memories: learning.memories,
    side: current.side,
    mode: current.mode,
    now: Date.now(),
    random: Math.random,
    lastLineId: current.line.id,
  })
  if (!choice) {
    await navigateTo('/openings')
    return
  }
  await begin(choice.line.id, current.mode)
}
const move = (input: MoveInput) => training?.submit(input)
onBeforeUnmount(() => {
  disposed = true
  training?.dispose()
  unsubscribe?.()
  unsubscribeBoard()
  board.dispose()
})
</script>
<template>
  <div class="play-page">
    <header class="play-header">
      <NuxtLink
        to="/"
        class="nav-button"
        aria-label="Verlassen"
        title="Verlassen"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="m14 6-6 6 6 6" />
        </svg>
      </NuxtLink>
      <span class="play-emblem" aria-hidden="true"
        ><img :src="knightIcon" alt=""
      /></span>
      <NuxtLink
        to="/openings"
        class="nav-button"
        aria-label="Bibliothek"
        title="Bibliothek"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M12 6c-3-2-6-2-9-1v14c3-1 6-1 9 1 3-2 6-2 9-1V5c-3-1-6-1-9 1Zm0 0v14"
          />
        </svg>
      </NuxtLink>
    </header>
    <main>
      <p v-if="loading" role="status" class="notice">
        Deine Runde wird vorbereitet …
      </p>
      <div v-else-if="error" class="notice error" role="alert">
        {{ error }}
        <div class="error-actions">
          <button class="button" @click="load">Erneut versuchen</button
          ><NuxtLink to="/openings" class="button primary"
            >Zur Bibliothek</NuxtLink
          >
        </div>
      </div>
      <template v-else-if="state && family"
        ><p v-if="workspace.warning.value" class="notice">
          {{ workspace.warning.value }}
        </p>
        <TrainingPanel
          :state="state"
          :board="boardState"
          :family-name="family.summary.name"
          @move="move"
          @help="training?.requestHelp()"
          @suggest="training?.requestSuggestion()"
          @restart="training?.restart()"
          @skip="training?.skip()"
          @history="training?.viewHistory($event)"
          @next="next"
          @retry-save="training?.retrySaving()"
      /></template>
    </main>
  </div>
</template>
<style scoped>
.play-page {
  height: 100dvh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: radial-gradient(
    ellipse at 50% 25%,
    #fffdf5 0,
    var(--surface) 70%
  );
  padding-bottom: env(safe-area-inset-bottom);
}
.play-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  max-width: 620px;
  margin: 0 auto;
  padding: 10px 20px 4px;
  flex-shrink: 0;
}
.nav-button {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  border: 1px solid var(--line);
  border-radius: 15px;
  background: var(--paper);
  box-shadow: 0 2px 0 #253b330a;
  color: var(--ink);
}
.nav-button svg {
  width: 22px;
  height: 22px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.8;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.play-emblem {
  display: grid;
  place-items: center;
  width: 38px;
  height: 38px;
  border-radius: 13px;
  background: var(--green);
  box-shadow: 0 3px 0 #224c35;
}
.play-emblem img {
  width: 31px;
  height: 31px;
}
.play-page main {
  width: 100%;
  max-width: 620px;
  margin: 0 auto;
  padding: 10px 20px 16px;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.play-page main > :deep(.training-layout) {
  flex: 1;
  min-height: 0;
}
.play-page main > .notice {
  flex-shrink: 0;
  margin-bottom: 8px;
  padding: 8px 12px;
}
.error-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
}
@media (max-width: 600px) {
  .play-header {
    padding: 6px 12px 2px;
  }
  .play-page main {
    padding: 6px 10px 10px;
  }
}
@media (prefers-reduced-motion: no-preference) {
  .nav-button {
    transition: transform 120ms ease;
  }
  .nav-button:active {
    transform: scale(0.96);
  }
}
</style>
