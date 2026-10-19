<script setup lang="ts">
import { computed, onBeforeUnmount, ref, shallowRef, watch } from 'vue'
import { terminalLines, createRepertoire } from '../../modules/openings'
import type {
  Catalog,
  Family,
  OpeningLibrary,
  OpeningLine,
} from '../../modules/openings'
import { chooseLesson } from '../../modules/selection'
import type { Mode, Progress, Side } from '../../modules/shared'
import { progressKey } from '../../modules/shared'

const props = defineProps<{
  catalog: Catalog
  library: OpeningLibrary
  progress: Record<string, Progress>
  side: Side
}>()
const emit = defineEmits<{
  practice: [value: { familyId: string; lineId: string; mode: Mode }]
  family: [value: { familyId: string }]
}>()
const selected = shallowRef<Family | null>(null)
const loading = ref(true)
const error = ref('')
const search = ref('')
const filter = ref<'new' | 'learned' | 'all'>('new')
let generation = 0
const learnedPaths = computed(() =>
  createRepertoire(
    (selected.value?.lines ?? []).filter(
      (line) =>
        props.progress[progressKey(line.id, props.side)]?.status === 'mastered',
    ),
  ),
)
const learned = (line: OpeningLine) =>
  learnedPaths.value.matching(line.moves).length > 0
const lines = computed(() =>
  terminalLines(selected.value?.lines ?? []).sort(
    (a, b) =>
      b.moves.length - a.moves.length ||
      a.name.localeCompare(b.name) ||
      a.id.localeCompare(b.id),
  ),
)
const next = computed(
  () =>
    chooseLesson({
      lines: selected.value?.lines ?? [],
      progress: props.progress,
      memories: {},
      side: props.side,
      mode: 'guided',
      now: 0,
      random: () => 0,
    })?.line,
)
const visible = computed(() =>
  lines.value.filter(
    (line) =>
      (filter.value === 'all' ||
        learned(line) === (filter.value === 'learned')) &&
      `${line.name} ${line.eco} ${line.moves.join(' ')}`
        .toLocaleLowerCase()
        .includes(search.value.trim().toLocaleLowerCase()),
  ),
)
const shortName = (line: OpeningLine) =>
  line.name.replace(/^Italian Game:\s*/, '')
const movesText = (line: OpeningLine) =>
  line.moves
    .map((move, index) =>
      index % 2 === 0 ? `${Math.floor(index / 2) + 1}. ${move}` : move,
    )
    .join(' ')
function practice(lineId: string, mode: Mode) {
  if (selected.value)
    emit('practice', { familyId: selected.value.summary.id, lineId, mode })
}
async function load() {
  const id = props.catalog.families[0]?.id
  const current = ++generation
  selected.value = null
  error.value = ''
  loading.value = true
  try {
    if (!id) throw new Error('No opening available')
    emit('family', { familyId: id })
    const family = await props.library.family(id)
    if (current === generation) selected.value = family
  } catch {
    if (current === generation)
      error.value = 'Die Varianten konnten nicht geladen werden.'
  } finally {
    if (current === generation) loading.value = false
  }
}
watch(() => [props.catalog, props.library], load, { immediate: true })
onBeforeUnmount(() => {
  generation++
})
</script>
<template>
  <section class="library" aria-label="Eröffnungsbibliothek">
    <p v-if="loading" role="status">Varianten werden geladen …</p>
    <div v-else-if="error" role="alert" class="error">
      <p>{{ error }}</p>
      <button type="button" @click="load">Erneut laden</button>
    </div>
    <template v-else-if="selected">
      <header>
        <h2>
          {{
            selected.summary.name === 'Italian Game'
              ? 'Italienisch'
              : selected.summary.name
          }}
        </h2>
        <span class="side">{{ side === 'white' ? 'Weiß' : 'Schwarz' }}</span>
      </header>
      <button
        v-if="next"
        type="button"
        class="recommendation"
        aria-label="Nächste Variante lernen"
        @click="practice(next.id, 'guided')"
      >
        <span
          ><strong>Nächste Variante</strong
          ><span class="recommended-name">{{ shortName(next) }}</span></span
        >
        <span class="recommendation-arrow" aria-hidden="true">→</span>
      </button>
      <p v-else class="all-learned" role="status">Alle Varianten gelernt.</p>
      <nav class="filters" aria-label="Varianten filtern">
        <button
          type="button"
          :aria-pressed="filter === 'new'"
          @click="filter = 'new'"
        >
          Offen
        </button>
        <button
          type="button"
          :aria-pressed="filter === 'learned'"
          @click="filter = 'learned'"
        >
          Gelernt
        </button>
        <button
          type="button"
          :aria-pressed="filter === 'all'"
          @click="filter = 'all'"
        >
          Alle
        </button>
      </nav>
      <label class="search"
        ><span class="visually-hidden">Variante oder Zugfolge suchen</span
        ><input
          v-model="search"
          type="search"
          placeholder="Variante oder Zugfolge suchen"
      /></label>
      <ol class="variations" aria-label="Vollständige Varianten">
        <li
          v-for="line in visible"
          :key="line.id"
          :data-testid="`line-${line.id}`"
          class="line-card"
        >
          <div class="line-meta">
            <span>{{ Math.ceil(line.moves.length / 2) }} Züge</span
            ><span v-if="learned(line)" class="learned">Gelernt ✓</span>
          </div>
          <h3>{{ shortName(line) }}</h3>
          <p class="moves" tabindex="0" :aria-label="`Zugfolge: ${line.name}`">
            {{ movesText(line) }}
          </p>
          <div class="actions">
            <button
              v-if="!learned(line)"
              type="button"
              class="primary"
              :aria-label="`Lernen: ${line.name}`"
              @click="practice(line.id, 'guided')"
            >
              Lernen
            </button>
            <button
              type="button"
              :aria-label="`Wiederholen: ${line.name}`"
              @click="practice(line.id, 'review')"
            >
              Wiederholen
            </button>
          </div>
        </li>
        <li v-if="!visible.length" class="empty">
          {{
            filter === 'learned' && !search
              ? 'Noch keine Variante gelernt.'
              : 'Keine passenden Varianten.'
          }}
        </li>
      </ol>
    </template>
  </section>
