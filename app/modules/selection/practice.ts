import { Chess } from 'chess.js'
import { isFreePlay, progressKey, responseKey } from '../shared'
import type { OpeningLine, PracticeIntent } from '../shared'
import type { MistakeSelectionInput, SelectionInput } from './public'

const DAY = 86400000
const EXPLORATION_ROUNDS = 3

export function choosePracticeIntent(input: SelectionInput): PracticeIntent {
  const rounds = (input.activity ?? []).filter(
    (event) =>
      event.kind === 'round' &&
      event.completed &&
      isFreePlay(event.mode) &&
      event.side === input.side &&
      input.lines.some((line) => line.familyId === event.familyId),
  )
  const latest = rounds.at(-1)
  if (!latest?.practiceIntent) return 'explore'
  if (input.now - latest.at >= DAY) return 'review'
  let newRounds = 0
  for (const round of [...rounds].reverse()) {
    if (round.practiceIntent !== 'explore') break
    newRounds++
  }
  return newRounds >= EXPLORATION_ROUNDS ? 'review' : 'explore'
}

/** Responses and observed opponent branches share position keys, but remain
 * separate from mastery. Seeing a move is enough to stop calling it new. */
function familiarity(
  input: SelectionInput,
  line: OpeningLine,
  fromPly: number,
) {
  const game = new Chess()
  let unseen = 0,
    count = 0,
    review = 0,
    lastSeen = 0
  const mastered =
    input.progress[progressKey(line.id, input.side)]?.status === 'mastered'
  for (let ply = 0; ply < line.moves.length; ply++) {
    const san = line.moves[ply]!
    if (ply >= fromPly) {
      const memory =
        input.memories[
          responseKey(
            line.familyId,
            input.side,
            game.fen().split(' ').slice(0, 4).join(' '),
            san,
          )
        ]
      const weight = (ply % 2 === 0) === (input.side === 'white') ? 2 : 1
      count += weight
      if (!memory?.attempts && !mastered) unseen += weight
      if (memory) {
        lastSeen = Math.max(lastSeen, memory.lastSeenAt)
        review = Math.max(
          review,
          (memory.dueAt <= input.now ? 4 : 0) +
            (memory.mistakes * 8 + memory.assisted * 2) /
              Math.max(1, memory.attempts),
        )
      }
    }
    game.move(san)
  }
  return { novelty: unseen / Math.max(1, count), review, lastSeen }
}

export function choosePracticeLine(
  input: SelectionInput,
  lines: readonly OpeningLine[],
  fromPly = 0,
) {
  const intent = input.practiceIntent ?? choosePracticeIntent(input)
  let candidates = lines.map((line) => ({
    line,
    ...familiarity(input, line, fromPly),
  }))
  const hasPlayerMove = (line: OpeningLine) =>
    line.moves.some(
      (_, ply) =>
        ply >= fromPly && (ply % 2 === 0) === (input.side === 'white'),
    )
  if (candidates.some(({ line }) => hasPlayerMove(line)))
    candidates = candidates.filter(({ line }) => hasPlayerMove(line))
  const familiar = candidates.filter((candidate) => candidate.novelty === 0)
  if (intent === 'review' && familiar.length) candidates = familiar
  candidates.sort(
    (a, b) =>
      (intent === 'review' && familiar.length
        ? b.review - a.review || a.lastSeen - b.lastSeen
        : b.novelty - a.novelty || a.lastSeen - b.lastSeen) ||
      Number(a.line.id === input.lastLineId) -
        Number(b.line.id === input.lastLineId) ||
      b.line.moves.length - a.line.moves.length ||
      a.line.id.localeCompare(b.line.id),
  )
  const best = candidates[0]
  if (!best) return undefined
  const ties = candidates.filter(
    (candidate) =>
      candidate.novelty === best.novelty &&
      candidate.review === best.review &&
      candidate.lastSeen === best.lastSeen &&
      candidate.line.moves.length === best.line.moves.length &&
      (candidate.line.id === input.lastLineId) ===
        (best.line.id === input.lastLineId),
  )
  return ties[
    Math.min(
      ties.length - 1,
      Math.max(0, Math.floor(input.random() * ties.length)),
    )
  ]?.line
}

export function chooseMistake(input: MistakeSelectionInput) {
  const intent = input.practiceIntent ?? choosePracticeIntent(input)
  const candidates = input.branches.map((branch) => {
    const game = new Chess()
    for (const san of branch.history) game.move(san)
    const memory =
      input.memories[
        responseKey(
          input.lines[0]!.familyId,
          input.side,
          game.fen().split(' ').slice(0, 4).join(' '),
          branch.mistake,
        )
      ]
    // Older sessions saved learner responses but not opponent observations.
    // Their first response still proves this slip has already been presented.
    game.move(branch.mistake)
    const responseMemories = branch.paths.map(
      (path) =>
        input.memories[
          responseKey(
            input.lines[0]!.familyId,
            input.side,
            game.fen().split(' ').slice(0, 4).join(' '),
            path.moves[0]!,
          )
        ],
    )
    return {
      branch,
      attempts: Math.max(
        memory?.attempts ?? 0,
        ...responseMemories.map((response) => response?.attempts ?? 0),
      ),
      seen: Math.max(
        memory?.lastSeenAt ?? 0,
        ...responseMemories.map((response) => response?.lastSeenAt ?? 0),
      ),
    }
  })
  const familiar = candidates.filter((candidate) => candidate.attempts > 0)
  const pool = input.unseenOnly
    ? candidates.filter((candidate) => candidate.attempts === 0)
    : intent === 'review' && familiar.length
      ? familiar
      : candidates
  pool.sort(
    (a, b) =>
      a.attempts - b.attempts ||
      a.seen - b.seen ||
      a.branch.id.localeCompare(b.branch.id),
  )
  return pool[0]?.branch
}
