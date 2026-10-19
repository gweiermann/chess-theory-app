<script setup lang="ts">
import { computed } from 'vue'
import { isFreePlay } from '../../modules/shared'
import BoardView from '../board/BoardView.vue'
import type { BoardSnapshot, MoveInput } from '../../modules/board'
import type { TrainingSnapshot } from '../../modules/training'

const props = defineProps<{
  state: TrainingSnapshot
  board: BoardSnapshot
  familyName: string
}>()
const emit = defineEmits<{
  move: [MoveInput]
  help: []
  suggest: []
  restart: []
  skip: []
  history: [number | null]
  next: []
  retrySave: []
}>()
const phaseName = computed(
  () =>
    ({
      guided: 'Geführt aufbauen',
      recall: 'Aus dem Gedächtnis',
      sparring: 'Sparring',
      punish: 'Fehler ausnutzen',
      complete: 'Runde abgeschlossen',
    })[props.state.phase],
)
const viewed = computed(() => props.board.viewedPly ?? props.board.moves.length)
const playerInput = computed(
  () => props.state.status === 'player' && props.board.viewedPly === null,
)
const solution = computed(() =>
  props.board.arrows.some((arrow) => arrow.purpose !== 'exploration')
    ? props.state.expectedSan
    : null,
)
const feedback = computed(
  () =>
    ({
      ready: '',
      punish: 'Theorie verlassen – nutze den Fehler.',
      advantage: 'Vorteil gesichert.',
      correct: 'Gut erkannt.',
      retry: 'Du hast einen zweiten Versuch.',
      solution: 'Der blaue Pfeil zeigt den Zug.',
      outside: 'Diese Fortsetzung liegt außerhalb der Übung.',
      illegal: 'Dieser Zug ist nicht legal.',
      new: 'Neue Variante.',
      'premove-cancelled': 'Vorzug nicht möglich.',
      premove: 'Vorzug vorgemerkt.',
      recall: 'Jetzt aus dem Gedächtnis.',
      repeat: 'Noch einmal ohne Hilfe.',
      complete:
        props.state.mode === 'guided' &&
        props.state.cleanRepetitions >= props.state.targetRepetitions
          ? 'Zugfolge gemeistert.'
          : 'Runde abgeschlossen.',
      'stale-session': 'Gespeicherte Runde veraltet. Neu gestartet.',
    })[props.state.message],
)
const historyText = computed(() =>
  props.board.moves
    .map((move, index) =>
      index % 2 === 0 ? `${Math.floor(index / 2) + 1}. ${move}` : move,
    )
    .join(' '),
)
</script>
<template>
  <section
    class="training-layout"
    :class="{ punish: state.phase === 'punish' }"
    :aria-label="isFreePlay(state.mode) ? familyName : state.line.name"
  >
    <header class="training-header">
      <h1 :title="isFreePlay(state.mode) ? familyName : state.line.name">
        {{ isFreePlay(state.mode) ? familyName : state.line.name }}
      </h1>
      <span class="phase-label" data-testid="training-phase">{{
        phaseName
      }}</span>
    </header>
    <div
      class="turn-banner"
      :class="{ thinking: state.status === 'opponent', active: playerInput }"
      role="status"
    >
      <span class="avatar player-avatar" :class="state.side" aria-hidden="true"
        ><svg viewBox="0 0 24 24">
          <circle cx="12" cy="6" r="3" />
          <path d="M9 10h6l-1 5 4 4H6l4-4zM5 22h14" /></svg
      ></span>
      <span class="side-label">{{
        state.side === 'white' ? 'Du spielst Weiß' : 'Du spielst Schwarz'
      }}</span>
      <span class="turn-label"
        ><i class="turn-dot" />{{
          board.viewedPly !== null
            ? 'Zugansicht · pausiert'
            : state.status === 'complete'
              ? 'Runde beendet'
              : state.status === 'opponent'
                ? 'Gegner am Zug …'
                : state.status === 'error'
                  ? 'Stellung nicht fortsetzbar'
                  : 'Dein Zug'
        }}</span
      >
      <span class="avatar opponent-avatar" aria-hidden="true"
        ><svg viewBox="0 0 24 24">
          <rect x="4" y="7" width="16" height="13" rx="4" />
          <path d="M12 3v4M8 12h.01M16 12h.01M9 16h6" /></svg
      ></span>
    </div>
    <div class="board-slot">
      <BoardView :snapshot="board" @move="emit('move', $event)" />
    </div>
    <div class="history-row">
      <p class="history-text" aria-label="Gespielte Züge" tabindex="0">
        {{ historyText || 'Grundstellung' }}
      </p>
      <div
        v-if="!isFreePlay(state.mode)"
        class="repetition-progress"
        :aria-label="`${state.cleanRepetitions} von ${state.targetRepetitions} sauberen Wiederholungen`"
      >
        <span
          class="progress-track"
          role="progressbar"
          :aria-valuenow="state.cleanRepetitions"
          :aria-valuemin="0"
          :aria-valuemax="state.targetRepetitions"
          aria-label="Saubere Wiederholungen"
          ><i
            :style="{
              width: `${Math.min(100, (state.cleanRepetitions / state.targetRepetitions) * 100)}%`,
            }" /></span
        ><strong
          >{{ state.cleanRepetitions }}/{{ state.targetRepetitions }}</strong
        >
      </div>
      <div class="history-controls">
        <button
          type="button"
          aria-label="Vorheriger Zug"
          :disabled="viewed <= 0"
          @click="emit('history', viewed - 1)"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="m14 6-6 6 6 6" />
          </svg></button
        ><button
          type="button"
          aria-label="Nächster Zug"
          :disabled="viewed >= board.moves.length"
          @click="
            emit(
              'history',
              viewed + 1 === board.moves.length ? null : viewed + 1,
            )
          "
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="m10 6 6 6-6 6" />
          </svg>
        </button>
      </div>
    </div>
    <div v-if="state.persistenceError" class="save-error" role="alert">
      <span>Fortschritt nicht gespeichert.</span
      ><button type="button" @click="emit('retrySave')">
        Erneut speichern
      </button>
    </div>
    <div
      class="feedback"
      :class="{
        completed: state.phase === 'complete',
        retry: state.message === 'retry' || state.message === 'illegal',
        helped: state.message === 'solution',
      }"
      role="status"
      :data-testid="state.phase === 'complete' ? 'round-complete' : undefined"
    >
      <svg
        v-if="state.phase === 'complete'"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="9" />
        <path d="m8 12 3 3 5-6" /></svg
      ><span>{{ feedback }}</span
      ><strong v-if="solution">{{ solution }}</strong>
    </div>
    <div class="actions">
      <button
        type="button"
        class="game-action help-action"
        aria-label="Hilfe anzeigen"
        :aria-pressed="state.message === 'solution'"
        :disabled="!playerInput"
        @click="emit('help')"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M9 18v-2c0-2-3-3-3-7a6 6 0 0 1 12 0c0 4-3 5-3 7v2M9 18h6M10 22h4"
          /></svg
        ><span>Hilfe</span>
      </button>
      <button
        type="button"
        class="game-action"
        aria-label="Neu starten"
        @click="emit('restart')"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 10a8 8 0 1 1 1 8M4 4v6h6" /></svg
        ><span>Neustart</span>
      </button>
      <button
        v-if="isFreePlay(state.mode)"
        type="button"
        class="game-action explore-action"
        aria-label="Anderen Weg zeigen"
        :disabled="
          !playerInput || state.phase === 'punish' || state.available.length < 2
        "
        @click="emit('suggest')"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 21V8M12 12l-7-7M12 12l7-7M2 5h3v3M19 8V5h3" /></svg
        ><span>Entdecken</span>
      </button>
      <button
        type="button"
        class="game-action skip-action"
        :class="{ 'next-action': state.phase === 'complete' }"
        :aria-label="
          state.phase === 'complete' ? 'Nächste Runde →' : 'Überspringen'
        "
        @click="state.phase === 'complete' ? emit('next') : emit('skip')"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="m5 5 10 7-10 7zM19 5v14" /></svg
        ><span>Weiter</span>
      </button>
    </div>
  </section>
