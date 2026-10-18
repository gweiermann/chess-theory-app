<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import type {
  Catalog,
  Family,
  OpeningLibrary,
} from '../../modules/openings/public'
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
const topic = ref('all')
const search = ref('')
const variationSearch = ref('')
const selectedId = ref<string | null>(null)
const selected = ref<Family | null>(null)
const loading = ref(false)
const error = ref('')
const limit = ref(20)
let generation = 0

const families = computed(() =>
  props.catalog.families.filter(
    (family) =>
      (topic.value === 'all' || family.topicId === topic.value) &&
      family.name
        .toLocaleLowerCase()
        .includes(search.value.trim().toLocaleLowerCase()),
  ),
)
const variations = computed(() =>
  (selected.value?.lines ?? []).filter((line) =>
    `${line.name} ${line.eco} ${line.moves.join(' ')}`
      .toLocaleLowerCase()
      .includes(variationSearch.value.trim().toLocaleLowerCase()),
  ),
)
const visible = computed(() => variations.value.slice(0, limit.value))
const topicLabel = (id: string) =>
  ({ e4: '1. e4', d4: '1. d4', c4: '1. c4', Nf3: '1. Sf3', other: 'Weitere' })[
    id
  ] ?? id

async function open(id: string) {
  const current = ++generation
  selectedId.value = id
  selected.value = null
  variationSearch.value = ''
  limit.value = 20
  error.value = ''
  loading.value = true
  emit('family', { familyId: id })
  try {
    const result = await props.library.family(id)
    if (current === generation) selected.value = result
  } catch {
    if (current === generation)
      error.value =
        'Diese Varianten konnten nicht geladen werden. Bitte versuche es erneut.'
  } finally {
    if (current === generation) loading.value = false
  }
}
function back() {
  generation++
  selectedId.value = null
  selected.value = null
  loading.value = false
  error.value = ''
}
function practice(lineId: string, mode: Mode) {
  if (selectedId.value)
    emit('practice', { familyId: selectedId.value, lineId, mode })
}
function status(lineId: string) {
  const record = props.progress[progressKey(lineId, props.side)]
  if (!record) return 'Noch nicht geübt'
  return record.status === 'mastered'
    ? 'Gelernt'
    : `${record.cleanRepetitions} sichere Wiederholungen`
}
onBeforeUnmount(() => {
  generation++
})
</script>

<template>
  <section class="library" aria-label="Eröffnungsbibliothek">
    <template v-if="!selectedId">
      <header>
        <p class="eyebrow">Dein Repertoire</p>
        <h2>Eröffnungen entdecken</h2>
        <p>
          {{ catalog.lineCount.toLocaleString('de-DE') }} Varianten. Wähle eine
          Eröffnung und spiele deine Seite.
        </p>
      </header>
      <nav class="topics" aria-label="Erster Zug">
        <button
          type="button"
          :aria-pressed="topic === 'all'"
          @click="topic = 'all'"
        >
          Alle
        </button>
        <button
          v-for="item in catalog.topics"
          :key="item.id"
          type="button"
          :aria-pressed="topic === item.id"
          @click="topic = item.id"
        >
          {{ topicLabel(item.id) }}
        </button>
      </nav>
      <label class="search"
        >Eröffnung suchen<input
          v-model="search"
          type="search"
          placeholder="Zum Beispiel Italian Game"
      /></label>
      <p class="muted" aria-live="polite">{{ families.length }} Eröffnungen</p>
      <div class="families">
        <button
          v-for="item in families"
          :key="item.id"
          type="button"
          class="family-card"
          :data-testid="`family-${item.id}`"
          @click="open(item.id)"
        >
          <strong>{{ item.name }}</strong
          ><span
            >{{ item.lineCount }} Varianten ·
            {{ topicLabel(item.topicId) }}</span
          ><span class="explore">Varianten ansehen →</span>
        </button>
      </div>
      <p v-if="!families.length" class="empty">
        Keine Eröffnung gefunden. Versuche einen anderen Suchbegriff.
      </p>
    </template>
    <template v-else>
      <button type="button" class="back" @click="back">
        ← Alle Eröffnungen
      </button>
      <p v-if="loading" role="status">Varianten werden geladen …</p>
      <div v-else-if="error" role="alert" class="error">
        <p>{{ error }}</p>
        <button type="button" @click="open(selectedId!)">Erneut laden</button>
      </div>
      <template v-else-if="selected">
        <header>
          <p class="eyebrow">
            {{ side === 'white' ? 'Du spielst Weiß' : 'Du spielst Schwarz' }}
          </p>
          <h2>{{ selected.summary.name }}</h2>
          <p>{{ selected.lines.length }} Varianten für dein Training.</p>
        </header>
        <label class="search"
          >Variante oder Zugfolge suchen<input
            v-model="variationSearch"
            type="search"
            placeholder="Name, ECO oder Züge"
            @input="limit = 20"
        /></label>
        <p class="muted" aria-live="polite">
          {{ variations.length }} Varianten
        </p>
        <ol class="variations">
          <li
            v-for="line in visible"
            :key="line.id"
            :data-testid="`line-${line.id}`"
            class="line-card"
          >
            <div class="line-meta">
              <span class="eco">{{ line.eco }}</span
              ><span>{{ status(line.id) }}</span>
            </div>
            <h3>{{ line.name }}</h3>
            <p class="moves">{{ line.moves.join(' ') }}</p>
            <div class="actions">
              <button
                type="button"
                class="primary"
                :aria-label="`Lernen: ${line.name}`"
                @click="practice(line.id, 'guided')"
              >
                Lernen</button
              ><button
                type="button"
                :aria-label="`Sparring: ${line.name}`"
                @click="practice(line.id, 'sparring')"
              >
                Sparring</button
              ><button
                type="button"
                :aria-label="`Wiederholen: ${line.name}`"
                @click="practice(line.id, 'review')"
              >
                Wiederholen
              </button>
            </div>
          </li>
        </ol>
        <button
          v-if="visible.length < variations.length"
          type="button"
          class="more"
          @click="limit += 20"
        >
          Weitere Varianten ({{ variations.length - visible.length }})
        </button>
        <p v-if="!variations.length" class="empty">
          Keine passende Variante gefunden.
        </p>
      </template>
    </template>
  </section>
