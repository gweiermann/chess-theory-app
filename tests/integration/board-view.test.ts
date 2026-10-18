import { mount } from '@vue/test-utils'
import { expect, it } from 'vitest'
import BoardView from '../../app/components/board/BoardView.vue'
import { createBoard } from '../../app/modules/board'

it('emits a coordinate attempt without mutating accepted chess state', async () => {
  const board = createBoard()
  board.configureInput({ input: 'player' })
  const view = mount(BoardView, { props: { snapshot: board.snapshot() } })
  await view.get('[data-testid="square-e2"]').trigger('click')
  await view.get('[data-testid="square-e4"]').trigger('click')
  expect(view.emitted('move')).toEqual([[{ from: 'e2', to: 'e4' }]])
  expect(board.snapshot().moves).toEqual([])
})

it('blocks input when disabled or viewing history', async () => {
  const board = createBoard()
  board.configureInput({ input: 'player' })
  const view = mount(BoardView, {
    props: { snapshot: board.snapshot(), disabled: true },
  })
  await view.get('[data-testid="square-e2"]').trigger('click')
  await view.get('[data-testid="square-e4"]').trigger('click')
  expect(view.emitted('move')).toBeUndefined()
  board.makeMove('e4')
  board.viewHistory(0)
  await view.setProps({ snapshot: board.snapshot(), disabled: false })
  await view.get('[data-testid="square-e2"]').trigger('click')
  await view.get('[data-testid="square-e4"]').trigger('click')
  expect(view.emitted('move')).toBeUndefined()
})

it('rotates the board for Black and accepts black piece selection', async () => {
  const board = createBoard()
  board.configureInput({
    input: 'player',
    playerSide: 'black',
    orientation: 'black',
  })
  board.makeMove('e4')
  const view = mount(BoardView, { props: { snapshot: board.snapshot() } })
  expect(view.findAll('.square')[0]!.attributes('data-testid')).toBe(
    'square-h1',
  )
  await view.get('[data-testid="square-e7"]').trigger('click')
  await view.get('[data-testid="square-e5"]').trigger('click')
  expect(view.emitted('move')).toEqual([[{ from: 'e7', to: 'e5' }]])
})

it('requires an explicit promotion choice before emitting the move', async () => {
  const board = createBoard()
  board.configureInput({ input: 'player' })
  board.load({ initialFen: '7k/P7/8/8/8/8/8/7K w - - 0 1', moves: [] })
  const view = mount(BoardView, { props: { snapshot: board.snapshot() } })
  await view.get('[data-testid="square-a7"]').trigger('click')
  await view.get('[data-testid="square-a8"]').trigger('click')
  expect(view.emitted('move')).toBeUndefined()
  await view.get('[aria-label="Umwandeln in Springer"]').trigger('click')
  expect(view.emitted('move')).toEqual([
    [{ from: 'a7', to: 'a8', promotion: 'n' }],
  ])
})

it('allows a coordinate premove during the opponent turn and clears selection after reset', async () => {
  const board = createBoard()
  board.configureInput({ input: 'premove' })
  const checkpoint = board.saveCheckpoint()
  board.makeMove('e4')
  const view = mount(BoardView, { props: { snapshot: board.snapshot() } })
  await view.get('[data-testid="square-g1"]').trigger('click')
  await view.get('[data-testid="square-f3"]').trigger('click')
  expect(view.emitted('move')).toEqual([[{ from: 'g1', to: 'f3' }]])
  await view.get('[data-testid="square-b1"]').trigger('click')
  board.resetToCheckpoint(checkpoint)
  await view.setProps({ snapshot: board.snapshot() })
  await view.get('[data-testid="square-c3"]').trigger('click')
  expect(view.emitted('move')).toHaveLength(1)
})

it('touch dragging a piece emits its destination once without relying on native HTML dragging', async () => {
  const board = createBoard()
  board.configureInput({ input: 'player' })
  const view = mount(BoardView, { props: { snapshot: board.snapshot() } })
  const grid = view.get('.board-grid').element
  Object.defineProperty(grid, 'getBoundingClientRect', {
    value: () => ({ left: 0, top: 0, width: 400, height: 400 }),
  })
  const pawn = view.get('[data-testid="square-e2"]')
  await pawn.trigger('pointerdown', {
    pointerId: 7,
    pointerType: 'touch',
    isPrimary: true,
    clientX: 225,
    clientY: 325,
    button: 0,
  })
  await pawn.trigger('pointermove', {
    pointerId: 7,
    pointerType: 'touch',
    isPrimary: true,
    clientX: 225,
    clientY: 225,
  })
  await pawn.trigger('pointerup', {
    pointerId: 7,
    pointerType: 'touch',
    isPrimary: true,
    clientX: 225,
    clientY: 225,
  })
  expect(view.emitted('move')).toEqual([[{ from: 'e2', to: 'e4' }]])
  await view.get('[data-testid="square-e4"]').trigger('click', { detail: 1 })
  expect(view.emitted('move')).toHaveLength(1)
})

