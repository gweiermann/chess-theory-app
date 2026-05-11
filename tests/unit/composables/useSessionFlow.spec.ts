import { describe, expect, it, vi } from 'vitest'
import { computed, ref, shallowRef } from 'vue'
import { useSessionFlow } from '~/composables/useSessionFlow'
import type { TrainingSession } from '~/composables/training-session'
import type { Line } from '~/domain/types'

const buildLine = (sanMoves: string[], userSide: 'white' | 'black' = 'white'): Line => ({
  id: 'l',
  eco: 'C00',
  fullName: 'Test Line',
  pgn: '',
  sanMoves,
  userSide,
})

const buildBoardStub = () => {
  const setLocked = vi.fn()
  const drawHintForSan = vi.fn(() => true)
  const clearHints = vi.fn()
  const playOpponentSan = vi.fn(() => true)
  const reset = vi.fn()
  const setAnimationEnabled = vi.fn()
  const board = shallowRef({
    setLocked,
    drawHintForSan,
    clearHints,
    playOpponentSan,
    reset,
    setAnimationEnabled,
  } as unknown as InstanceType<typeof import('~/components/ChessBoard.vue')['default']>)
  return { board, setLocked, drawHintForSan, clearHints, playOpponentSan, reset, setAnimationEnabled }
}

const buildSession = (overrides: Partial<{
  expectedMoveIndex: number
  expectedSan: string | null
  phase: 'intro' | 'building' | 'repeating' | 'done'
  currentStep: number
  prefixPlies: number
  totalSteps: number
  repsDone: number
  lineSanMoves: string[]
  userSide: 'white' | 'black'
}> = {}): TrainingSession => ({
  state: ref({
    line: buildLine(
      overrides.lineSanMoves ?? ['e4', 'e5', 'Nf3'],
      overrides.userSide ?? 'white',
    ),
    phase: overrides.phase ?? 'building',
    currentStep: overrides.currentStep ?? 1,
    expectedMoveIndex: overrides.expectedMoveIndex ?? 0,
    repsDone: overrides.repsDone ?? 0,
    expectedSan: 'expectedSan' in overrides ? overrides.expectedSan! : 'e4',
    totalSteps: overrides.totalSteps ?? 3,
    prefixPlies: overrides.prefixPlies ?? 0,
  }) as unknown as TrainingSession['state'],
  lastFeedback: ref(null),
  submit: vi.fn().mockResolvedValue({ result: 'correct' }),
  reset: vi.fn(),
})

