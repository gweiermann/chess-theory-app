<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import { TheChessboard, type BoardApi, type DrawShape } from 'vue3-chessboard'
import 'vue3-chessboard/style.css'
import { Chess, type Move, type Square } from 'chess.js'
import { BOARD_MOVE_ANIMATION_DURATION_MS } from '~/domain/board-animation'
import type { Side } from '~/domain/types'

interface Props {
  orientation?: Side
  playerColor?: Side
  autoOpponentDelayMs?: number
}

const props = withDefaults(defineProps<Props>(), {
  orientation: 'white',
  playerColor: 'white',
  autoOpponentDelayMs: 350,
})

const emit = defineEmits<{
  (e: 'user-move', san: string, move: Move): void
  (e: 'ready', api: BoardApi): void
  (e: 'board-interaction'): void
}>()

const apiRef = ref<BoardApi | null>(null)
const pendingTimeouts = new Set<ReturnType<typeof setTimeout>>()
let suppressEmitForSan: string | null = null

/** Dev/e2e seam: mirror the live board FEN so tests can assert board↔session sync. */
const showDevFen = import.meta.dev || import.meta.env.VITE_E2E === '1'
const devFen = ref('')
const syncDevFen = (): void => {
  if (!showDevFen) return
  devFen.value = apiRef.value?.getFen() ?? ''
}

/*
 * vue3-chessboard captures the boardConfig OBJECT REFERENCE at mount time
 * and re-applies it on every `resetBoard()` (see BoardApi#resetBoard). If
 * we froze the orientation at setup we would be stuck with the very first
 * line's orientation – every board reset would flip the board back to
 * white even when we're now drilling a defense. We therefore keep this
 * object's fields live: the watchers below mutate it in place whenever
 * the props change. Chessground then picks up the latest orientation /
 * playerColor on the next reset.
 */
const emitBoardInteraction = (): void => {
  emit('board-interaction')
}

const boardConfig = {
  orientation: props.orientation,
  movable: { color: props.playerColor as Side | undefined },
  /** Chessground animates when duration >= ~70ms. */
  animation: { enabled: true, duration: BOARD_MOVE_ANIMATION_DURATION_MS },
  coordinates: true,
  events: {
    /** Piece/square taps: chessground often clears drawable shapes before we hear about moves. */
    select: () => {
      emitBoardInteraction()
    },
  },
  drawable: {
    onChange: (shapes: DrawShape[]) => {
      if (shapes.length === 0) emitBoardInteraction()
    },
  },
}

const handleBoardCreated = (api: BoardApi): void => {
  apiRef.value = api
  emit('ready', api)
  syncDevFen()
}

const handleMove = (move: Move): void => {
  if (suppressEmitForSan && suppressEmitForSan === move.san) {
    suppressEmitForSan = null
    return
  }
  emit('user-move', move.san, move)
  syncDevFen()
}

const playOpponentSan = (san: string): boolean => {
  const api = apiRef.value
  if (!api) return false
  suppressEmitForSan = san
  const ok = api.move(san)
  if (!ok) suppressEmitForSan = null
  syncDevFen()
  return ok
}

/**
 * Toggle smooth piece motion for programmatic moves. Keep enabled for live
 * opponent replies; disable during replay prev/next and when replaying many
 * plies at once so the board snaps instantly.
 */
const setMoveAnimationEnabled = (enabled: boolean): void => {
  boardConfig.animation = {
    enabled,
    duration: enabled ? BOARD_MOVE_ANIMATION_DURATION_MS : 0,
  }
  apiRef.value?.setConfig({
    animation: {
      enabled,
      duration: enabled ? BOARD_MOVE_ANIMATION_DURATION_MS : 0,
    },
  })
}

const reset = (): void => {
  apiRef.value?.resetBoard()
}

/**
 * Full position load (chess.js + Chessground).
 *
 * Returns whether the board changed. Callers that must repair a stale board
 * before an animated reply can request a snap, yield a frame, then animate
 * only the reply.
 */
const setPositionFromFen = (fen: string, animate = true): boolean => {
  const api = apiRef.value
  if (!api || api.getFen() === fen) return false
  if (!animate) setMoveAnimationEnabled(false)
  api.setPosition(fen)
  syncDevFen()
  return true
}

const setPlayerColor = (color: Side): void => {
  apiRef.value?.setConfig({ movable: { color } })
}

/**
 * Fully lock or unlock the board's movable state. Locking sets the movable
 * color to `undefined` in chessground which disables ALL drag/click
 * interactions, including moves for the current side. Used to freeze the
 * board during the ~600ms pre-reset delay and during opponent replies so
 * the user can't snag a piece they're not supposed to touch, get confused
 * when it snaps back, or accidentally submit a move that would then race
 * against the scheduled reset.
 */
const setLocked = (locked: boolean): void => {
  const api = apiRef.value
  if (!api) return
  if (locked) {
    api.setConfig({ movable: { color: undefined } })
  } else {
    api.setConfig({ movable: { color: props.playerColor } })
  }
}

const undoLastMove = (): void => {
  apiRef.value?.undoLastMove()
  syncDevFen()
}

