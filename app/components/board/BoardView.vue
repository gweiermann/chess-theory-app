<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import type { BoardSnapshot, Piece, MoveInput } from '../../modules/board'

const props = defineProps<{ snapshot: BoardSnapshot; disabled?: boolean }>()
const emit = defineEmits<{ move: [move: MoveInput] }>()
const selected = ref<string | null>(null)
const promotion = ref<{ from: string; to: string } | null>(null)
const grid = ref<HTMLElement | null>(null)
const gesture = ref<{
  id: number
  from: string
  startX: number
  startY: number
  x: number
  y: number
  dragging: boolean
  capture: HTMLElement
} | null>(null)
let suppressPointerClick = false
const pieceImage = (piece: Pick<Piece, 'side' | 'type'>) =>
  pieceImages[
    `../../assets/pieces/${piece.side === 'white' ? 'w' : 'b'}${piece.type.toUpperCase()}.svg`
  ]
const pieceImages = import.meta.glob<string>('../../assets/pieces/*.svg', {
  eager: true,
  query: '?url',
  import: 'default',
})
const draggedPiece = computed(() =>
  gesture.value?.dragging ? pieces.value.get(gesture.value.from) : undefined,
)
const ghostStyle = computed(() => {
  const rect = grid.value?.getBoundingClientRect()
  return rect && gesture.value
    ? {
        left: `${gesture.value.x - rect.left}px`,
        top: `${gesture.value.y - rect.top}px`,
        width: `${rect.width / 8}px`,
      }
    : {}
})
const names: Record<string, string> = {
  k: 'König',
  q: 'Dame',
  r: 'Turm',
  b: 'Läufer',
  n: 'Springer',
  p: 'Bauer',
}
const promotions = [
  { type: 'q', label: 'Dame' },
  { type: 'r', label: 'Turm' },
  { type: 'b', label: 'Läufer' },
  { type: 'n', label: 'Springer' },
]
const pieces = computed(
  () => new Map(props.snapshot.pieces.map((piece) => [piece.square, piece])),
)
const squares = computed(() => {
  const files = props.snapshot.orientation === 'white' ? 'abcdefgh' : 'hgfedcba'
  const ranks = props.snapshot.orientation === 'white' ? '87654321' : '12345678'
  return [...ranks].flatMap((rank) =>
    [...files].map((file) => `${file}${rank}`),
  )
})
const locked = computed(
  () =>
    props.disabled ||
    props.snapshot.input === 'disabled' ||
    props.snapshot.viewedPly !== null ||
    (props.snapshot.turn !== props.snapshot.playerSide &&
      props.snapshot.input !== 'premove'),
)
const targets = computed(
  () =>
    new Set(
      props.snapshot.turn === props.snapshot.playerSide
        ? props.snapshot.legalMoves
            .filter((move) => move.from === selected.value)
            .map((move) => move.to)
        : [],
    ),
)
const queuedSquares = computed(
  () =>
    new Set(
      props.snapshot.premoveQueue.flatMap((move) => [move.from, move.to]),
    ),
)
const queueOrder = (square: string) =>
  props.snapshot.premoveQueue.findIndex((move) => move.to === square) + 1
