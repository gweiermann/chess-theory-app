import { describe, expect, it } from 'vitest'
import { Chess } from 'chess.js'
import {
  chooseLesson,
  chooseReply,
  choosePracticeIntent,
  chooseMistake,
} from '../../app/modules/selection'
import { responseKey } from '../../app/modules/shared'
import type {
  OpeningLine,
  LearningOutcome,
  ReviewMemory,
} from '../../app/modules/shared'
const root = ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4']
const line = (id: string, tail: string[]): OpeningLine => ({
  id,
  familyId: 'italian',
  topicId: 'e4',
  eco: 'C50',
  name: id,
  suggestedSide: 'white',
  moves: [...root, ...tail],
})
const known = line('known', ['Bc5', 'c3', 'Nf6', 'd4'])
const fresh = line('fresh', ['Nf6', 'd3'])
const base = {
  lines: [known, fresh],
  mode: 'sparring' as const,
  side: 'white' as const,
  progress: {},
  memories: {},
  now: 1000,
  random: () => 0,
}
function seenLine(value: OpeningLine) {
  const game = new Chess(),
    memories: Record<string, ReviewMemory> = {}
  for (const san of value.moves) {
    memories[
      responseKey(
        'italian',
        'white',
        game.fen().split(' ').slice(0, 4).join(' '),
        san,
      )
    ] = { attempts: 4, mistakes: 0, assisted: 4, lastSeenAt: 100, dueAt: 2000 }
    game.move(san)
  }
  return memories
}
const completed = (
  id: string,
  practiceIntent: 'explore' | 'review',
  at = 100,
): LearningOutcome => ({
  id,
  at,
  lineId: known.id,
  familyId: 'italian',
  side: 'white',
  mode: 'sparring',
  kind: 'round',
  practiceIntent,
  positionKey: 'end',
  move: '-',
  grade: 'recalled',
  mistakes: 0,
  completed: true,
  cleanRepetitions: 1,
  datasetRevision: 'opening',
})
describe('varied free practice', () => {
  it('chooses an unseen shorter branch ahead of a repeated longer one in both modes', () => {
    for (const mode of ['sparring', 'mistakes'] as const) {
      const input = { ...base, mode, memories: seenLine(known) }
      expect(chooseLesson(input)?.line.id).toBe('fresh')
      expect(
        chooseReply({ ...input, history: root, allowNew: false })?.san,
      ).toBe('Nf6')
    }
  })
  it('gives three exploration rounds before a familiar review and resumes exploration afterwards', () => {
    const input = { ...base, memories: seenLine(known) }
    const activity = [
      completed('1', 'explore'),
      completed('2', 'explore'),
      completed('3', 'explore'),
    ]
    expect(
      choosePracticeIntent({ ...input, activity: activity.slice(0, 2) }),
    ).toBe('explore')
    expect(choosePracticeIntent({ ...input, activity })).toBe('review')
    expect(chooseLesson({ ...input, activity })?.line.id).toBe('known')
    expect(
      choosePracticeIntent({
        ...input,
        activity: [...activity, completed('4', 'review')],
      }),
    ).toBe('explore')
    expect(
      choosePracticeIntent({
        ...input,
        activity: [
          { ...completed('old', 'explore'), practiceIntent: undefined },
        ],
      }),
    ).toBe('explore')
  })
  it('offers one familiar review after a day away, without using the other color’s activity', () => {
    const input = {
      ...base,
      memories: seenLine(known),
      now: 86400101,
      activity: [completed('old', 'explore')],
    }
    expect(choosePracticeIntent(input)).toBe('review')
    expect(
      choosePracticeIntent({
        ...input,
        activity: [{ ...completed('other', 'explore'), side: 'black' }],
      }),
    ).toBe('explore')
  })
  it('honors a selected target while allowing a different learner branch', () => {
    expect(
      chooseReply({
        ...base,
        history: root,
        targetLineId: 'fresh',
        allowNew: false,
      })?.san,
    ).toBe('Nf6')
    expect(
      chooseReply({
        ...base,
        history: [...root, 'Bc5', 'c3'],
        targetLineId: 'fresh',
        allowNew: false,
      })?.san,
    ).toBe('Nf6')
  })
  it('prefers an unseen mistake instead of the same previously presented slip', () => {
    const game = new Chess()
    for (const move of root) game.move(move)
    const key = responseKey(
      'italian',
      'white',
      game.fen().split(' ').slice(0, 4).join(' '),
      'b5',
    )
    const branches = [
      {
        id: 'old',
        history: root,
        mistake: 'b5',
        lossCp: 200,
        advantageCp: 150,
        paths: [{ moves: ['Bxb5'], advantageCp: 150 }],
      },
      {
        id: 'new',
        history: root,
        mistake: 'f6',
        lossCp: 200,
        advantageCp: 150,
        paths: [{ moves: ['Nxe5'], advantageCp: 150 }],
      },
    ]
    expect(
      chooseMistake({
        ...base,
        branches,
        memories: {
          [key]: {
            attempts: 4,
            mistakes: 0,
            assisted: 0,
            lastSeenAt: 100,
            dueAt: 1000,
          },
        },
      })?.id,
    ).toBe('new')
    game.move('b5')
    const response = responseKey(
      'italian',
      'white',
      game.fen().split(' ').slice(0, 4).join(' '),
      'Bxb5',
    )
    expect(
      chooseMistake({
        ...base,
        branches,
        memories: {
          [response]: {
            attempts: 4,
            mistakes: 0,
            assisted: 4,
            lastSeenAt: 100,
            dueAt: 1000,
          },
        },
      })?.id,
    ).toBe('new')
  })
})