describe('useSessionFlow', () => {
  it('setBoardLocked mutates the shared flowLocked and combines with isReplayMode', () => {
    const { board, setLocked } = buildBoardStub()
    const isReplayMode = ref(false)
    const flowLocked = ref(false)
    const flow = useSessionFlow({
      session: shallowRef(buildSession()),
      currentLine: ref(buildLine(['e4'])),
      demonstratedSteps: ref(new Set()),
      board,
      flowLocked,
      isReplayMode: computed(() => isReplayMode.value),
      resetReplayView: () => {},
    })
    flow.setBoardLocked(true)
    expect(flowLocked.value).toBe(true)
    expect(setLocked).toHaveBeenLastCalledWith(true)
    flow.setBoardLocked(false)
    expect(flowLocked.value).toBe(false)
    expect(setLocked).toHaveBeenLastCalledWith(false)
    isReplayMode.value = true
    flow.setBoardLocked(false)
    expect(setLocked).toHaveBeenLastCalledWith(true)
  })

  it('showHintForExpected draws a hint arrow and tracks hintActive', () => {
    const { board, drawHintForSan } = buildBoardStub()
    const flow = useSessionFlow({
      session: shallowRef(buildSession({ expectedSan: 'Bc4' })),
      currentLine: ref(buildLine(['e4'])),
      demonstratedSteps: ref(new Set()),
      board,
      flowLocked: ref(false),
      isReplayMode: computed(() => false),
      resetReplayView: () => {},
    })
    expect(flow.showHintForExpected()).toBe(true)
    expect(drawHintForSan).toHaveBeenCalledWith('Bc4')
    expect(flow.hintActive.value).toBe(true)
  })

  it('showHintForExpected returns false when no expected SAN', () => {
    const { board, drawHintForSan } = buildBoardStub()
    const flow = useSessionFlow({
      session: shallowRef(buildSession({ expectedSan: null })),
      currentLine: ref(buildLine(['e4'])),
      demonstratedSteps: ref(new Set()),
      board,
      flowLocked: ref(false),
      isReplayMode: computed(() => false),
      resetReplayView: () => {},
    })
    expect(flow.showHintForExpected()).toBe(false)
    expect(drawHintForSan).not.toHaveBeenCalled()
    expect(flow.hintActive.value).toBe(false)
  })

  it('showHintForExpected does not draw on opponent plies (would show opponent reply)', () => {
    const { board, drawHintForSan } = buildBoardStub()
    const line = buildLine(['e4', 'e5', 'Nf3'], 'white')
    const flow = useSessionFlow({
      session: shallowRef(buildSession({
        expectedMoveIndex: 1,
        expectedSan: 'e5',
        phase: 'building',
      })),
      currentLine: ref(line),
      demonstratedSteps: ref(new Set()),
      board,
      flowLocked: ref(false),
      isReplayMode: computed(() => false),
      resetReplayView: () => {},
    })
    expect(flow.showHintForExpected()).toBe(false)
    expect(drawHintForSan).not.toHaveBeenCalled()
    expect(flow.hintActive.value).toBe(false)
  })

  it('clearHintArrow only calls the board when a hint is currently shown', () => {
    const { board, clearHints } = buildBoardStub()
    const flow = useSessionFlow({
      session: shallowRef(buildSession()),
      currentLine: ref(buildLine(['e4'])),
      demonstratedSteps: ref(new Set()),
      board,
      flowLocked: ref(false),
      isReplayMode: computed(() => false),
      resetReplayView: () => {},
    })
    flow.clearHintArrow()
    expect(clearHints).not.toHaveBeenCalled()
    flow.showHintForExpected()
    flow.clearHintArrow()
    expect(clearHints).toHaveBeenCalledTimes(1)
    expect(flow.hintActive.value).toBe(false)
  })

  it('buffers user moves and flushes them on demand', () => {
    const { board } = buildBoardStub()
    const flow = useSessionFlow({
      session: shallowRef(buildSession()),
      currentLine: ref(buildLine(['e4'])),
      demonstratedSteps: ref(new Set()),
      board,
      flowLocked: ref(false),
      isReplayMode: computed(() => false),
      resetReplayView: () => {},
    })
    expect(flow.flushBufferedUserMove()).toBeNull()
    flow.bufferUserMove('Bc4')
    expect(flow.flushBufferedUserMove()).toBe('Bc4')
    // Subsequent flush returns null until a new move is buffered.
    expect(flow.flushBufferedUserMove()).toBeNull()
  })

  it('replayPrefixOntoBoard plays the configured prefix plies', async () => {
    const { board, playOpponentSan } = buildBoardStub()
    const flow = useSessionFlow({
      session: shallowRef(buildSession({ prefixPlies: 2 })),
      currentLine: ref(buildLine(['e4', 'e5', 'Nf3'])),
      demonstratedSteps: ref(new Set()),
      board,
      flowLocked: ref(false),
      isReplayMode: computed(() => false),
      resetReplayView: () => {},
    })
    flow.replayPrefixOntoBoard()
    expect(playOpponentSan).toHaveBeenCalledTimes(2)
    expect(playOpponentSan).toHaveBeenNthCalledWith(1, 'e4')
    expect(playOpponentSan).toHaveBeenNthCalledWith(2, 'e5')
  })

  it('replayPrefixOntoBoard is a no-op when prefixPlies is 0', async () => {
    const { board, playOpponentSan } = buildBoardStub()
    const flow = useSessionFlow({
      session: shallowRef(buildSession({ prefixPlies: 0 })),
      currentLine: ref(buildLine(['e4'])),
      demonstratedSteps: ref(new Set()),
      board,
      flowLocked: ref(false),
      isReplayMode: computed(() => false),
      resetReplayView: () => {},
    })
    flow.replayPrefixOntoBoard()
    expect(playOpponentSan).not.toHaveBeenCalled()
  })

  it('isOpponentInFlight is false at rest', () => {
    const { board } = buildBoardStub()
    const flow = useSessionFlow({
      session: shallowRef(buildSession()),
      currentLine: ref(buildLine(['e4'])),
      demonstratedSteps: ref(new Set()),
      board,
      flowLocked: ref(false),
      isReplayMode: computed(() => false),
      resetReplayView: () => {},
    })
    expect(flow.isOpponentInFlight()).toBe(false)
  })
})