function clearInteraction() {
  selected.value = null
  promotion.value = null
  cancelGesture()
}
watch(
  () => props.disabled,
  (disabled) => {
    if (disabled) clearInteraction()
  },
)
watch(
  () => props.snapshot,
  (next, previous) => {
    const sameContext =
      next.gameId === previous.gameId &&
      next.playerSide === previous.playerSide &&
      next.orientation === previous.orientation &&
      next.viewedPly === null &&
      previous.viewedPly === null &&
      next.input !== 'disabled' &&
      !props.disabled
    if (!sameContext) {
      clearInteraction()
      return
    }
    if (next.revision === previous.revision) return
    const from = gesture.value?.from ?? selected.value ?? promotion.value?.from
    const before = previous.pieces.find((piece) => piece.square === from)
    const after = next.pieces.find((piece) => piece.square === from)
    // Retain coordinate intent, not an old MoveAttempt. Training will validate it
    // against the current revision when the learner finishes the gesture.
    const singleOpponentReply =
      previous.input === 'premove' &&
      previous.turn !== previous.playerSide &&
      next.turn === next.playerSide &&
      next.revision === previous.revision + 1 &&
      next.moves.length === previous.moves.length + 1 &&
      previous.moves.every((move, index) => next.moves[index] === move)
    const head = previous.premove
    const executed = next.lastPremove
    const replyAndAutomaticPremove =
      previous.input === 'premove' &&
      previous.turn !== previous.playerSide &&
      next.turn !== next.playerSide &&
      next.revision === previous.revision + 2 &&
      next.moves.length === previous.moves.length + 2 &&
      previous.moves.every((move, index) => next.moves[index] === move) &&
      head &&
      executed &&
      executed.revision === next.revision &&
      executed.from === head.from &&
      executed.to === head.to &&
      executed.promotion === head.promotion
    // Vue may publish the reply, queue consumption and acceptance individually.
    // Only the Board's explicit automatic-acceptance marker authorizes this step.
    const singleAutomaticPremove =
      previous.input === 'premove' &&
      previous.turn === previous.playerSide &&
      next.turn !== next.playerSide &&
      next.revision === previous.revision + 1 &&
      next.moves.length === previous.moves.length + 1 &&
      previous.moves.every((move, index) => next.moves[index] === move) &&
      executed?.revision === next.revision
    const unchangedOwnPiece =
      before &&
      after &&
      before.side === next.playerSide &&
      after.side === before.side &&
      after.type === before.type
    if (
      (!singleOpponentReply &&
        !replyAndAutomaticPremove &&
        !singleAutomaticPremove) ||
      !unchangedOwnPiece
    )
      clearInteraction()
  },
)
const label = (square: string) => {
  const piece = pieces.value.get(square)
  return piece
    ? `${square} ${piece.side === 'white' ? 'Weiß' : 'Schwarz'} ${names[piece.type]}`
    : `${square} leer`
}
function submit(from: string, to: string) {
  const piece = pieces.value.get(from)
  selected.value = null
  if (piece?.type === 'p' && to[1] === (piece.side === 'white' ? '8' : '1')) {
    promotion.value = { from, to }
  } else emit('move', { from, to })
}
function choose(square: string, event: MouseEvent) {
  if (suppressPointerClick && event.detail !== 0) return
  if (locked.value || promotion.value) return
  const piece = pieces.value.get(square)
  if (selected.value === square) {
    selected.value = null
    return
  }
  if (piece?.side === props.snapshot.playerSide) {
    selected.value = square
    return
  }
  if (selected.value) submit(selected.value, square)
}
function promote(type: string) {
  if (!promotion.value || locked.value) return
  emit('move', { ...promotion.value, promotion: type })
  promotion.value = null
}
function cancelGesture() {
  const active = gesture.value
  gesture.value = null
  if (active?.capture.hasPointerCapture?.(active.id))
    active.capture.releasePointerCapture(active.id)
  if (active?.dragging) {
    selected.value = null
    suppressPointerClick = true
  }
}
function pointerDown(event: PointerEvent, square: string) {
  if (gesture.value || event.isPrimary === false || event.button !== 0) return
  suppressPointerClick = false
  const piece = pieces.value.get(square)
  if (
    locked.value ||
    promotion.value ||
    piece?.side !== props.snapshot.playerSide
  )
    return
  const capture = event.currentTarget as HTMLElement
  gesture.value = {
    id: event.pointerId,
    from: square,
    startX: event.clientX,
    startY: event.clientY,
    x: event.clientX,
    y: event.clientY,
    dragging: false,
    capture,
  }
  try {
    capture.setPointerCapture?.(event.pointerId)
  } catch {
    // Synthetic accessibility/test pointers have no browser capture identity.
  }
}
function pointerMove(event: PointerEvent) {
  const active = gesture.value
  if (!active || active.id !== event.pointerId) return
  active.x = event.clientX
  active.y = event.clientY
  if (
    !active.dragging &&
    Math.hypot(active.x - active.startX, active.y - active.startY) >= 7
  ) {
    active.dragging = true
    selected.value = active.from
  }
  if (active.dragging) event.preventDefault()
}
function pointerUp(event: PointerEvent) {
  const active = gesture.value
  if (!active || active.id !== event.pointerId) return
  const rect = grid.value?.getBoundingClientRect()
  const wasDragging = active.dragging
  cancelGesture()
  if (
    !wasDragging ||
    locked.value ||
    !rect ||
    rect.width <= 0 ||
    rect.height <= 0
  )
    return
  event.preventDefault()
  const x = event.clientX - rect.left,
    y = event.clientY - rect.top
  if (x < 0 || y < 0 || x >= rect.width || y >= rect.height) return
  const to =
    squares.value[
      Math.floor((y / rect.height) * 8) * 8 + Math.floor((x / rect.width) * 8)
    ]
  if (to && to !== active.from) submit(active.from, to)
}
function pointerCancel(event: PointerEvent) {
  if (gesture.value?.id === event.pointerId) cancelGesture()
}
onBeforeUnmount(cancelGesture)
function center(square: string) {
  const index = squares.value.indexOf(square)
  return { x: (index % 8) + 0.5, y: Math.floor(index / 8) + 0.5 }
}
function arrowShape(fromSquare: string, toSquare: string) {
  const from = center(fromSquare)
  const to = center(toSquare)
  const dx = to.x - from.x
  const dy = to.y - from.y
  const length = Math.hypot(dx, dy)
  const shoulder = length - 0.48
  return {
    path: `M .12 -.11 H ${shoulder} V -.3 L ${length} 0 L ${shoulder} .3 V .11 H .12 Q 0 .11 0 0 Q 0 -.11 .12 -.11 Z`,
    transform: `translate(${from.x} ${from.y}) rotate(${(Math.atan2(dy, dx) * 180) / Math.PI})`,
  }
}
const arrowColor = (purpose: string) =>
  purpose === 'solution'
    ? '#477eaa'
    : purpose === 'exploration'
      ? '#348257'
      : '#9560b7'
