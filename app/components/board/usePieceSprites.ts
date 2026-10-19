import { nextTick, shallowRef, watch } from 'vue'
import type { BoardSnapshot, Piece } from '../../modules/board'

interface Sprite extends Piece {
  id: number
  moving: boolean
  arriving: boolean
  instant: boolean
}
const coordinate = (square: string) =>
  [square.charCodeAt(0) - 97, Number(square[1]) - 1] as const
const distance = (from: string, to: string) => {
  const [x1, y1] = coordinate(from)
  const [x2, y2] = coordinate(to)
  return (x1 - x2) ** 2 + (y1 - y2) ** 2
}
const sameKind = (a: Piece, b: Piece) => a.side === b.side && a.type === b.type
const promotionPair = (a: Piece, b: Piece) => {
  if (
    a.side !== b.side ||
    Math.abs(coordinate(a.square)[0] - coordinate(b.square)[0]) > 1
  )
    return false
  const [pawn, promoted] = a.type === 'p' ? [a, b] : [b, a]
  return (
    pawn.type === 'p' &&
    ['q', 'r', 'b', 'n'].includes(promoted.type) &&
    pawn.square[1] === (pawn.side === 'white' ? '7' : '2') &&
    promoted.square[1] === (pawn.side === 'white' ? '8' : '1')
  )
}

/** Presentation identities survive moves, history jumps and whole-position resets.
 * The Board's accepted position remains the sole authority for input and labels.
 */
export function usePieceSprites(snapshot: () => BoardSnapshot) {
  let serial = 0
  let drop: { from: string; to: string } | null = null
  const fresh = (piece: Piece, arriving: boolean): Sprite => ({
    ...piece,
    id: ++serial,
    moving: false,
    arriving,
    instant: false,
  })
  const sprites = shallowRef(
    snapshot().pieces.map((piece) => fresh(piece, false)),
  )
  watch(
    () => snapshot().pieces,
    (pieces) => {
      const remaining = new Set(sprites.value)
      const matched = new Map<Piece, Sprite>()
      const assign = (piece: Piece, before: Sprite) => {
        matched.set(piece, {
          ...before,
          ...piece,
          moving: before.square !== piece.square,
          arriving: false,
          instant: drop?.from === before.square && drop.to === piece.square,
        })
        remaining.delete(before)
      }
      // Keep stationary pieces first, so identical pawns and rooks never exchange identities.
      for (const piece of pieces) {
        const before = [...remaining].find(
          (old) => old.square === piece.square && sameKind(old, piece),
        )
        if (before) assign(piece, before)
      }
      const pair = (compatible: (before: Piece, after: Piece) => boolean) => {
        const candidates = pieces
          .filter((piece) => !matched.has(piece))
          .flatMap((piece) =>
            [...remaining]
              .filter((old) => compatible(old, piece))
              .map((old) => ({
                piece,
                old,
                distance: distance(old.square, piece.square),
              })),
          )
          .sort(
            (a, b) =>
              a.distance - b.distance ||
              a.old.id - b.old.id ||
              a.piece.square.localeCompare(b.piece.square),
          )
        for (const { piece, old } of candidates)
          if (!matched.has(piece) && remaining.has(old)) assign(piece, old)
      }
      pair(sameKind)
      pair(promotionPair)
      // Re-inserting a DOM node cancels its CSS transition. Keep draw order stable;
      // only its transform changes when its square changes.
      sprites.value = pieces
        .map((piece) => matched.get(piece) ?? fresh(piece, true))
        .sort((a, b) => a.id - b.id)
      drop = null
    },
  )
  return {
    sprites,
    settleDrop(from: string, to: string) {
      const intent = { from, to }
      drop = intent
      // A rejected or queued attempt must not suppress animation of a later move.
      void nextTick(() => {
        if (drop === intent) drop = null
      })
    },
  }
}
