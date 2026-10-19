import { choosePracticeIntent, choosePracticeLine } from './practice'
import { Chess } from 'chess.js'
import { terminalLines } from '../openings'
import { progressKey, responseKey, isFreePlay } from '../shared'
import type { OpeningLine, ReviewMemory } from '../shared'
import type {
  SelectionInput,
  LessonChoice,
  ReplyInput,
  ReplyChoice,
  SuggestionInput,
  Suggestion,
  LearningOrderInput,
} from './public'

const isLearned = (input: SelectionInput, line: OpeningLine) =>
  input.lines.some(
    (known) =>
      known.familyId === line.familyId &&
      input.progress[progressKey(known.id, input.side)]?.status ===
        'mastered' &&
      line.moves.every((move, index) => known.moves[index] === move),
  )
const memoryPriority = (memory: ReviewMemory | undefined, now: number) =>
  memory
    ? (memory.mistakes * 8 + memory.assisted * 2) /
        Math.max(1, memory.attempts) +
      (memory.dueAt <= now ? 4 : 0) +
      1 / (memory.attempts + 1)
    : 1

function linePriority(
  input: SelectionInput,
  line: OpeningLine,
  fromPly = 0,
): number {
  const game = new Chess()
  let priority = 0
  for (let index = 0; index < line.moves.length; index++) {
    const san = line.moves[index]!
    if (index >= fromPly && (index % 2 === 0) === (input.side === 'white')) {
      const key = responseKey(
        line.familyId,
        input.side,
        game.fen().split(' ').slice(0, 4).join(' '),
        san,
      )
      priority = Math.max(
        priority,
        memoryPriority(input.memories[key], input.now),
      )
    }
    game.move(san)
  }
  return priority
}
/** Complete paths only: nearest shared branch first, then shortest length.
 * With no previous practice, proximity is equal and the shortest leaf starts.
 */
export function orderLearningLines(input: LearningOrderInput): OpeningLine[] {
  const recent = Object.values(input.progress)
    .filter(
      (record) => record.side === input.side && record.status === 'mastered',
    )
    .sort((a, b) => b.lastPracticedAt - a.lastPracticedAt)
    .map((record) => input.lines.find((line) => line.id === record.lineId))
    .find((line) => line !== undefined)
  const previous =
    input.lines.find((line) => line.id === input.lastLineId) ?? recent
  const sharedDepth = (line: OpeningLine) => {
    if (!previous || line.familyId !== previous.familyId) return 0
    const difference = line.moves.findIndex(
      (move, index) => previous.moves[index] !== move,
    )
    return difference < 0 ? line.moves.length : difference
  }
  return terminalLines(input.lines).sort(
    (a, b) =>
      sharedDepth(b) - sharedDepth(a) ||
      a.moves.length - b.moves.length ||
      a.name.localeCompare(b.name) ||
      a.id.localeCompare(b.id),
  )
}

export function chooseLesson(input: SelectionInput): LessonChoice | null {
  if (isFreePlay(input.mode)) {
    const leaves = terminalLines(input.lines)
    let shared = 0
    while (
      leaves.length &&
      leaves.every(
        (line) =>
          line.moves[shared] && line.moves[shared] === leaves[0]!.moves[shared],
      )
    )
      shared++
    const line = choosePracticeLine(input, leaves, shared)
    return line
      ? {
          line,
          reason:
            choosePracticeIntent(input) === 'review' ? 'review' : 'variety',
        }
      : null
  }
  let eligible = (
    input.mode === 'guided'
      ? orderLearningLines(input)
      : terminalLines(input.lines)
  ).filter((line) =>
    line.moves.some(
      (_, index) => (index % 2 === 0) === (input.side === 'white'),
    ),
  )
  if (input.mode === 'guided')
    eligible = eligible.filter((line) => !isLearned(input, line))
  if (input.lastLineId && eligible.length > 1)
    eligible = eligible.filter((line) => line.id !== input.lastLineId)
  const ordered =
    input.mode === 'guided'
      ? eligible
      : [...eligible].sort((a, b) =>
          input.mode === 'review'
            ? linePriority(input, b) - linePriority(input, a) ||
              a.moves.length - b.moves.length
            : b.moves.length - a.moves.length ||
              a.name.localeCompare(b.name) ||
              a.id.localeCompare(b.id),
        )
  const line = ordered[0]
  return line
    ? {
        line,
        reason:
          input.mode === 'guided'
            ? 'unlearned'
            : input.mode === 'review'
              ? 'review'
              : 'variety',
      }
    : null
}

export function chooseReply(input: ReplyInput): ReplyChoice | null {
  const matching = input.lines.filter(
    (line) =>
      input.history.every((san, index) => line.moves[index] === san) &&
      line.moves.length > input.history.length,
  )
  const target = matching.find((line) => line.id === input.targetLineId)
  const line =
    target ?? choosePracticeLine(input, matching, input.history.length)
  const san = line?.moves[input.history.length]
  return san
    ? {
        san,
        newMaterial: !matching.some(
          (candidate) =>
            isLearned(input, candidate) &&
            candidate.moves[input.history.length] === san,
        ),
      }
    : null
}

export function recommendMove(input: SuggestionInput): Suggestion | null {
  if (input.moves.length < 2) return null
  const choices = input.moves.map((san) => ({
    san,
    memory:
      input.memories[
        responseKey(input.familyId, input.side, input.positionKey, san)
      ],
  }))
  choices.sort(
    (a, b) =>
      (input.practiceIntent === 'explore'
        ? Number(!b.memory?.attempts) - Number(!a.memory?.attempts)
        : 0) ||
      memoryPriority(b.memory, input.now) - memoryPriority(a.memory, input.now),
  )
  const best = choices[0]!
  return {
    san: best.san,
    reason: best.memory?.mistakes
      ? 'difficult'
      : best.memory && best.memory.dueAt <= input.now
        ? 'due'
        : 'less-practiced',
  }
}
