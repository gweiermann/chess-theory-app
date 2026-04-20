<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import { TheChessboard, type BoardApi } from 'vue3-chessboard'
import 'vue3-chessboard/style.css'
import { Chess, type Move, type Square } from 'chess.js'
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
}>()

const apiRef = ref<BoardApi | null>(null)
const pendingTimeouts = new Set<ReturnType<typeof setTimeout>>()
let suppressEmitForSan: string | null = null

const boardConfig = {
  orientation: props.orientation,
  movable: { color: props.playerColor },
  animation: { enabled: true, duration: 200 },
}

const handleBoardCreated = (api: BoardApi): void => {
  apiRef.value = api
  emit('ready', api)
}

const handleMove = (move: Move): void => {
  if (suppressEmitForSan && suppressEmitForSan === move.san) {
    suppressEmitForSan = null
    return
  }
  emit('user-move', move.san, move)
}

const playOpponentSan = (san: string): boolean => {
  const api = apiRef.value
  if (!api) return false
  suppressEmitForSan = san
  const ok = api.move(san)
  if (!ok) suppressEmitForSan = null
  return ok
}

const reset = (): void => {
  apiRef.value?.resetBoard()
}

const setPlayerColor = (color: Side): void => {
  apiRef.value?.setConfig({ movable: { color } })
}

const undoLastMove = (): void => {
  apiRef.value?.undoLastMove()
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

const drawHintForSan = (san: string): boolean => {
  const api = apiRef.value
  if (!api) return false
  const squares = resolveSanToSquares(api.getFen(), san)
  if (!squares) return false
  api.drawMove(squares.from, squares.to, 'paleBlue')
  return true
}

const clearHints = (): void => {
  apiRef.value?.setShapes([])
}

defineExpose({
  playOpponentSan,
  reset,
  setPlayerColor,
  undoLastMove,
  drawHintForSan,
  clearHints,
})

watch(
  () => props.orientation,
  (next) => {
    apiRef.value?.setConfig({ orientation: next })
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
  </div>
</template>

<style scoped>
.chessboard-shell {
  width: 100%;
  max-width: 560px;
  aspect-ratio: 1 / 1;
  margin-inline: auto;
}

.chessboard-shell :deep(.main-board) {
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 12px 30px -12px rgba(0, 0, 0, 0.4);
}
</style>
