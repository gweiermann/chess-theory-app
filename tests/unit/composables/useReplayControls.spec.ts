import { describe, expect, it, vi } from 'vitest'
import { ref, shallowRef } from 'vue'
import { useReplayControls } from '~/composables/useReplayControls'
import type { TrainingSession } from '~/composables/training-session'
import type { Line } from '~/domain/types'

const buildLine = (sanMoves: string[]): Line => ({
  id: 'l',
  eco: 'C00',
  fullName: 'Test Line',
  pgn: '',
  sanMoves,
  userSide: 'white',
})

const buildSession = (expectedMoveIndex: number): TrainingSession => ({
  state: ref({
    line: buildLine(['e4', 'e5', 'Nf3']),
    phase: 'building',
    currentStep: 1,
    expectedMoveIndex,
    repsDone: 0,
    expectedSan: null,
    totalSteps: 3,
    prefixPlies: 0,
  }) as unknown as TrainingSession['state'],
  lastFeedback: ref(null),
  submit: vi.fn(),
  reset: vi.fn(),
})

const buildBoardStub = () => {
  const undoLastMove = vi.fn()
  const playOpponentSan = vi.fn()
  const setLocked = vi.fn()
  const board = shallowRef({
    undoLastMove,
    playOpponentSan,
    setLocked,
  } as unknown as InstanceType<typeof import('~/components/ChessBoard.vue')['default']>)
  return { board, undoLastMove, playOpponentSan, setLocked }
}

describe('useReplayControls', () => {
  it('starts at the live ply with no replay mode', () => {
    const session = shallowRef(buildSession(2))
    const { board } = buildBoardStub()
    const { activeReplayPly, isReplayMode, canGoBackward, canGoForward, viewedPly } =
      useReplayControls({
        session,
        currentLine: ref(buildLine(['e4', 'e5', 'Nf3'])),
        board,
        flowLocked: ref(false),
      })
    expect(viewedPly.value).toBeNull()
    expect(activeReplayPly.value).toBe(2)
    expect(isReplayMode.value).toBe(false)
    expect(canGoBackward.value).toBe(true)
    expect(canGoForward.value).toBe(false)
  })

  it('stepping backward calls undoLastMove and updates viewedPly', async () => {
    const session = shallowRef(buildSession(3))
    const line = ref(buildLine(['e4', 'e5', 'Nf3']))
    const { board, undoLastMove, setLocked } = buildBoardStub()
    const flowLocked = ref(false)
    const { goMoveHistory, viewedPly, isReplayMode } = useReplayControls({
      session,
      currentLine: line,
      board,
      flowLocked,
    })
    await goMoveHistory(-1)
    expect(undoLastMove).toHaveBeenCalledTimes(1)
    expect(viewedPly.value).toBe(2)
    expect(isReplayMode.value).toBe(true)
    expect(setLocked).toHaveBeenLastCalledWith(true)
  })

  it('stepping forward replays the next SAN and clears viewedPly when caught up', async () => {
    const session = shallowRef(buildSession(3))
    const line = ref(buildLine(['e4', 'e5', 'Nf3']))
    const { board, playOpponentSan, undoLastMove } = buildBoardStub()
    const { goMoveHistory, viewedPly, isReplayMode } = useReplayControls({
      session,
      currentLine: line,
      board,
      flowLocked: ref(false),
    })
    await goMoveHistory(-1)
    await goMoveHistory(-1)
    expect(viewedPly.value).toBe(1)
    expect(undoLastMove).toHaveBeenCalledTimes(2)

    await goMoveHistory(1)
    expect(playOpponentSan).toHaveBeenCalledWith('e5')
    expect(viewedPly.value).toBe(2)

    await goMoveHistory(1)
    expect(viewedPly.value).toBeNull()
    expect(isReplayMode.value).toBe(false)
  })

  it('clamps stepping past the bounds', async () => {
    const session = shallowRef(buildSession(2))
    const line = ref(buildLine(['e4', 'e5', 'Nf3']))
    const { board, undoLastMove, playOpponentSan } = buildBoardStub()
    const { goMoveHistory, canGoBackward, canGoForward, viewedPly } = useReplayControls({
      session,
      currentLine: line,
      board,
      flowLocked: ref(false),
    })
    await goMoveHistory(1)
    expect(playOpponentSan).not.toHaveBeenCalled()
    expect(viewedPly.value).toBeNull()

    while (canGoBackward.value) await goMoveHistory(-1)
    expect(viewedPly.value).toBe(0)
    expect(canGoForward.value).toBe(true)

    await goMoveHistory(-1)
    expect(undoLastMove).toHaveBeenCalledTimes(2)
    expect(viewedPly.value).toBe(0)
  })

  it('resetView returns to live ply', async () => {
    const session = shallowRef(buildSession(3))
    const line = ref(buildLine(['e4', 'e5', 'Nf3']))
    const { board } = buildBoardStub()
    const { goMoveHistory, resetView, viewedPly } = useReplayControls({
      session,
      currentLine: line,
      board,
      flowLocked: ref(false),
    })
    await goMoveHistory(-1)
    expect(viewedPly.value).toBe(2)
    resetView()
    expect(viewedPly.value).toBeNull()
  })

  it('invokes onReplayNavigation when the viewed ply changes', async () => {
    const session = shallowRef(buildSession(3))
    const line = ref(buildLine(['e4', 'e5', 'Nf3']))
    const { board } = buildBoardStub()
    const onReplayNavigation = vi.fn()
    const { goMoveHistory } = useReplayControls({
      session,
      currentLine: line,
      board,
      flowLocked: ref(false),
      onReplayNavigation,
    })
    await goMoveHistory(-1)
    expect(onReplayNavigation).toHaveBeenCalledTimes(1)

    await goMoveHistory(-1)
    expect(onReplayNavigation).toHaveBeenCalledTimes(2)

    await goMoveHistory(1)
    expect(onReplayNavigation).toHaveBeenCalledTimes(3)
  })

  it('does not invoke onReplayNavigation when clamped at bounds', async () => {
    const session = shallowRef(buildSession(2))
    const line = ref(buildLine(['e4', 'e5', 'Nf3']))
    const { board } = buildBoardStub()
    const onReplayNavigation = vi.fn()
    const { goMoveHistory, viewedPly } = useReplayControls({
      session,
      currentLine: line,
      board,
      flowLocked: ref(false),
      onReplayNavigation,
    })
    await goMoveHistory(1)
    expect(onReplayNavigation).not.toHaveBeenCalled()
    expect(viewedPly.value).toBeNull()

    await goMoveHistory(-1)
    await goMoveHistory(-1)
    onReplayNavigation.mockClear()
    await goMoveHistory(-1)
    expect(onReplayNavigation).not.toHaveBeenCalled()
  })

  it('respects flowLocked when reapplying lock state', async () => {
    const session = shallowRef(buildSession(3))
    const line = ref(buildLine(['e4', 'e5', 'Nf3']))
    const { board, setLocked } = buildBoardStub()
    const { goMoveHistory } = useReplayControls({
      session,
      currentLine: line,
      board,
      flowLocked: ref(true),
    })
    await goMoveHistory(-1)
    expect(setLocked).toHaveBeenLastCalledWith(true)
  })
})