</script>

<template>
  <div class="board-view">
    <div
      ref="grid"
      class="board-grid"
      role="group"
      aria-label="Schachbrett"
      :aria-disabled="locked"
      @pointermove="pointerMove"
      @pointerup="pointerUp"
      @pointercancel="pointerCancel"
      @lostpointercapture="pointerCancel"
    >
      <button
        v-for="(square, index) in squares"
        :key="square"
        type="button"
        class="square"
        :class="{
          dark: (Math.floor(index / 8) + (index % 8)) % 2 === 1,
          selected: selected === square,
          target: targets.has(square),
          queued: queuedSquares.has(square),
        }"
        :data-testid="`square-${square}`"
        :data-piece="pieces.get(square)?.type ?? ''"
        :aria-label="label(square)"
        :aria-pressed="selected === square"
        :disabled="locked"
        @click="choose(square, $event)"
        @pointerdown="pointerDown($event, square)"
      >
        <img
          v-if="pieces.get(square)"
          class="piece"
          :class="{
            'drag-origin': gesture?.dragging && gesture.from === square,
          }"
          :src="pieceImage(pieces.get(square)!)"
          alt=""
          :draggable="false"
          aria-hidden="true"
        />
        <span v-if="index % 8 === 0" class="rank" aria-hidden="true">{{
          square[1]
        }}</span>
        <span v-if="index >= 56" class="file" aria-hidden="true">{{
          square[0]
        }}</span>
        <span
          v-if="queueOrder(square)"
          class="queue-order"
          aria-hidden="true"
          >{{ queueOrder(square) }}</span
        >
      </button>
      <svg class="arrows" viewBox="0 0 8 8" aria-hidden="true">
        <g
          v-for="(arrow, index) in snapshot.arrows"
          :key="index"
          :data-purpose="arrow.purpose"
          :stroke="arrowColor(arrow.purpose)"
          :fill="arrowColor(arrow.purpose)"
        >
          <path
            :d="arrowShape(arrow.from, arrow.to).path"
            :transform="arrowShape(arrow.from, arrow.to).transform"
            stroke="none"
          />
        </g>
      </svg>
      <img
        v-if="draggedPiece"
        class="drag-ghost"
        :src="pieceImage(draggedPiece)"
        :style="ghostStyle"
        alt=""
        :draggable="false"
        aria-hidden="true"
      />
    </div>
    <div
      v-if="promotion"
      class="promotion"
      role="group"
      aria-label="Bauernumwandlung"
    >
      <strong>In welche Figur umwandeln?</strong>
      <div class="promotion-options">
        <button
          v-for="option in promotions"
          :key="option.type"
          type="button"
          :aria-label="`Umwandeln in ${option.label}`"
          @click="promote(option.type)"
        >
          <img
            :src="pieceImage({ type: option.type, side: snapshot.playerSide })"
            alt=""
            :draggable="false"
          />
          {{ option.label }}
        </button>
      </div>
      <button type="button" @click="promotion = null">Abbrechen</button>
    </div>
    <p class="board-caption" aria-live="polite">
      {{
        promotion
          ? 'Wähle eine Figur für die Umwandlung.'
          : locked
            ? 'Brett gesperrt'
            : selected
              ? `${selected} ausgewählt — Zielfeld wählen`
              : snapshot.turn !== snapshot.playerSide
                ? 'Du kannst einen Vorzug vormerken.'
                : 'Figur und Zielfeld antippen oder ziehen.'
      }}
    </p>
  </div>