function pointer(x: number, y: number, pointerType = 'touch') {
  return {
    pointerId: 7,
    pointerType,
    isPrimary: true,
    clientX: x,
    clientY: y,
    button: 0,
  }
}
function renderedBoard(board: ReturnType<typeof createBoard>) {
  const view = mount(BoardView, { props: { snapshot: board.snapshot() } })
  Object.defineProperty(
    view.get('.board-grid').element,
    'getBoundingClientRect',
    { value: () => ({ left: 0, top: 0, width: 400, height: 400 }) },
  )
  return view
}

it('touch drag can queue a premove which the real board validates after the opponent reply', async () => {
  const board = createBoard()
  board.configureInput({ input: 'premove' })
  board.makeMove('e4')
  const view = renderedBoard(board)
  const knight = view.get('[data-testid="square-g1"]')
  await knight.trigger('pointerdown', pointer(325, 375))
  await knight.trigger('pointermove', pointer(275, 275))
  await knight.trigger('pointerup', pointer(275, 275))
  const move = view.emitted('move')?.[0]?.[0]
  expect(move).toEqual({ from: 'g1', to: 'f3' })
  expect(board.proposeMove(move as { from: string; to: string }).status).toBe(
    'queued',
  )
  board.makeMove('e5')
  expect(board.takePremove()).toEqual({ from: 'g1', to: 'f3' })
})

it('maps Black-oriented mouse drag and preserves click and keyboard input', async () => {
  const board = createBoard()
  board.configureInput({
    input: 'player',
    playerSide: 'black',
    orientation: 'black',
  })
  board.makeMove('e4')
  const view = renderedBoard(board)
  const pawn = view.get('[data-testid="square-e7"]')
  await pawn.trigger('pointerdown', pointer(175, 325, 'mouse'))
  await pawn.trigger('pointermove', pointer(175, 225, 'mouse'))
  await pawn.trigger('pointerup', pointer(175, 225, 'mouse'))
  expect(view.emitted('move')).toEqual([[{ from: 'e7', to: 'e5' }]])
  await pawn.trigger('click', { detail: 0 })
  await view.get('[data-testid="square-e6"]').trigger('click', { detail: 0 })
  expect(view.emitted('move')).toHaveLength(2)
})

it('does not submit a touch drag released outside the board or cancelled by the browser', async () => {
  const board = createBoard()
  board.configureInput({ input: 'player' })
  const view = renderedBoard(board)
  const pawn = view.get('[data-testid="square-e2"]')
  await pawn.trigger('pointerdown', pointer(225, 325))
  await pawn.trigger('pointermove', pointer(450, 225))
  await pawn.trigger('pointerup', pointer(450, 225))
  expect(view.emitted('move')).toBeUndefined()
  await pawn.trigger('pointerdown', pointer(225, 325))
  await pawn.trigger('pointermove', pointer(225, 225))
  await pawn.trigger('pointercancel', pointer(225, 225))
  await pawn.trigger('pointerup', pointer(225, 225))
  expect(view.emitted('move')).toBeUndefined()
  expect(view.find('.drag-ghost').exists()).toBe(false)
})

it('revision changes cancel an in-flight drag instead of moving in a different position', async () => {
  const board = createBoard()
  board.configureInput({ input: 'player' })
  const view = renderedBoard(board)
  const pawn = view.get('[data-testid="square-e2"]')
  await pawn.trigger('pointerdown', pointer(225, 325))
  await pawn.trigger('pointermove', pointer(225, 225))
  expect(view.find('.drag-ghost').exists()).toBe(true)
  board.load({ moves: [] })
  await view.setProps({ snapshot: board.snapshot() })
  await pawn.trigger('pointerup', pointer(225, 225))
  expect(view.emitted('move')).toBeUndefined()
  expect(view.find('.drag-ghost').exists()).toBe(false)
})