</template>

<style scoped>
.library {
  max-width: 1050px;
  margin: auto;
  color: #20382e;
}
header {
  margin-bottom: 1.4rem;
}
h2 {
  font-size: clamp(1.6rem, 4vw, 2.5rem);
  margin: 0.3rem 0 0.65rem;
}
header p {
  color: #52675c;
  line-height: 1.6;
}
.eyebrow {
  text-transform: uppercase;
  font-size: 0.75rem;
  letter-spacing: 0.12em;
  font-weight: 700;
}
button,
input {
  font: inherit;
}
button {
  cursor: pointer;
  border: 1px solid #ccd9d0;
  background: #fff;
  color: #20382e;
  padding: 0.65rem 0.85rem;
  border-radius: 0.65rem;
}
button:hover {
  border-color: #297650;
}
button:focus-visible,
input:focus-visible {
  outline: 3px solid #7baf92;
  outline-offset: 3px;
}
.topics,
.actions {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}
.topics {
  margin-bottom: 1.2rem;
}
.topics button[aria-pressed='true'],
.primary {
  background: #225b40;
  color: #fff;
  border-color: #225b40;
}
.search {
  display: grid;
  gap: 0.5rem;
  font-size: 0.9rem;
  font-weight: 600;
}
input {
  background: white;
  border: 1px solid #ccd9d0;
  padding: 0.9rem;
  border-radius: 0.7rem;
  color: #20382e;
  width: 100%;
  box-sizing: border-box;
}
.muted,
.line-meta {
  color: #63766c;
  font-size: 0.85rem;
}
.families {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 260px), 1fr));
  gap: 0.85rem;
}
.family-card {
  text-align: left;
  display: grid;
  gap: 0.65rem;
  padding: 1.2rem;
}
.family-card strong {
  font-size: 1.08rem;
}
.family-card span {
  font-size: 0.85rem;
  color: #63766c;
}
.family-card .explore {
  color: #225b40;
}
.back {
  margin-bottom: 1.2rem;
}
.variations {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 0.85rem;
}
.line-card {
  background: white;
  border: 1px solid #dce4dd;
  border-radius: 0.85rem;
  padding: 1.15rem;
}
.line-meta {
  display: flex;
  justify-content: space-between;
  gap: 0.6rem;
  flex-wrap: wrap;
}
.eco {
  color: #225b40;
  font-weight: 700;
}
h3 {
  margin: 0.75rem 0 0.5rem;
  font-size: 1.08rem;
}
.moves {
  line-height: 1.7;
  color: #53685d;
  overflow-wrap: anywhere;
  margin-bottom: 1rem;
}
.more {
  margin: 1.2rem auto;
  display: block;
}
.empty {
  padding: 2rem 0;
  color: #63766c;
}
.error {
  background: #fff0e9;
  padding: 1rem;
  border-radius: 0.8rem;
}
@media (max-width: 420px) {
  .actions button {
    flex: 1;
    padding: 0.65rem 0.4rem;
    font-size: 0.85rem;
  }
}
</style>
