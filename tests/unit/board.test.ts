import { describe, expect, it, vi } from 'vitest'
import { createBoard } from '../../app/modules/board'

describe('Board session', () => {
  it('proposes without committing and accepts exactly once', () => {
    const board = createBoard()
    board.configureInput({ input: 'player' })
    const before = board.snapshot()
    const result = board.proposeMove('e4')
    expect(result.status).toBe('proposed')
    expect(board.snapshot().fen).toBe(before.fen)
    if (result.status !== 'proposed') throw new Error('Expected proposal')
    expect(board.acceptMove(result.attempt.id)).toEqual({
      status: 'accepted',
      san: 'e4',
    })
    expect(board.snapshot().moves).toEqual(['e4'])
    expect(board.acceptMove(result.attempt.id).status).toBe('stale')
  })
})

it('rejects attempts without undoing accepted moves and invalidates older proposals', () => {
  const board = createBoard()
  board.configureInput({ input: 'player' })
  const attempt = board.proposeMove('d4')
  if (attempt.status !== 'proposed') throw new Error('Expected proposal')
  expect(board.rejectMove(attempt.attempt.id).status).toBe('rejected')
  expect(board.snapshot().moves).toEqual([])
  const next = board.proposeMove('e4')
  if (next.status !== 'proposed') throw new Error('Expected proposal')
  board.makeMove('d4')
  expect(board.acceptMove(next.attempt.id).status).toBe('stale')
  expect(board.makeMove('e5', 0).status).toBe('stale')
})