it('touch drag to the last rank opens the explicit promotion choice', async () => {
  const board = createBoard()
  board.configureInput({ input: 'player' })
  board.load({ initialFen: '7k/P7/8/8/8/8/8/7K w - - 0 1', moves: [] })
  const view = renderedBoard(board)
  const pawn = view.get('[data-testid="square-a7"]')
  await pawn.trigger('pointerdown', pointer(25, 75))
  await pawn.trigger('pointermove', pointer(25, 25))
  await pawn.trigger('pointerup', pointer(25, 25))
  expect(view.emitted('move')).toBeUndefined()
  await view.get('[aria-label="Umwandeln in Dame"]').trigger('click')
  expect(view.emitted('move')).toEqual([
    [{ from: 'a7', to: 'a8', promotion: 'q' }],
  ])
})

it('preserves a premove source tap when the opponent replies between the two taps', async () => {
  const board = createBoard()
  board.configureInput({ input: 'premove' })
  board.makeMove('e4')
  const view = renderedBoard(board)
  await view.get('[data-testid="square-g1"]').trigger('click')
  board.makeMove('e5')
  await view.setProps({ snapshot: board.snapshot() })
  await view.get('[data-testid="square-f3"]').trigger('click')
  expect(view.emitted('move')).toEqual([[{ from: 'g1', to: 'f3' }]])
})

it('finishes a touch gesture across one opponent reply without accepting a stale position', async () => {
  const board = createBoard()
  board.configureInput({ input: 'premove' })
  board.makeMove('e4')
  const view = renderedBoard(board)
  const knight = view.get('[data-testid="square-g1"]')
  await knight.trigger('pointerdown', pointer(325, 375))
  await knight.trigger('pointermove', pointer(275, 275))
  board.makeMove('e5')
  await view.setProps({ snapshot: board.snapshot() })
  await knight.trigger('pointerup', pointer(275, 275))
  expect(view.emitted('move')).toEqual([[{ from: 'g1', to: 'f3' }]])
  const proposed = board.proposeMove({ from: 'g1', to: 'f3' })
  expect(proposed.status).toBe('proposed')
  if (proposed.status === 'proposed')
    expect(proposed.attempt.revision).toBe(board.snapshot().revision)
})

it('a new game with the same opening position still cancels a pending premove tap', async () => {
  const board = createBoard()
  board.configureInput({ input: 'premove' })
  board.load({ moves: ['e4'] })
  const view = renderedBoard(board)
  await view.get('[data-testid="square-g1"]').trigger('click')
  board.load({ moves: ['e4', 'e5'] })
  await view.setProps({ snapshot: board.snapshot() })
  await view.get('[data-testid="square-f3"]').trigger('click')
  expect(view.emitted('move')).toBeUndefined()
})

it('checkpoint restoration cannot masquerade as an opponent reply even when history extends by one move', async () => {
  const board = createBoard()
  board.configureInput({ input: 'premove' })
  const initial = board.saveCheckpoint()
  board.makeMove('e4')
  const beforeReply = board.saveCheckpoint()
  board.makeMove('e5')
  const afterReply = board.saveCheckpoint()
  board.resetToCheckpoint(beforeReply)
  const view = renderedBoard(board)
  await view.get('[data-testid="square-g1"]').trigger('click')
  const gameId = board.snapshot().gameId
  board.resetToCheckpoint(afterReply)
  expect(board.snapshot().gameId).not.toBe(gameId)
  await view.setProps({ snapshot: board.snapshot() })
  await view.get('[data-testid="square-f3"]').trigger('click')
  expect(view.emitted('move')).toBeUndefined()
  expect(board.resetToCheckpoint(initial).status).toBe('accepted')
})

it('a source piece captured by the opponent cancels its pending coordinate intent', async () => {
  const board = createBoard()
  board.configureInput({ input: 'premove' })
  board.load({ initialFen: '4r2k/8/8/8/8/8/4P3/7K b - - 0 1', moves: [] })
  const view = renderedBoard(board)
  await view.get('[data-testid="square-e2"]').trigger('click')
  expect(board.makeMove('Rxe2').status).toBe('accepted')
  await view.setProps({ snapshot: board.snapshot() })
  await view.get('[data-testid="square-e4"]').trigger('click')
  expect(view.emitted('move')).toBeUndefined()
})