const resolveSanToSquares = (
  fen: string,
  san: string,
): { from: Square; to: Square } | null => {
  try {
    const chess = new Chess(fen)
    const move = chess.move(san)
    if (!move) return null
    return { from: move.from as Square, to: move.to as Square }
  } catch {
    return null
  }
}

const refreshBounds = (): void => {
  // Chessground memoises the board's DOMRect and only invalidates that cache
  // on its own ResizeObserver (cg-wrap size), document `scroll` and window
  // `resize`. When a sibling above the board appears or disappears, the
  // board's viewport POSITION shifts without its SIZE changing, so chessground
  // keeps hit-testing clicks against the old rect. Synthesising a `scroll`
  // event on `document` triggers chessground's own invalidation path (see
  // chessground/dist/events.js) without reaching into library internals or
  // side-effecting anything else in this app (we have no custom
  // document-level scroll listeners).
  if (typeof document === 'undefined') return
  document.dispatchEvent(new Event('scroll'))
}

const drawHintForSan = (san: string): boolean => {
  const api = apiRef.value
  if (!api) return false
  const squares = resolveSanToSquares(api.getFen(), san)
  if (!squares) return false
  // Chessground diffs rendered shapes by a hash; on the very first mount the
  // board's bounds are still settling, so a single setShapes([shape]) call
  // can update state without actually appending the arrow to the SVG. Clearing
  // first and scheduling the shape on the next frame guarantees the arrow
  // gets drawn both on initial mount and after opponent replies.
  api.setShapes([])
  const draw = () => {
    api.setShapes([{ orig: squares.from, dest: squares.to, brush: 'paleBlue' }])
    // Invalidate chessground's cached rect after drawing the hint arrow so
    // subsequent clicks hit the correct square.
    refreshBounds()
  }
  if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
    window.requestAnimationFrame(draw)
  } else {
    draw()
  }
  return true
}

const drawHintsForSans = (sans: readonly string[]): boolean => {
  const api = apiRef.value
  if (!api) return false
  const shapes: DrawShape[] = []
  for (const san of sans) {
    const squares = resolveSanToSquares(api.getFen(), san)
    if (squares) {
      shapes.push({ orig: squares.from, dest: squares.to, brush: 'paleBlue' })
    }
  }
  if (shapes.length === 0) return false
  // Same fresh-frame scheduling as drawHintForSan so arrows appear on mount.
  api.setShapes([])
  const draw = () => {
    api.setShapes(shapes)
    refreshBounds()
  }
  if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
    window.requestAnimationFrame(draw)
  } else {
    draw()
  }
  return true
}

const clearHints = (): void => {
  apiRef.value?.setShapes([])
  refreshBounds()
}

defineExpose({
  playOpponentSan,
  reset,
  setPositionFromFen,
  setPlayerColor,
  setLocked,
  setMoveAnimationEnabled,
  undoLastMove,
  drawHintForSan,
  drawHintsForSans,
  clearHints,
  refreshBounds,
})

watch(
  () => props.orientation,
  (next) => {
    boardConfig.orientation = next
    apiRef.value?.setConfig({ orientation: next })
  },
)

// When the current line switches (e.g. building-phase user is black), keep
// the movable side in sync with the prop. Without this the board would stay
// locked to whoever the first mounted line happened to be. We also mutate
// boardConfig.movable so that chessground's internal `resetBoard()` (which
// re-applies the stored boardConfig object) picks up the latest color.
watch(
  () => props.playerColor,
  (next) => {
    boardConfig.movable = { color: next }
    apiRef.value?.setConfig({ movable: { color: next } })
  },
)

onBeforeUnmount(() => {
  for (const id of pendingTimeouts) clearTimeout(id)
  pendingTimeouts.clear()
})
</script>

<template>
  <div class="chessboard-shell">
    <TheChessboard
      :board-config="boardConfig"
      :player-color="playerColor"
      @board-created="handleBoardCreated"
      @move="handleMove"
    />
    <span v-if="showDevFen" data-testid="dev-board-fen" class="hidden">{{ devFen }}</span>
  </div>
</template>

<style scoped>
.chessboard-shell {
  position: relative;
  width: 100%;
  max-width: 560px;
  aspect-ratio: 1 / 1;
  margin-inline: auto;
}

/*
 * vue3-chessboard ships with an internal landscape media query that forces
 *   .main-wrap { width: 90vh; max-width: 700px }
 * which on desktop viewports makes the board 700px wide and overflows our
 * grid column (the board then visually overlaps the "Wiederholung" side
 * card). We re-assert that the whole board tree stays inside our shell
 * regardless of the viewport orientation.
 */
.chessboard-shell :deep(.main-wrap) {
  width: 100%;
  max-width: 100%;
  margin-inline: 0;
}

.chessboard-shell :deep(.main-board) {
  width: 100%;
  overflow: hidden;
  box-shadow: 0 12px 30px -12px rgba(0, 0, 0, 0.4);
}

.chessboard-shell :deep(coords) {
  font-size: 10px;
  color: var(--ui-text-muted);
  font-family: inherit;
}
</style>