</template>

<style scoped>
.board-view {
  width: 100%;
  max-width: 520px;
  margin-inline: auto;
  color: #e5edf4;
  font-family: system-ui, sans-serif;
}
.board-grid {
  position: relative;
  display: grid;
  grid-template-columns: repeat(8, minmax(0, 1fr));
  aspect-ratio: 1;
  border-radius: 12px;
  overflow: hidden;
  box-shadow:
    0 4px 0 #8a6548,
    0 12px 24px #563e281a;
}
.square {
  position: relative;
  display: grid;
  place-items: center;
  padding: 0;
  min-width: 0;
  aspect-ratio: 1;
  border: 0;
  border-radius: 0;
  background: #f0d9b5;
  color: #24353b;
  touch-action: none;
  cursor: pointer;
}
.square.dark {
  background: #b58863;
}
.square.dark .rank,
.square.dark .file {
  color: #fff2db;
}
.square:disabled {
  opacity: 1;
  cursor: default;
}
.square.selected {
  background: #edc967;
}
.square.queued {
  box-shadow: inset 0 0 0 4px #64b6fa;
}
.queue-order {
  position: absolute;
  top: 3px;
  right: 3px;
  z-index: 3;
  display: grid;
  place-items: center;
  width: 15px;
  height: 15px;
  border-radius: 50%;
  background: #26668e;
  color: white;
  font:
    700 10px/1 system-ui,
    sans-serif;
  pointer-events: none;
}
.square:focus-visible {
  outline: 3px solid #21344d;
  outline-offset: -3px;
  z-index: 1;
}
.square.target::after {
  content: '';
  position: absolute;
  width: 22%;
  height: 22%;
  border-radius: 50%;
  background: #13372b66;
  pointer-events: none;
}
.piece {
  width: 94%;
  height: 94%;
  user-select: none;
  pointer-events: none;
  z-index: 1;
}
.drag-origin {
  opacity: 0;
}
.drag-ghost {
  position: absolute;
  aspect-ratio: 1;
  transform: translate(-50%, -50%);
  pointer-events: none;
  z-index: 5;
  filter: drop-shadow(0 5px 3px #0005);
}
.rank,
.file {
  position: absolute;
  font-size: clamp(9px, 2vw, 12px);
  font-weight: 700;
  pointer-events: none;
}
.rank {
  top: 2px;
  left: 3px;
}
.file {
  bottom: 1px;
  right: 3px;
}
.arrows {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  opacity: 0.88;
  z-index: 2;
}
.board-caption {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}
.promotion {
  position: absolute;
  inset: 20% 5% auto;
  z-index: 6;
  padding: 12px;
  background: #203e48;
  border: 1px solid #a5c5cd;
  border-radius: 8px;
  margin-top: 8px;
}
.board-view {
  position: relative;
}
.promotion-options img {
  width: 32px;
  height: 32px;
  vertical-align: middle;
}
.promotion-options {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px;
  margin-block: 8px;
}
.promotion button {
  font: inherit;
  min-height: 44px;
  background: #f1e5d3;
  color: #173038;
  border: 0;
  border-radius: 6px;
  padding: 8px;
  cursor: pointer;
}
</style>