it('restores castling history with monotonic revisions and invalidates checkpoints on load', () => {
  const board = createBoard()
  board.load({ moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Nf6', 'O-O'] })
  const checkpoint = board.saveCheckpoint()
  const fen = board.snapshot().fen
  board.makeMove('Bc5')
  const revision = board.snapshot().revision
  expect(board.resetToCheckpoint(checkpoint).status).toBe('accepted')
  expect(board.snapshot().fen).toBe(fen)
  expect(board.snapshot().moves.at(-1)).toBe('O-O')
  expect(board.snapshot().revision).toBeGreaterThan(revision)
  board.load({ moves: [] })
  expect(board.resetToCheckpoint(checkpoint).status).toBe('stale')
})

it('uses the configured initial FEN for promotion, en passant, and history', () => {
  const board = createBoard()
  expect(
    board.load({ initialFen: '7k/P7/8/8/8/8/8/7K w - - 0 1', moves: [] })
      .status,
  ).toBe('accepted')
  expect(board.makeMove({ from: 'a7', to: 'a8', promotion: 'n' }).san).toBe(
    'a8=N',
  )
  board.viewHistory(0)
  expect(
    board.snapshot().pieces.find((piece) => piece.square === 'a7')?.type,
  ).toBe('p')
  board.configureInput({ input: 'player' })
  expect(board.proposeMove('Kh2').status).toBe('disabled')
  board.viewHistory(null)
  expect(
    board.snapshot().pieces.find((piece) => piece.square === 'a8')?.type,
  ).toBe('n')
  board.load({ moves: ['e4', 'a6', 'e5', 'd5'] })
  expect(board.makeMove('exd6').status).toBe('accepted')
  expect(board.snapshot().pieces.some((piece) => piece.square === 'd5')).toBe(
    false,
  )
})

it('buffers coordinate premoves and validates them after opponent replies', () => {
  const board = createBoard()
  board.configureInput({ input: 'premove', playerSide: 'white' })
  board.makeMove('e4')
  expect(board.proposeMove({ from: 'g1', to: 'f3' }).status).toBe('queued')
  expect(board.takePremove()).toBeNull()
  board.makeMove('e5')
  expect(board.takePremove()).toEqual({ from: 'g1', to: 'f3' })
  board.makeMove('Nf3')
  expect(board.proposeMove({ from: 'a1', to: 'a8' }).status).toBe('queued')
  board.makeMove('Nc6')
  expect(board.takePremove()).toBeNull()
  const checkpoint = board.saveCheckpoint()
  board.makeMove('Bc4')
  board.proposeMove({ from: 'b1', to: 'c3' })
  board.resetToCheckpoint(checkpoint)
  expect(board.snapshot().premove).toBeNull()
})

it('does not expose mutable state and rejects invalid loads atomically', () => {
  const board = createBoard()
  board.showArrows([{ from: 'e2', to: 'e4', purpose: 'solution' }])
  const snapshot = board.snapshot()
  ;(snapshot.moves as string[]).push('e4')
  snapshot.arrows[0]!.from = 'a1'
  snapshot.pieces[0]!.type = 'q'
  expect(board.snapshot().moves).toEqual([])
  expect(board.snapshot().arrows[0]?.from).toBe('e2')
  expect(board.snapshot().pieces[0]?.type).toBe('r')
  const fen = board.snapshot().fen
  expect(board.load({ moves: ['e4', 'garbage'] }).status).toBe('illegal')
  expect(board.snapshot().fen).toBe(fen)
  expect(board.makeMove('garbage').status).toBe('illegal')
  expect(board.viewHistory(-1).status).toBe('illegal')
})

it('clears arrows after moves and cancels commands and listeners after disposal', () => {
  const board = createBoard()
  let notifications = 0
  board.subscribe(() => {
    notifications++
  })
  board.showArrows([{ from: 'z2', to: 'e4', purpose: 'solution' }])
  expect(board.snapshot().arrows).toEqual([])
  board.showArrows([{ from: 'e2', to: 'e4', purpose: 'exploration' }])
  board.makeMove('e4')
  expect(board.snapshot().arrows).toEqual([])
  const before = notifications
  board.dispose()
  expect(board.makeMove('e5').status).toBe('cancelled')
  board.configureInput({ input: 'player' })
  expect(board.proposeMove('e5').status).toBe('disabled')
  expect(notifications).toBe(before)
})

it('works on insecure LAN origins without the Web Crypto API', () => {
  vi.stubGlobal('crypto', undefined)
  try {
    const board = createBoard()
    const other = createBoard()
    const checkpoint = board.saveCheckpoint()
    expect(other.resetToCheckpoint(checkpoint).status).toBe('stale')
    board.makeMove('e4')
    expect(board.resetToCheckpoint(checkpoint).status).toBe('accepted')
    board.load({ moves: ['d4'] })
    expect(board.resetToCheckpoint(checkpoint).status).toBe('stale')
  } finally {
    vi.unstubAllGlobals()
  }
})

it('queues two premoves in order and consumes one per opponent reply', () => {
  const board = createBoard()
  board.configureInput({ input: 'premove' })
  board.makeMove('e4')
  expect(board.proposeMove({ from: 'g1', to: 'f3' }).status).toBe('queued')
  expect(board.proposeMove({ from: 'f1', to: 'c4' }).status).toBe('queued')
  expect(board.snapshot().premoveQueue).toEqual([
    { from: 'g1', to: 'f3' },
    { from: 'f1', to: 'c4' },
  ])
  board.makeMove('e5')
  const first = board.takePremove()!
  expect(first).toEqual({ from: 'g1', to: 'f3' })
  const attempt = board.proposeMove(first)
  if (attempt.status !== 'proposed') throw new Error('Expected proposal')
  board.acceptMove(attempt.attempt.id, { preservePremoves: true })
  expect(board.snapshot().premoveQueue).toEqual([{ from: 'f1', to: 'c4' }])
  expect(board.snapshot().lastPremove).toEqual({
    from: 'g1',
    to: 'f3',
    revision: board.snapshot().revision,
  })
  board.makeMove('Nc6')
  expect(board.takePremove()).toEqual({ from: 'f1', to: 'c4' })
  expect(board.takePremove()).toBeNull()
})

it('cannot drain multiple premoves during the same learner turn', () => {
  const board = createBoard()
  board.configureInput({ input: 'premove' })
  board.makeMove('e4')
  board.proposeMove({ from: 'g1', to: 'f3' })
  board.proposeMove({ from: 'f1', to: 'c4' })
  board.makeMove('e5')
  expect(board.takePremove()).toEqual({ from: 'g1', to: 'f3' })
  expect(board.takePremove()).toBeNull()
  expect(board.snapshot().premoveQueue).toEqual([{ from: 'f1', to: 'c4' }])
})

it('an illegal head cancels its dependent queue rather than trying later responses', () => {
  const board = createBoard()
  board.configureInput({ input: 'premove' })
  board.makeMove('e4')
  board.proposeMove({ from: 'a1', to: 'a8' })
  board.proposeMove({ from: 'f1', to: 'c4' })
  board.makeMove('e5')
  expect(board.takePremove()).toBeNull()
  expect(board.snapshot().premoveQueue).toEqual([])
  expect(board.snapshot().premove).toBeNull()
})

it('manual acceptance invalidates the queued continuation but its returned snapshot cannot mutate the queue', () => {
  const board = createBoard()
  board.configureInput({ input: 'premove' })
  board.makeMove('e4')
  board.proposeMove({ from: 'g1', to: 'f3' })
  board.proposeMove({ from: 'f1', to: 'c4' })
  const snapshot = board.snapshot()
  snapshot.premoveQueue[0]!.from = 'a1'
  expect(board.snapshot().premoveQueue[0]?.from).toBe('g1')
  board.makeMove('e5')
  const attempt = board.proposeMove('Nc3')
  if (attempt.status !== 'proposed') throw new Error('Expected proposal')
  board.acceptMove(attempt.attempt.id)
  expect(board.snapshot().premoveQueue).toEqual([])
  expect(board.snapshot().lastPremove).toBeNull()
})

it('checkpoint, history, and disposal clear the entire queue', () => {
  const board = createBoard()
  board.configureInput({ input: 'premove' })
  board.makeMove('e4')
  const checkpoint = board.saveCheckpoint()
  const enqueue = () => {
    board.proposeMove({ from: 'g1', to: 'f3' })
    board.proposeMove({ from: 'f1', to: 'c4' })
    expect(board.snapshot().premoveQueue).toHaveLength(2)
  }
  enqueue()
  board.resetToCheckpoint(checkpoint)
  expect(board.snapshot().premoveQueue).toEqual([])
  enqueue()
  board.viewHistory(0)
  expect(board.snapshot().premoveQueue).toEqual([])
  board.viewHistory(null)
  enqueue()
  board.dispose()
  expect(board.snapshot().premoveQueue).toEqual([])
})
