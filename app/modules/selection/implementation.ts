import { Chess } from 'chess.js'
import { progressKey, responseKey } from '../shared'
import type { OpeningLine, ReviewMemory } from '../shared'
import type {
  SelectionInput,
  LessonChoice,
  ReplyInput,
  ReplyChoice,
  SuggestionInput,
  Suggestion,
} from './public'

const isLearned = (input: SelectionInput, line: OpeningLine) =>
  input.progress[progressKey(line.id, input.side)]?.status === 'mastered'
const pick = <T>(items: readonly T[], random: () => number): T | undefined =>
  items[
    Math.min(items.length - 1, Math.max(0, Math.floor(random() * items.length)))
  ]
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
export function chooseLesson(input: SelectionInput): LessonChoice | null {
  let eligible = input.lines.filter((line) =>
    line.moves.some(
      (_, index) => (index % 2 === 0) === (input.side === 'white'),
    ),
  )
  if (input.mode === 'guided')
    eligible = eligible.filter((line) => !isLearned(input, line))
  if (
    input.mode === 'sparring' &&
    eligible.some((line) => isLearned(input, line))
  )
    eligible = eligible.filter((line) => isLearned(input, line))
  if (input.lastLineId && eligible.length > 1)
    eligible = eligible.filter((line) => line.id !== input.lastLineId)
  const ordered = [...eligible].sort((a, b) =>
    input.mode === 'review'
      ? linePriority(input, b) - linePriority(input, a) ||
        a.moves.length - b.moves.length
      : a.moves.length - b.moves.length || a.name.localeCompare(b.name),
  )
  const line =
    input.mode === 'sparring'
      ? pick(ordered.slice(0, 8), input.random)
      : ordered[0]
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
  const learned = matching.filter((line) => isLearned(input, line))
  const pool = !input.allowNew && learned.length ? learned : matching
  const moves = [
    ...new Set(pool.map((line) => line.moves[input.history.length]!)),
  ]
  const weighted = moves.map((san) => ({
    san,
    weight:
      1 +
      Math.max(
        ...pool
          .filter((line) => line.moves[input.history.length] === san)
          .map((line) => linePriority(input, line, input.history.length + 1)),
      ),
  }))
  const total = weighted.reduce((sum, choice) => sum + choice.weight, 0)
  let remaining = Math.max(0, Math.min(1, input.random())) * total
  let san = weighted.at(-1)?.san
  for (const choice of weighted) {
    remaining -= choice.weight
    if (remaining < 0) {
      san = choice.san
      break
    }
  }
  return san
    ? {
        san,
        newMaterial: !learned.some(
          (line) => line.moves[input.history.length] === san,
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