it('keeps the next source tap across a batched reply and automatic first premove', async () => {
  const board = createBoard()
  board.configureInput({ input: 'premove' })
  board.makeMove('e4')
  board.proposeMove({ from: 'g1', to: 'f3' })
  const view = renderedBoard(board)
  await view.get('[data-testid="square-f1"]').trigger('click')
  board.makeMove('e5')
  const first = board.takePremove()!
  const attempt = board.proposeMove(first)
  expect(attempt.status).toBe('proposed')
  if (attempt.status === 'proposed')
    board.acceptMove(attempt.attempt.id, { preservePremoves: true })
  // Vue publishes the reply and automatic response together, two revisions later.
  await view.setProps({ snapshot: board.snapshot() })
  await view.get('[data-testid="square-c4"]').trigger('click')
  expect(view.emitted('move')).toEqual([[{ from: 'f1', to: 'c4' }]])
  expect(board.proposeMove({ from: 'f1', to: 'c4' }).status).toBe('queued')
  board.makeMove('Nc6')
  const second = board.takePremove()!
  expect(second).toEqual({ from: 'f1', to: 'c4' })
  const next = board.proposeMove(second)
  if (next.status === 'proposed')
    board.acceptMove(next.attempt.id, { preservePremoves: true })
  expect(board.snapshot().moves).toEqual(['e4', 'e5', 'Nf3', 'Nc6', 'Bc4'])
})

it('keeps an in-flight second drag across an automatically executed first premove', async () => {
  const board = createBoard()
  board.configureInput({ input: 'premove' })
  board.makeMove('e4')
  board.proposeMove({ from: 'g1', to: 'f3' })
  const view = renderedBoard(board)
  const bishop = view.get('[data-testid="square-f1"]')
  await bishop.trigger('pointerdown', pointer(275, 375))
  await bishop.trigger('pointermove', pointer(125, 225))
  board.makeMove('e5')
  const first = board.proposeMove(board.takePremove()!)
  if (first.status === 'proposed')
    board.acceptMove(first.attempt.id, { preservePremoves: true })
  await view.setProps({ snapshot: board.snapshot() })
  expect(view.find('.drag-ghost').exists()).toBe(true)
  await bishop.trigger('pointerup', pointer(125, 225))
  expect(view.emitted('move')).toEqual([[{ from: 'f1', to: 'c4' }]])
})

it('preserves the next source selection when reply and automatic premove render separately', async () => {
  const board = createBoard()
  board.configureInput({ input: 'premove' })
  board.makeMove('e4')
  board.proposeMove({ from: 'g1', to: 'f3' })
  const view = renderedBoard(board)
  await view.get('[data-testid="square-f1"]').trigger('click')
  board.makeMove('e5')
  await view.setProps({ snapshot: board.snapshot() })
  const first = board.takePremove()!
  // Queue removal can be published at the same revision before the acceptance.
  await view.setProps({ snapshot: board.snapshot() })
  const proposed = board.proposeMove(first)
  if (proposed.status === 'proposed')
    board.acceptMove(proposed.attempt.id, { preservePremoves: true })
  await view.setProps({ snapshot: board.snapshot() })
  await view.get('[data-testid="square-c4"]').trigger('click')
  expect(view.emitted('move')).toEqual([[{ from: 'f1', to: 'c4' }]])
})

it('does not preserve a second source selection across an unrelated manual move', async () => {
  const board = createBoard()
  board.configureInput({ input: 'premove' })
  board.makeMove('e4')
  board.proposeMove({ from: 'g1', to: 'f3' })
  const view = renderedBoard(board)
  await view.get('[data-testid="square-f1"]').trigger('click')
  board.makeMove('e5')
  const manual = board.proposeMove({ from: 'g1', to: 'f3' })
  if (manual.status === 'proposed') board.acceptMove(manual.attempt.id)
  await view.setProps({ snapshot: board.snapshot() })
  await view.get('[data-testid="square-c4"]').trigger('click')
  expect(view.emitted('move')).toBeUndefined()
})

it('highlights every queued move and shows their order without changing the board layout', () => {
  const board = createBoard()
  board.configureInput({ input: 'premove' })
  board.makeMove('e4')
  board.proposeMove({ from: 'g1', to: 'f3' })
  board.proposeMove({ from: 'f1', to: 'c4' })
  const view = renderedBoard(board)
  expect(view.findAll('.square.queued')).toHaveLength(4)
  expect(view.get('[data-testid="square-f3"] .queue-order').text()).toBe('1')
  expect(view.get('[data-testid="square-c4"] .queue-order').text()).toBe('2')
})
