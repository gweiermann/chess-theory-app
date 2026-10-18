<script setup lang="ts">
import { computed, ref, useId, watch } from 'vue'
import type {
  LearningOutcome,
  Mode,
  Progress,
  Settings,
  Side,
} from '../../modules/shared'

const props = withDefaults(
  defineProps<{
    settings: Settings
    activity?: readonly LearningOutcome[]
    progress?: Record<string, Progress>
    saving?: boolean
    lineNames?: Record<string, string>
  }>(),
  {
    activity: () => [],
    progress: () => ({}),
    saving: false,
    lineNames: () => ({}),
  },
)
const emit = defineEmits<{
  save: [settings: Settings]
  resume: [
    selection: { familyId: string; lineId: string; side: Side; mode: Mode },
  ]
}>()
const id = useId()
const draft = ref({ ...props.settings })
watch(
  () => props.settings,
  (settings) => {
    draft.value = { ...settings }
  },
  { deep: true },
)
const validRepetitions = computed(
  () =>
    typeof draft.value.repetitions === 'number' &&
    Number.isInteger(draft.value.repetitions) &&
    draft.value.repetitions >= 1 &&
    draft.value.repetitions <= 20,
)
const learned = computed(() => ({
  white: Object.values(props.progress).filter(
    (record) => record.side === 'white' && record.status === 'mastered',
  ).length,
  black: Object.values(props.progress).filter(
    (record) => record.side === 'black' && record.status === 'mastered',
  ).length,
}))
const recent = computed(() => {
  const seen = new Set<string>()
  return [...props.activity]
    .sort((a, b) => b.at - a.at)
    .filter((event) => {
      const key = JSON.stringify([event.lineId, event.side])
      if (event.grade === 'skipped' || seen.has(key)) return false
      seen.add(key)
      return true
    })
    .slice(0, 8)
})
const gradeLabels = {
  recalled: 'Sicher erinnert',
  retried: 'Nach erneutem Versuch',
  hinted: 'Mit Hilfe',
  suggested: 'Mit Empfehlung',
  new: 'Neue Variante',
  skipped: 'Übersprungen',
}
const sideLabel = (side: Side) => (side === 'white' ? 'Weiß' : 'Schwarz')
const dateLabel = (at: number) =>
  new Intl.DateTimeFormat('de-DE', { day: 'numeric', month: 'short' }).format(
    new Date(at),
  )
const lineLabel = (lineId: string) => props.lineNames[lineId] ?? 'Zugfolge'

function save() {
  if (props.saving || !validRepetitions.value) return
  const settings = draft.value
  if (
    !['white', 'black'].includes(settings.side) ||
    !['automatic', 'on-request'].includes(settings.suggestions) ||
    !['allowNew', 'premoves', 'autoSetup'].every(
      (key) => typeof settings[key as keyof Settings] === 'boolean',
    )
  )
    return
  emit('save', {
    side: settings.side,
    repetitions: settings.repetitions,
    allowNew: settings.allowNew,
    suggestions: settings.suggestions,
    premoves: settings.premoves,
    autoSetup: settings.autoSetup,
  })
}
</script>

