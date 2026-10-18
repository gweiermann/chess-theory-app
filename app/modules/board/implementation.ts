import { Chess } from 'chess.js'
import type { Move } from 'chess.js'
import type {
  BoardSession,
  BoardSnapshot,
  BoardArrow,
  BoardCheckpoint,
  MoveAttempt,
  BoardResult,
} from './public'
import type { GameRecord, MoveInput, Side } from '../shared'

const side = (color: string): Side => (color === 'w' ? 'white' : 'black')
const key = (fen: string) => fen.split(' ').slice(0, 4).join(' ')
const square = (value: string) => /^[a-h][1-8]$/.test(value)

let nextBoardId = 0

/** Owns accepted chess state. Every exposed value is detached from that state. */
export function createBoard(): BoardSession {
  let chess = new Chess()
  let initialFen = chess.fen()
  let revision = 0
  let serial = 0
  const boardId = ++nextBoardId
  let gameGeneration = 0
  let resetGeneration = 0
  let owner = `board-${boardId}:game-${gameGeneration}`
  let disposed = false
  let orientation: Side = 'white'
  let playerSide: Side = 'white'
  let input: BoardSnapshot['input'] = 'disabled'
  let arrows: BoardArrow[] = []
  let viewedPly: number | null = null
  let premoves = true
  let premoveQueue: Exclude<MoveInput, string>[] = []
  let lastPremove: BoardSnapshot['lastPremove'] = null
  let consumedPremoveRevision = -1
  const attempts = new Map<string, { attempt: MoveAttempt; move: MoveInput }>()
  const listeners = new Set<() => void>()
  const notify = () => {
    for (const listener of [...listeners]) listener()
  }
  const tryMove = (target: Chess, move: MoveInput): Move | null => {
    try {
      return target.move(move)
    } catch {
      return null
    }
  }
  const build = (game: GameRecord): Chess | null => {
    try {
      const next = new Chess(game.initialFen)
      for (const move of game.moves) if (!tryMove(next, move)) return null
      return next
    } catch {
      return null
    }
  }
  const changed = () => {
    revision++
    attempts.clear()
    arrows = []
    viewedPly = null
    notify()
  }
  const board: BoardSession = {
    snapshot() {
      const display =
        viewedPly === null
          ? chess
          : build({ initialFen, moves: chess.history().slice(0, viewedPly) })!
      return {
        gameId: `${owner}:reset-${resetGeneration}`,
        revision,
        fen: display.fen(),
        positionKey: key(display.fen()),
        turn: side(display.turn()),
        moves: [...chess.history()],
        pieces: display.board().flatMap((rank) =>
          rank.flatMap((piece) =>
            piece
              ? [
                  {
                    square: piece.square,
                    type: piece.type,
                    side: side(piece.color),
                  },
                ]
              : [],
          ),
        ),
        legalMoves: display.moves({ verbose: true }).map((move) => ({
          from: move.from,
          to: move.to,
          san: move.san,
          ...(move.promotion ? { promotion: move.promotion } : {}),
        })),
        orientation,
        playerSide,
        input: disposed ? 'disabled' : input,
        viewedPly,
        arrows: arrows.map((arrow) => ({ ...arrow })),
        premove: premoveQueue[0] ? { ...premoveQueue[0] } : null,
        premoveQueue: premoveQueue.map((move) => ({ ...move })),
        lastPremove: lastPremove ? { ...lastPremove } : null,
      }
    },
    load(game) {
      if (disposed) return { status: 'cancelled' }
      const next = build(game)
      if (!next) return { status: 'illegal' }
      chess = next
      initialFen = new Chess(game.initialFen).fen()
      owner = `board-${boardId}:game-${++gameGeneration}`
      premoveQueue = []
      lastPremove = null
      changed()
      return { status: 'accepted' }
    },
    proposeMove(move) {
      if (disposed || input === 'disabled' || viewedPly !== null)
        return { status: 'disabled' }
      if (side(chess.turn()) !== playerSide) {
        if (
          input !== 'premove' ||
          !premoves ||
          typeof move === 'string' ||
          !square(move.from) ||
          !square(move.to)
        )
          return { status: 'disabled' }
        const virtualPieces = new Map(
          chess
            .board()
            .flat()
            .filter((piece) => piece !== null)
            .map((piece) => [piece.square as string, piece]),
        )
        for (const queued of premoveQueue) {
          const moving = virtualPieces.get(queued.from)
          virtualPieces.delete(queued.from)
          if (moving) virtualPieces.set(queued.to, moving)
        }
        const piece = virtualPieces.get(move.from)
        if (
          !piece ||
          side(piece.color) !== playerSide ||
          move.from === move.to ||
          (move.promotion && !/^[qrbn]$/.test(move.promotion))
        )
          return { status: 'illegal' }
        if (premoveQueue.length >= 16) return { status: 'disabled' }
        premoveQueue.push({ ...move })
        notify()
        return { status: 'queued' }
      }
      const candidate = new Chess(chess.fen())
      const result = tryMove(candidate, move)
      if (!result) return { status: 'illegal' }
      const attempt: MoveAttempt = {
        id: `${owner}:${++serial}`,
        revision,
        san: result.san,
        from: result.from,
        to: result.to,
        positionKey: key(chess.fen()),
      }
      attempts.clear()
      attempts.set(attempt.id, {
        attempt: { ...attempt },
        move: typeof move === 'string' ? move : { ...move },
      })
      return { status: 'proposed', attempt }
    },
    acceptMove(id, options) {
      if (disposed) return { status: 'cancelled' }
      const pending = attempts.get(id)
      if (!pending || pending.attempt.revision !== revision)
        return { status: 'stale' }
      const result = tryMove(chess, pending.move)
      if (!result) return { status: 'illegal' }
      if (!options?.preservePremoves) premoveQueue = []
      lastPremove = options?.preservePremoves
        ? {
            from: result.from,
            to: result.to,
            ...(result.promotion ? { promotion: result.promotion } : {}),
            revision: revision + 1,
          }
        : null
      changed()
      return { status: 'accepted', san: result.san }
    },
    rejectMove(id) {
      if (disposed) return { status: 'cancelled' }
      if (!attempts.has(id)) return { status: 'stale' }
      attempts.delete(id)
      premoveQueue = []
      notify()
      return { status: 'rejected' }
    },
    makeMove(move, expectedRevision) {
      if (disposed) return { status: 'cancelled' }
      if (expectedRevision !== undefined && revision !== expectedRevision)
        return { status: 'stale' }
      const result = tryMove(chess, move)
      if (!result) return { status: 'illegal' }
      changed()
      return { status: 'accepted', san: result.san }
    },
    saveCheckpoint() {
      return Object.freeze({
        owner,
        game: Object.freeze({
          initialFen,
          moves: Object.freeze([...chess.history()]),
        }),
      })
    },
    resetToCheckpoint(checkpoint: BoardCheckpoint): BoardResult {
      if (disposed) return { status: 'cancelled' }
      if (checkpoint.owner !== owner) return { status: 'stale' }
      const next = build(checkpoint.game)
      if (!next) return { status: 'illegal' }
      chess = next
      initialFen = new Chess(checkpoint.game.initialFen).fen()
      resetGeneration++
      premoveQueue = []
      lastPremove = null
      changed()
      return { status: 'accepted' }
    },
    configureInput(options) {
      if (disposed) return
      if (options.orientation) orientation = options.orientation
      if (options.playerSide) playerSide = options.playerSide
      if (options.input) input = options.input
      if (options.premoves !== undefined) premoves = options.premoves
      attempts.clear()
      if (!premoves || input !== 'premove' || options.playerSide)
        premoveQueue = []
      notify()
    },
    showArrows(next) {
      if (disposed) return
      arrows = next
        .filter(
          (arrow) =>
            square(arrow.from) && square(arrow.to) && arrow.from !== arrow.to,
        )
        .map((arrow) => ({ ...arrow }))
      notify()
    },
    viewHistory(ply) {
      if (disposed) return { status: 'cancelled' }
      if (
        ply !== null &&
        (!Number.isInteger(ply) || ply < 0 || ply > chess.history().length)
      )
        return { status: 'illegal' }
      viewedPly = ply
      attempts.clear()
      premoveQueue = []
      notify()
      return { status: 'accepted' }
    },
    takePremove() {
      if (
        disposed ||
        viewedPly !== null ||
        input !== 'premove' ||
        !premoves ||
        consumedPremoveRevision === revision ||
        side(chess.turn()) !== playerSide
      )
        return null
      const queued = premoveQueue.shift()
      if (!queued) return null
      consumedPremoveRevision = revision
      if (!tryMove(new Chess(chess.fen()), queued)) {
        premoveQueue = []
        notify()
        return null
      }
      notify()
      return { ...queued }
    },
    subscribe(listener) {
      if (disposed) return () => {}
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    dispose() {
      disposed = true
      attempts.clear()
      premoveQueue = []
      lastPremove = null
      arrows = []
      listeners.clear()
    },
  }
  return board
}
