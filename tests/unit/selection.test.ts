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
  it('starts with the shortest complete path, excluding shorter prefixes and duplicate paths', () => {
    const shortLeaf = {
      ...lines[0]!,
      id: 'short-leaf',
      moves: [...lines[0]!.moves, 'Nf6', 'Ng5'],
    }
    const longLeaf = {
      ...lines[1]!,
      id: 'long-leaf',
      moves: [...lines[1]!.moves, 'c3', 'Nf6', 'd4'],
    }
    const selected = chooseLesson({
      lines: [...lines, longLeaf, shortLeaf, { ...shortLeaf, id: 'z-alias' }],
      side: 'white',
      mode: 'guided',
      progress: {
        'white:long-leaf': {
          lineId: 'long-leaf',
          side: 'white',
          status: 'practicing',
          cleanRepetitions: 0,
          lastPracticedAt: 99,
        },
      },
      memories: {},
      now: 100,
      random: () => 0,
    })
    expect(selected?.line.id).toBe('short-leaf')
  })
  it('never offers learned paths again under a prefix or duplicate record name', () => {
    const alias = {
      ...lines[1]!,
      id: 'alias',
      name: 'Another record for the same path',
    }
    const selected = chooseLesson({
      lines: [...lines, alias],
      side: 'white',
      mode: 'guided',
      progress: {
        'white:alias': {
          lineId: 'alias',
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
    expect(selected).toBeNull()
  })
  it('extends free play along the deepest reply even when only a shorter line is learned', () => {
    const known = { ...lines[1]!, id: 'known' }
    const deeper = {
      ...lines[0]!,
      id: 'deep',
      moves: [...lines[0]!.moves, 'Nf6', 'Ng5', 'd5', 'exd5'],
    }
    const reply = chooseReply({
      lines: [known, deeper],
      history: lines[0]!.moves,
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
      side: 'white',
      mode: 'sparring',
      now: 100,
      random: () => 0,
      allowNew: false,
    })
    expect(reply).toEqual({ san: 'Nf6', newMaterial: true })
  })
  it('prioritizes proximity over length, then picks the shortest equally nearby sibling after reopening', () => {
    const trunk = [
      ...lines[1]!.moves,
      'c3',
      'Nf6',
      'd4',
      'exd4',
      'cxd4',
      'Bb4+',
    ]
    const candidates = [
      { ...lines[0]!, id: 'previous', moves: [...trunk, 'Nc3', 'Nxe4'] },
      { ...lines[0]!, id: 'sibling', moves: [...trunk, 'Bd2'] },
      {
        ...lines[0]!,
        id: 'long-sibling',
        moves: [...trunk, 'Kf1', 'Nxe4', 'Qb3'],
      },
      {
        ...lines[0]!,
        id: 'farther',
        moves: [...lines[0]!.moves, 'Nf6'],
      },
    ]
    const input = {
      lines: candidates,
      side: 'white' as const,
      mode: 'guided' as const,
      progress: {
        'white:previous': {
          lineId: 'previous',
          side: 'white' as const,
          status: 'mastered' as const,
          cleanRepetitions: 5,
          lastPracticedAt: 99,
        },
      },
      memories: {},
      now: 100,
      random: () => 0,
    }
    expect(chooseLesson({ ...input, lastLineId: 'previous' })?.line.id).toBe(
      'sibling',
    )
    expect(chooseLesson(input)?.line.id).toBe('sibling')
  })
  it('excludes intermediate lines and does not treat White mastery as Black mastery', () => {
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
    expect(selected?.line.id).toBe('classical')
  })
  it('prefers a familiar opponent reply among equally deep continuations', () => {
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