</template>

<style scoped>
.training-layout {
  height: 100%;
  min-height: 0;
  width: 100%;
  max-width: 600px;
  margin-inline: auto;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.training-header {
  flex-shrink: 0;
  min-height: 34px;
  display: flex;
  justify-content: center;
  align-items: center;
}
h1 {
  margin: 0;
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 22px;
  line-height: 1.2;
  font-weight: 750;
  letter-spacing: -0.04em;
  text-align: left;
}
.turn-banner {
  min-height: 39px;
  display: flex;
  align-items: center;
  gap: 9px;
  flex-shrink: 0;
}
.turn-banner {
  padding: 3px 8px;
  border-radius: 12px;
  background: var(--soft-green);
}
.avatar {
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  flex-shrink: 0;
  border-radius: 9px;
}
.opponent-avatar {
  background: var(--green);
  color: var(--paper);
}
.phase-label {
  margin-left: 10px;
  flex: 0 0 126px;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  text-align: right;
  white-space: nowrap;
  font-size: 12px;
  font-weight: 650;
  color: var(--ink);
}
.turn-label {
  margin-left: auto;
  display: flex;
  gap: 5px;
  align-items: center;
  font-size: 11px;
  white-space: nowrap;
  color: var(--muted);
}
.turn-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--green);
}
.thinking .turn-dot {
  background: #b58a39;
  animation: thinking 1.1s ease-in-out infinite;
}
.player-avatar {
  background: var(--paper);
  color: var(--ink);
  box-shadow: inset 0 0 0 1px var(--line);
}
.player-avatar.black {
  background: var(--ink);
  color: var(--paper);
}
.punish .turn-banner {
  background: #fff1d8;
}
.punish .phase-label {
  color: #88652d;
  font-weight: 750;
}
.turn-banner.active .player-avatar {
  box-shadow: 0 0 0 2px var(--green);
}
.side-label {
  font-size: 12px;
  font-weight: 650;
  white-space: nowrap;
}
.new-badge {
  font-size: 10px;
  color: #856522;
  background: #fff1c8;
  padding: 3px 6px;
  border-radius: 6px;
}
.repetition-progress {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: auto;
}
.repetition-progress strong {
  font-size: 12px;
  color: var(--green);
  font-variant-numeric: tabular-nums;
}
.progress-track {
  width: 44px;
  height: 7px;
  background: var(--line);
  border-radius: 6px;
  overflow: hidden;
}
.progress-track i {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--green);
  transition: width 0.3s ease;
}
.board-slot {
  container-type: size;
  flex: 1 1 0;
  min-height: 0;
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}
.board-slot :deep(.board-view) {
  width: min(100cqw, 100cqh, 520px);
  max-width: 100%;
  margin: 0;
}
.board-slot :deep(.board-grid) {
  box-shadow:
    0 6px 18px #253b3320,
    0 0 0 4px var(--paper);
}
.history-row {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 44px;
  flex-shrink: 0;
}
.history-text {
  margin: 0;
  font:
    12px/1.4 ui-monospace,
    monospace;
  color: var(--muted);
  white-space: nowrap;
  overflow-x: auto;
  scrollbar-width: thin;
  flex: 1;
  min-width: 0;
  padding: 4px 6px;
}
.history-controls {
  display: flex;
  gap: 3px;
}
button {
  color: var(--ink);
  border: 1px solid var(--line);
  background: var(--paper);
  border-radius: 10px;
}
.history-controls button {
  min-height: 44px;
  min-width: 44px;
  padding: 9px;
  display: grid;
  place-items: center;
}
svg {
  width: 22px;
  height: 22px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.8;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.avatar svg {
  width: 21px;
  height: 21px;
}
.feedback {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  height: 44px;
  min-height: 44px;
  flex-shrink: 0;
  font-size: 12px;
  line-height: 1.4;
  text-align: center;
  border-radius: 10px;
  padding: 4px 6px;
}
.feedback.retry {
  background: #fff1d8;
  color: #88652d;
}
.feedback.helped {
  background: #e8f0fa;
  color: #375d88;
}
.feedback.completed {
  min-height: 44px;
  background: var(--soft-green);
  color: var(--green);
  font-weight: 750;
  font-size: 15px;
}
.feedback strong {
  padding: 2px 8px;
  background: var(--paper);
  border: 1px solid #b6c9dd;
  border-radius: 5px;
}
.actions {
  height: 66px;
  min-height: 66px;
  display: flex;
  gap: 8px;
  padding: 5px;
  flex-shrink: 0;
  background: var(--paper);
  border: 1px solid var(--line);
  border-radius: 16px;
  box-shadow: 0 4px 12px #253b3308;
}
.game-action {
  height: 54px;
  min-height: 54px;
  line-height: 14px;
  padding: 6px 4px;
  font-size: 11px;
  font-weight: 650;
  flex: 1;
  border: 0;
  border-radius: 11px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 5px;
  color: var(--muted);
}
.game-action:hover:not(:disabled) {
  background: var(--soft-green);
  color: var(--green);
}
.help-action {
  color: #426f9b;
  background: #edf3fb;
}
.explore-action {
  color: var(--green);
  background: var(--soft-green);
}
.next-action {
  background: var(--green);
  color: var(--paper);
  font-size: 14px;
  flex: 1;
}
.next-action:hover:not(:disabled) {
  background: var(--green);
  color: var(--paper);
  filter: brightness(1.1);
}
.save-error {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  min-height: 44px;
  flex-shrink: 0;
  padding: 4px 6px;
  background: #fff0ec;
  color: #8f4437;
  font-size: 11px;
  border-radius: 9px;
}
.save-error button {
  min-height: 44px;
  padding: 6px;
  white-space: nowrap;
}
@keyframes thinking {
  50% {
    opacity: 0.35;
  }
}
@media (max-width: 380px) {
  h1 {
    font-size: 20px;
  }
  .phase-label {
    font-size: 11px;
  }
  .turn-label {
    font-size: 10px;
  }
  .training-layout {
    gap: 5px;
  }
}
@media (prefers-reduced-motion: reduce) {
  .thinking .turn-dot {
    animation: none;
  }
  .progress-track i {
    transition: none;
  }
}
</style>
