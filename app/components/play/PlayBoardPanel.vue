<script setup lang="ts">
import { ref, watch } from 'vue'
import ChessBoard from '~/components/ChessBoard.vue'
import type { Side } from '~/domain/types'

interface Props {
  orientation: Side
  playerColor: Side
}

defineProps<Props>()

const emit = defineEmits<{
  (e: 'userMove', san: string): void
  (e: 'boardReady', board: InstanceType<typeof ChessBoard> | null): void
  (e: 'boardInteraction'): void
}>()

const board = ref<InstanceType<typeof ChessBoard> | null>(null)

// Forward the imperative board instance to the parent so `useSessionFlow` can
// drive locks, hints and opponent moves without reaching through this wrapper.
watch(board, (next) => emit('boardReady', next), { immediate: true })
</script>

<template>
  <div class="shrink-0">
    <ChessBoard
      ref="board"
      :orientation="orientation"
      :player-color="playerColor"
      @user-move="emit('userMove', $event)"
      @board-interaction="emit('boardInteraction')"
    />
  </div>
</template>
