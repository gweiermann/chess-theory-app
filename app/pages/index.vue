<script setup lang="ts">
import { onMounted, ref } from 'vue'
import AppFrame from '../components/base/AppFrame.vue'
import { chooseLesson } from '../modules/selection'
import type { Mode } from '../modules/shared'
const workspace = useWorkspace()
const ready = ref(false)
const error = ref<string | null>(null)
const starting = ref<Mode | null>(null)
const prepare = async () => {
  error.value = null
  try {
    await workspace.initialize()
    ready.value = true
  } catch {
    error.value =
      'Die Eröffnungen konnten nicht geladen werden. Bitte versuche es erneut.'
  }
}
onMounted(prepare)
const start = async (mode: Mode) => {
  starting.value = mode
  try {
    const catalog = workspace.catalog.value!
    const recent =
      mode === 'review'
        ? workspace.learning.value?.activity.at(-1)?.familyId
        : null
    const summary =
      catalog.families.find((family) => family.id === recent) ??
      catalog.families.find((family) => family.name === 'Italian Game') ??
      catalog.families[0]!
    const family = await workspace.library.family(summary.id)
    const learning = workspace.learning.value!
    const choice = chooseLesson({
      lines: family.lines,
      progress: learning.progress,
      memories: learning.memories,
      side: learning.settings.side,
      mode,
      now: Date.now(),
      random: Math.random,
    })
    const line = choice?.line ?? family.lines[0]!
    await navigateTo({
      path: '/learn/play',
      query: { family: summary.id, line: line.id, mode },
    })
  } catch {
    error.value = 'Die Runde konnte nicht gestartet werden. Versuche es erneut.'
  } finally {
    starting.value = null
  }
}
const resume = async () => {
  const session = workspace.learning.value?.session
  if (session)
    await navigateTo({
      path: '/learn/play',
      query: {
        family: session.familyId,
        line: session.lineId,
        mode: session.mode,
        resume: '1',
        side: session.side,
      },
    })
}
</script>
<template>
  <AppFrame active="learn">
    <h1>Lernen</h1>
    <div v-if="error" class="notice error" role="alert">
      {{ error }}
      <button class="button" @click="prepare">Erneut versuchen</button>
    </div>
    <p v-else-if="!ready" class="notice" role="status">
      Bibliothek wird geladen …
    </p>
    <template v-else>
      <p v-if="workspace.warning.value" class="notice">
        {{ workspace.warning.value }}
      </p>
      <button
        v-if="workspace.learning.value?.session"
        class="resume-card"
        @click="resume"
      >
        <strong>Letzte Runde fortsetzen</strong
        ><span aria-hidden="true">→</span>
      </button>
      <section class="modes" aria-label="Lernmodus">
        <article class="mode-card">
          <span class="mode-icon" aria-hidden="true"
            ><svg viewBox="0 0 24 24">
              <path
                d="M12 6v14M3 5c4-1 6-1 9 1 3-2 5-2 9-1v14c-4-1-6-1-9 1-3-2-5-2-9-1V5Z"
              /></svg
          ></span>
          <h2>Geführt lernen</h2>
          <NuxtLink class="button primary" to="/openings"
            >Eröffnungen entdecken →</NuxtLink
          >
        </article>
        <article class="mode-card sparring">
          <span class="mode-icon" aria-hidden="true"
            ><svg viewBox="0 0 24 24">
              <path
                d="m5 3 7 7-2 2-7-7V3h2Zm14 0-7 7 2 2 7-7V3h-2ZM4 16l4 4M6 18l6-6m8 4-4 4m2-2-6-6M3 21l3-3m15 3-3-3"
              /></svg
          ></span>
          <h2>Eröffnungs-Sparring</h2>
          <button
            class="button primary"
            :disabled="!!starting"
            @click="start('sparring')"
          >
            {{
              starting === 'sparring'
                ? 'Runde wird vorbereitet …'
                : 'Italienisch spielen →'
            }}
          </button>
        </article>
        <article class="mode-card">
          <span class="mode-icon" aria-hidden="true"
            ><svg viewBox="0 0 24 24">
              <path d="M4 10a8 8 0 1 1 1 8M4 4v6h6" /></svg
          ></span>
          <h2>Gezielt wiederholen</h2>
          <button
            class="button"
            :disabled="!!starting"
            @click="start('review')"
          >
            {{
              starting === 'review'
                ? 'Runde wird vorbereitet …'
                : 'Wiederholung starten →'
            }}
          </button>
        </article>
      </section>
    </template>
  </AppFrame>
</template>
<style scoped>
h1 {
  margin: 0 0 16px;
}
.modes {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 18px;
  flex: 1;
  min-height: 0;
}
.mode-card {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 20px;
  background: var(--paper);
  border: 1px solid var(--line);
  border-radius: 18px;
  padding: 24px;
  box-shadow: var(--shadow);
}
.mode-card.sparring {
  background: var(--soft-green);
  border-color: #c8d6bb;
}
.mode-icon {
  color: var(--green);
  width: 54px;
  height: 54px;
  background: var(--soft-green);
  border-radius: 15px;
  display: grid;
  place-items: center;
}
.mode-icon svg {
  width: 28px;
  height: 28px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.7;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.sparring .mode-icon {
  background: var(--green);
  color: white;
}
.mode-card h2 {
  font-size: 21px;
  margin: 0;
  letter-spacing: -0.025em;
}
.resume-card {
  width: 100%;
  padding: 12px 16px;
  border: 1px solid var(--line);
  background: var(--paper);
  color: var(--ink);
  border-radius: 10px;
  box-shadow: 0 2px 0 #dce3d4;
  text-align: left;
  display: flex;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
  flex-shrink: 0;
}
@media (max-width: 760px) {
  h1 {
    font-size: 25px;
    margin: 0;
  }
  .modes {
    grid-template-columns: 1fr;
    grid-template-rows: repeat(3, minmax(0, 1fr));
    gap: 10px;
  }
  .mode-card {
    display: grid;
    grid-template-columns: 42px minmax(0, 1fr);
    align-content: center;
    align-items: center;
    padding: 14px 16px;
    gap: 10px;
  }
  .mode-icon {
    width: 40px;
    height: 40px;
    border-radius: 12px;
  }
  .mode-card h2 {
    font-size: 20px;
  }
  .mode-card .button {
    grid-column: 1 / -1;
    width: 100%;
  }
  .resume-card {
    margin: 0;
    padding: 10px 12px;
    font-size: 13px;
  }
}
@media (max-height: 680px) and (max-width: 760px) {
  .mode-card {
    padding: 10px 12px;
    gap: 6px;
  }
  .mode-card .button {
    min-height: 40px;
    padding: 8px 12px;
    font-size: 13px;
  }
  .mode-card h2 {
    font-size: 16px;
  }
  .modes {
    gap: 8px;
  }
}
</style>