<template>
  <section class="settings-panel" aria-label="Lernen und Einstellungen">
    <form class="card" @submit.prevent="save">
      <fieldset :disabled="saving">
        <legend>Trainingseinstellungen</legend>
        <div class="fields">
          <label
            >Bevorzugte Seite<select v-model="draft.side" name="side">
              <option value="white">Weiß</option>
              <option value="black">Schwarz</option>
            </select></label
          >
          <label
            >Sichere Wiederholungen<input
              v-model.number="draft.repetitions"
              name="repetitions"
              type="number"
              min="1"
              max="20"
              step="1"
              required
              :aria-invalid="!validRepetitions"
              :aria-describedby="`${id}-repetitions`"
          /></label>
          <p :id="`${id}-repetitions`" class="explanation">
            1–20 fehlerfreie Wiederholungen ohne Hilfe.
          </p>
          <p v-if="!validRepetitions" class="error" role="alert">
            Bitte gib eine ganze Zahl zwischen 1 und 20 ein.
          </p>
          <label
            >Empfehlungen zum Erkunden<select
              v-model="draft.suggestions"
              name="suggestions"
            >
              <option value="on-request">Auf Anfrage</option>
              <option value="automatic">Automatisch</option>
            </select></label
          >
          <label class="check"
            ><input
              v-model="draft.allowNew"
              name="allowNew"
              type="checkbox"
            /><span>Nahe neue Varianten im Sparring entdecken</span></label
          >
          <label class="check"
            ><input
              v-model="draft.premoves"
              name="premoves"
              type="checkbox"
            /><span>Vorauszüge erlauben</span></label
          >
          <label class="check"
            ><input
              v-model="draft.autoSetup"
              name="autoSetup"
              type="checkbox"
            /><span>Gelernte Anfangszüge vorbereiten</span></label
          >
        </div>
      </fieldset>
      <button
        type="submit"
        class="primary"
        :disabled="saving || !validRepetitions"
      >
        Einstellungen speichern
      </button>
      <p v-if="saving" role="status" class="muted">
        Einstellungen werden gespeichert …
      </p>
    </form>
    <section class="card" :aria-labelledby="`${id}-progress`">
      <h3 :id="`${id}-progress`">Dein Fortschritt</h3>
      <div class="counts">
        <p>
          <strong>{{ learned.white }}</strong
          ><span>Gelernte Varianten mit Weiß</span>
        </p>
        <p>
          <strong>{{ learned.black }}</strong
          ><span>Gelernte Varianten mit Schwarz</span>
        </p>
      </div>
      <p class="muted">
        Dein Fortschritt wird für beide Seiten getrennt festgehalten.
      </p>
    </section>
    <section class="card" :aria-labelledby="`${id}-recent`">
      <h3 :id="`${id}-recent`">Zuletzt geübt</h3>
      <p v-if="!recent.length" class="muted">Noch keine Übungen.</p>
      <ol v-else class="recent">
        <li v-for="event in recent" :key="`${event.lineId}:${event.side}`">
          <div>
            <strong>{{ lineLabel(event.lineId) }}</strong>
            <p class="muted">
              {{ sideLabel(event.side) }} · {{ dateLabel(event.at) }} ·
              {{ gradeLabels[event.grade] }}
            </p>
          </div>
          <button
            type="button"
            :aria-label="`Erneut üben: ${lineLabel(event.lineId)} mit ${sideLabel(event.side)}`"
            @click="
              emit('resume', {
                familyId: event.familyId,
                lineId: event.lineId,
                side: event.side,
                mode: event.mode,
              })
            "
          >
            Erneut üben
          </button>
        </li>
      </ol>
    </section>
  </section>
</template>

<style scoped>
.settings-panel {
  max-width: 800px;
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
.card {
  margin-bottom: 1rem;
  padding: 1.4rem;
  background: #fff;
  border: 1px solid #dce4dd;
  border-radius: 0.85rem;
}
fieldset {
  margin: 0;
  border: 0;
  padding: 0;
  min-width: 0;
}
legend {
  font-size: 1.15rem;
  font-weight: 700;
  margin-bottom: 1.2rem;
}
.fields {
  display: grid;
  gap: 1rem;
}
label {
  display: grid;
  gap: 0.5rem;
  font-size: 0.95rem;
  font-weight: 600;
}
input,
select,
button {
  font: inherit;
}
select,
input[type='number'] {
  color: #20382e;
  border: 1px solid #ccd9d0;
  border-radius: 0.6rem;
  padding: 0.8rem;
  width: 100%;
  box-sizing: border-box;
  background: #fff;
}
.check {
  display: flex;
  align-items: flex-start;
  gap: 0.7rem;
  line-height: 1.5;
}
.check input {
  margin-top: 0.3rem;
  width: 1.1rem;
  height: 1.1rem;
  accent-color: #225b40;
  flex-shrink: 0;
}
small {
  display: block;
  color: #63766c;
  font-weight: 400;
}
.explanation,
.muted {
  color: #63766c;
  font-size: 0.85rem;
  line-height: 1.6;
  margin: 0.25rem 0;
}
.error {
  color: #9a332b;
  margin: 0;
}
button {
  cursor: pointer;
  border: 1px solid #ccd9d0;
  background: #fff;
  color: #20382e;
  padding: 0.65rem 0.85rem;
  border-radius: 0.65rem;
}
.primary {
  background: #225b40;
  color: white;
  border-color: #225b40;
  margin-top: 1.3rem;
}
button:disabled {
  opacity: 0.6;
  cursor: default;
}
button:focus-visible,
input:focus-visible,
select:focus-visible {
  outline: 3px solid #7baf92;
  outline-offset: 3px;
}
h3 {
  margin: 0 0 1rem;
}
.counts {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}
.counts p {
  margin: 0 0 1rem;
}
.counts strong {
  display: block;
  font-size: 2rem;
}
.counts span {
  font-size: 0.85rem;
  color: #63766c;
}
.recent {
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  gap: 1rem;
}
.recent li {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding-top: 0.8rem;
  border-top: 1px solid #e6ece7;
}
.recent strong {
  overflow-wrap: anywhere;
}
.recent button {
  flex-shrink: 0;
}
@media (max-width: 480px) {
  .card {
    padding: 1rem;
  }
  .recent li {
    align-items: stretch;
    flex-direction: column;
    gap: 0.6rem;
  }
  .primary {
    width: 100%;
  }
}
</style>
