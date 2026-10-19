import { describe, expect, it } from 'vitest'
import { parseEngineOutput } from '../../scripts/stockfish'

describe('Stockfish UCI snapshots', () => {
  it('never mixes a partial replacement batch with an earlier batch at the same depth', () => {
    const result = parseEngineOutput(
      [
        'info depth 10 multipv 1 score cp 30 pv e2e4 e7e5',
        'info depth 10 multipv 2 score cp 20 pv d2d4 d7d5',
        'info depth 10 multipv 1 score cp 25 pv d2d4 d7d5',
        'bestmove d2d4',
      ],
      2,
    )
    expect(result.map((line) => line.pv[0])).toEqual(['e2e4', 'd2d4'])
  })
  it('excludes bounded scores and duplicate root moves, retaining the last complete analysis', () => {
    const first = [
      'info depth 9 multipv 1 score mate 3 pv e2e4',
      'info depth 9 multipv 2 score cp 20 pv d2d4',
    ]
    expect(
      parseEngineOutput(
        [
          ...first,
          'info depth 10 multipv 1 score cp 50 lowerbound pv e2e4',
          'info depth 10 multipv 2 score cp 20 pv d2d4',
        ],
        2,
      )[0]!.mate,
    ).toBe(3)
    expect(() =>
      parseEngineOutput(
        [
          'info depth 10 multipv 1 score cp 30 pv e2e4',
          'info depth 10 multipv 2 score cp 20 pv e2e4',
        ],
        2,
      ),
    ).toThrow()
  })
})
