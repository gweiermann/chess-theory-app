import { describe, expect, it } from 'vitest'
import {
  chooseLesson,
  chooseReply,
  recommendMove,
} from '../../app/modules/selection'
import type { OpeningLine } from '../../app/modules/shared'
const lines: OpeningLine[] = [
  {
    id: 'italian',
    familyId: 'italian',
    topicId: 'e4',
    eco: 'C50',
    name: 'Italian',
    moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4'],
    suggestedSide: 'white',
  },
  {
    id: 'classical',
    familyId: 'italian',
    topicId: 'e4',
    eco: 'C50',
    name: 'Classical',
    moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5'],
    suggestedSide: 'white',
  },
]
describe('lesson selection', () => {
  it('does not treat White mastery as Black mastery', () => {
    const selected = chooseLesson({
      lines,
      side: 'black',
      mode: 'guided',
      progress: {
        'white:italian': {
          lineId: 'italian',
          side: 'white',
          status: 'mastered',
          cleanRepetitions: 5,
          lastPracticedAt: 1,
        },
      },
      memories: {},
      now: 100,
      random: () => 0,
    })
    expect(selected?.line.id).toBe('italian')
  })
  it('does not introduce an unfamiliar opponent reply when a learned continuation is available', () => {
    const candidates = [
      {
        ...lines[0]!,
        id: 'known',
        moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5', 'd3'],
      },
      {
        ...lines[0]!,
        id: 'new',
        moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Nf6', 'Ng5'],
      },
    ]
    const result = chooseReply({
      lines: candidates,
      history: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4'],
      side: 'white',
      mode: 'sparring',
      progress: {
        'white:known': {
          lineId: 'known',
          side: 'white',
          status: 'mastered',
          cleanRepetitions: 5,
          lastPracticedAt: 1,
        },
      },
      memories: {},
      now: 100,
      random: () => 0.99,
      allowNew: false,
    })
    expect(result?.san).toBe('Bc5')
    expect(result?.newMaterial).toBe(false)
  })
  it('recommends difficult responses without forbidding the alternatives', () => {
    const suggestion = recommendMove({
      familyId: 'italian',
      side: 'white',
      positionKey: 'position',
      moves: ['O-O', 'c3'],
      memories: {
        'italian|white|position|c3': {
          attempts: 3,
          mistakes: 2,
          assisted: 0,
          lastSeenAt: 1,
          dueAt: 1,
        },
      },
      now: 100,
    })
    expect(suggestion).toEqual({ san: 'c3', reason: 'difficult' })
  })
  it('steers the opponent toward difficult future responses while keeping alternatives possible', () => {
    const candidates = [
      {
        ...lines[0]!,
        id: 'known',
        moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5', 'c3'],
      },
      {
        ...lines[0]!,
        id: 'other',
        moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Nf6', 'd3'],
      },
    ]
    const input = {
      lines: candidates,
      history: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4'],
      side: 'white' as const,
      mode: 'sparring' as const,
      progress: {},
      memories: {
        'italian|white|r1bqk1nr/pppp1ppp/2n5/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq -|c3':
          { attempts: 3, mistakes: 2, assisted: 0, lastSeenAt: 1, dueAt: 1 },
      },
      now: 100,
      random: () => 0.55,
      allowNew: true,
    }
    expect(chooseReply(input)?.san).toBe('Bc5')
    expect(chooseReply({ ...input, random: () => 0.999 })?.san).toBe('Nf6')
  })
})
