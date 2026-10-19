import { Chess } from 'chess.js'
import { terminalLines } from '../openings'
import type { Family, Side } from '../shared'
import type { MistakeBook, MistakeBranch } from './public'

const object = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value)
const integer = (
  value: unknown,
  minimum = 0,
  maximum = 1000000,
): value is number =>
  Number.isInteger(value) &&
  Number(value) >= minimum &&
  Number(value) <= maximum
const strings = (value: unknown): value is string[] =>
  Array.isArray(value) &&
  value.every(
    (move) => typeof move === 'string' && move.length > 0 && move.length < 32,
  )
const digest = (value: unknown): value is string =>
  typeof value === 'string' && /^[a-f0-9]{64}$/.test(value)
const key = (moves: readonly string[]) => JSON.stringify(moves)
const freeze = <T>(value: T): T => {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) freeze(child)
    Object.freeze(value)
  }
  return value
}

/** Validate complete legal branches before exposing any experimental exercise. */
export function createMistakeBook(
  value: unknown,
  family: Family,
  openingRevision: string,
): MistakeBook {
  const invalid = () =>
    new Error('Ungültige oder veraltete Fehlerübungen. Bitte lade die App neu.')
  if (
    !object(value) ||
    value.version !== 1 ||
    value.openingRevision !== openingRevision ||
    !digest(value.revision) ||
    !object(value.engine) ||
    typeof value.engine.name !== 'string' ||
    !value.engine.name.startsWith('Stockfish') ||
    !digest(value.engine.sha256) ||
    value.engine.threads !== 1 ||
    !object(value.policy) ||
    !integer(value.policy.minimumLossCp, 100) ||
    !integer(value.policy.minimumAdvantageCp, 50) ||
    !integer(value.policy.maximumPlayerMoves, 1, 3) ||
    !Array.isArray(value.branches) ||
    !value.branches.length ||
    value.branches.length > 5000
  )
    throw invalid()
  const policy = value.policy
  const positions = new Map<string, { fen: string; theory: Set<string> }>()
  for (const line of terminalLines(family.lines)) {
    const game = new Chess()
    for (let ply = 0; ply <= line.moves.length; ply++) {
      const historyKey = key(line.moves.slice(0, ply))
      const position = positions.get(historyKey) ?? {
        fen: game.fen(),
        theory: new Set<string>(),
      }
      if (line.moves[ply]) position.theory.add(line.moves[ply]!)
      positions.set(historyKey, position)
      if (line.moves[ply]) game.move(line.moves[ply]!)
    }
  }
  const byId = new Map<string, MistakeBranch>(),
    byHistory = new Map<string, MistakeBranch[]>()
  const identities = new Set<string>()
  for (const branch of value.branches) {
    if (
      !object(branch) ||
      typeof branch.id !== 'string' ||
      !branch.id.length ||
      byId.has(branch.id) ||
      !strings(branch.history) ||
      branch.history.length < 5 ||
      typeof branch.mistake !== 'string' ||
      !integer(branch.lossCp, Number(policy.minimumLossCp)) ||
      !integer(branch.advantageCp, Number(policy.minimumAdvantageCp)) ||
      !Array.isArray(branch.paths) ||
      !branch.paths.length ||
      branch.paths.length > 2
    )
      throw invalid()
    const position = positions.get(key(branch.history))
    if (!position || position.theory.has(branch.mistake)) throw invalid()
    const identity = key([...branch.history, branch.mistake])
    if (identities.has(identity)) throw invalid()
    identities.add(identity)
    try {
      const after = new Chess(position.fen)
      if (after.move(branch.mistake, { strict: true }).san !== branch.mistake)
        throw invalid()
      const paths: string[][] = []
      for (const path of branch.paths) {
        if (
          !object(path) ||
          !strings(path.moves) ||
          !path.moves.length ||
          path.moves.length > Number(policy.maximumPlayerMoves) * 2 - 1 ||
          !integer(path.advantageCp, Number(policy.minimumAdvantageCp))
        )
          throw invalid()
        const moves = path.moves
        const game = new Chess(after.fen())
        for (const move of moves)
          if (game.move(move, { strict: true }).san !== move) throw invalid()
        if (game.isDraw()) throw invalid()
        if (
          paths.some(
            (other) =>
              other.every((move, index) => moves[index] === move) ||
              moves.every((move, index) => other[index] === move),
          )
        )
          throw invalid()
        paths.push(moves)
      }
    } catch {
      throw invalid()
    }
    const accepted = freeze(structuredClone(branch) as unknown as MistakeBranch)
    byId.set(accepted.id, accepted)
    const historyKey = key(accepted.history)
    byHistory.set(historyKey, [...(byHistory.get(historyKey) ?? []), accepted])
  }
  for (const branches of byHistory.values()) freeze(branches)
  return {
    revision: value.revision,
    at(history: readonly string[], side: Side) {
      if ((history.length % 2 === 0) === (side === 'white')) return []
      return byHistory.get(key(history)) ?? []
    },
    get: (id) => byId.get(id),
  }
}

export async function loadMistakeBook(options: {
  family: Family
  openingRevision: string
  baseUrl?: string
  fetch?: typeof globalThis.fetch
}): Promise<MistakeBook> {
  const response = await (options.fetch ?? globalThis.fetch)(
    `${(options.baseUrl ?? '/data').replace(/\/$/, '')}/mistakes/${options.family.summary.id}.json`,
  )
  if (!response.ok)
    throw new Error(
      'Die experimentellen Fehlerübungen konnten nicht geladen werden.',
    )
  const dataset: unknown = await response.json()
  return createMistakeBook(dataset, options.family, options.openingRevision)
}