</template>
<style scoped>
.library {
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 0;
  max-width: 760px;
  margin: 0 auto;
  color: var(--ink);
}
header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-shrink: 0;
}
h2 {
  margin: 0;
  font-size: 24px;
  letter-spacing: -0.03em;
}
.side {
  font-size: 12px;
  font-weight: 650;
  padding: 6px 10px;
  border: 1px solid var(--line);
  border-radius: 9px;
  background: var(--paper);
}
button,
input {
  font: inherit;
  color: var(--ink);
  border: 1px solid var(--line);
  border-radius: 12px;
  background: var(--paper);
}
button {
  min-height: 44px;
  padding: 10px 14px;
  cursor: pointer;
}
button:hover {
  border-color: var(--green);
}
.recommendation {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  text-align: left;
  padding: 14px 16px;
  background: var(--soft-green);
  border-color: #c8d6bb;
  box-shadow: 0 2px 0 #d1ddc6;
  flex-shrink: 0;
}
.recommendation > span:first-child {
  min-width: 0;
}
.recommendation strong {
  font-size: 16px;
}
.recommended-name {
  display: block;
  margin-top: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  color: var(--muted);
}
.recommendation-arrow {
  font-size: 24px;
  color: var(--green);
}
.filters {
  display: flex;
  gap: 6px;
  flex-shrink: 0;
}
.filters button {
  flex: 1;
  font-size: 13px;
  font-weight: 650;
}
.filters [aria-pressed='true'],
.primary {
  background: var(--green);
  color: var(--paper);
  border-color: var(--green);
}
.search {
  display: block;
  flex-shrink: 0;
}
input {
  width: 100%;
  min-height: 44px;
  padding: 10px 12px;
  font-size: 14px;
}
.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
}
.variations {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 0 2px 8px 0;
  margin: 0;
  list-style: none;
}
.line-card {
  background: var(--paper);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  padding: 14px;
  box-shadow: 0 2px 0 #dce3d4;
}
.line-meta {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  font-size: 11px;
  color: var(--muted);
}
.learned {
  color: var(--green);
  font-weight: 700;
}
h3 {
  font-size: 15px;
  line-height: 1.3;
  margin: 8px 0;
}
.moves {
  font:
    12px/1.5 ui-monospace,
    monospace;
  color: var(--muted);
  white-space: nowrap;
  overflow-x: auto;
  margin: 0 0 12px;
  padding-bottom: 4px;
}
.actions {
  display: flex;
  gap: 8px;
}
.actions button {
  font-size: 13px;
  padding: 8px 16px;
}
.all-learned,
.empty {
  color: var(--muted);
  font-size: 14px;
  padding: 12px 0;
  margin: 0;
}
.error {
  background: #fff0e9;
  padding: 16px;
  border-radius: 12px;
}
@media (max-height: 680px) {
  .library {
    gap: 8px;
  }
  .recommendation {
    padding: 10px 12px;
  }
}
</style>
