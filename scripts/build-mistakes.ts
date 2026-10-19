import { createHash } from 'node:crypto'
import { readFile, writeFile, appendFile, mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { Chess } from 'chess.js'
import { terminalLines } from '../app/modules/openings'
import type { Family, Catalog } from '../app/modules/shared'
import type {
  MistakeBranch,
  MistakeContinuation,
  MistakeDataset,
} from '../app/modules/mistakes/public'
import { startStockfish } from './stockfish'
import type { EngineLine } from './stockfish'

export const MISTAKE_POLICY = Object.freeze({
  screenNodes: 60000,
  verifyNodes: 250000,
  minimumLossCp: 150,
  minimumAdvantageCp: 100,
  maximumPlayerMoves: 3,
  responseToleranceCp: 35,
})
const hash = (value: string | Buffer) =>
  createHash('sha256').update(value).digest('hex')
const gameFrom = (moves: readonly string[]) => {
  const game = new Chess()
  for (const move of moves) game.move(move)
  return game
}
const playUci = (game: Chess, uci: string) =>
  game.move({
    from: uci.slice(0, 2),
    to: uci.slice(2, 4),
    promotion: uci.slice(4) || undefined,
  })
const material = (game: Chess, side: 'w' | 'b') =>
  game
    .board()
    .flat()
    .reduce(
      (sum, piece) =>
        sum +
        (piece
          ? (piece.color === side ? 1 : -1) *
            { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 }[piece.type]
          : 0),
      0,
    )

/** Offline analysis only. Normal app/data builds consume the checked-in artifact. */
export async function buildMistakes(enginePath: string, root = process.cwd()) {
  const catalog: Catalog = JSON.parse(
    await readFile(resolve(root, 'public/data/catalog.json'), 'utf8'),
  )
  const family: Family = JSON.parse(
    await readFile(
      resolve(root, `public/data/families/${catalog.families[0]!.id}.json`),
      'utf8',
    ),
  )
  const leaves = terminalLines(family.lines)
  const positions = new Map<
    string,
    { history: readonly string[]; terminal: boolean }
  >()
  for (const line of leaves)
    for (let ply = 5; ply <= line.moves.length; ply++) {
      const history = line.moves.slice(0, ply),
        key = JSON.stringify(history)
      positions.set(key, {
        history,
        terminal:
          (positions.get(key)?.terminal ?? false) || ply === line.moves.length,
      })
    }
  const sha256 = hash(await readFile(enginePath))
  const engine = await startStockfish(enginePath)
  const cacheDir = resolve(root, '.cache/mistakes')
  await mkdir(cacheDir, { recursive: true })
  const cacheFile = resolve(cacheDir, `${sha256}-batches-v2.jsonl`)
  const cache = new Map<string, EngineLine[]>()
  try {
    for (const row of (await readFile(cacheFile, 'utf8'))
      .split('\n')
      .filter(Boolean)) {
      const [key, value] = JSON.parse(row)
      cache.set(key, value)
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
  }
  const query = async (
    worker: typeof engine,
    game: Chess,
    count: number,
    nodes: number,
  ) => {
    const key = JSON.stringify([game.history(), count, nodes])
    const known = cache.get(key)
    if (known) return known
    const value = await worker.analyze(game, count, nodes)
    cache.set(key, value)
    await appendFile(cacheFile, `${JSON.stringify([key, value])}\n`)
    return value
  }
  const branches: MistakeBranch[] = []
  let analyzed = 0
  const engines = [
    engine,
    ...(await Promise.all(
      Array.from({ length: 3 }, () => startStockfish(enginePath)),
    )),
  ]
  const entries = [...positions.values()].sort(
    (a, b) =>
      a.history.length - b.history.length ||
      JSON.stringify(a.history).localeCompare(JSON.stringify(b.history)),
  )
  let cursor = 0
  const inspect = async (worker: typeof engine) => {
    const analyze = (
      game: Chess,
      count: number,
      nodes = MISTAKE_POLICY.verifyNodes,
    ) => query(worker, game, count, nodes)
    while (cursor < entries.length) {
      const { history } = entries[cursor++]!
      const before = gameFrom(history)
      if (before.isGameOver()) continue
      const baseline = (await analyze(before, 1))[0]!
      const screen = await analyze(
        before,
        before.moves().length,
        MISTAKE_POLICY.screenNodes,
      )
      const theory = new Set(
        leaves
          .filter((line) =>
            history.every((move, index) => line.moves[index] === move),
          )
          .map((line) => line.moves[history.length]),
      )
      const candidates = screen
        .filter(
          (line) =>
            baseline.cp - line.cp >= 100 && baseline.cp - line.cp <= 1000,
        )
        .sort((a, b) => b.cp - a.cp || a.pv[0]!.localeCompare(b.pv[0]!))
      let accepted = 0,
        tried = 0
      for (const candidate of candidates) {
        const after = gameFrom(history)
        const mistake = playUci(after, candidate.pv[0]!).san
        if (theory.has(mistake)) continue
        if (++tried > 5 || accepted >= 2) break
        const responses = await analyze(after, 3)
        const best = responses[0]
        if (
          !best ||
          best.depth < 10 ||
          best.cp < MISTAKE_POLICY.minimumAdvantageCp ||
          best.cp + baseline.cp < MISTAKE_POLICY.minimumLossCp
        )
          continue
        const player = after.turn(),
          initialMaterial = material(before, player)
        const paths: MistakeContinuation[] = []
        for (const response of responses
          .filter(
            (line) => best.cp - line.cp <= MISTAKE_POLICY.responseToleranceCp,
          )
          .slice(0, 2)) {
          const game = gameFrom([...history, mistake])
          const moves: string[] = []
          let playerMoves = 0
          for (const uci of response.pv) {
            const learnerTurn = game.turn() === player
            moves.push(playUci(game, uci).san)
            if (learnerTurn) playerMoves++
            if (
              game.isGameOver() ||
              playerMoves >= MISTAKE_POLICY.maximumPlayerMoves ||
              (!learnerTurn &&
                material(game, player) - initialMaterial >= 100 &&
                !game.isCheck())
            )
              break
          }
          if (!moves.length || game.isDraw()) continue
          const final = game.isCheckmate()
            ? 100000
            : ((await analyze(game, 1))[0]?.cp ?? -100000) *
              (game.turn() === player ? 1 : -1)
          if (final < MISTAKE_POLICY.minimumAdvantageCp || final < best.cp - 80)
            continue
          paths.push({ moves, advantageCp: final })
        }
        if (!paths.length) continue
        branches.push({
          id: hash(JSON.stringify([history, mistake])).slice(0, 24),
          history,
          mistake,
          lossCp: best.cp + baseline.cp,
          advantageCp: best.cp,
          paths,
        })
        accepted++
      }
      analyzed++
      if (analyzed % 20 === 0)
        console.log(
          `Analyzed ${analyzed}/${positions.size} positions; ${branches.length} verified mistakes.`,
        )
    }
  }
  try {
    await Promise.all(engines.map(inspect))
  } finally {
    for (const worker of engines) worker.close()
  }
  branches.sort((a, b) => a.id.localeCompare(b.id))
  const content = {
    version: 1 as const,
    openingRevision: catalog.revision,
    engine: {
      name: engine.name,
      sha256,
      source:
        'https://github.com/official-stockfish/Stockfish/releases/tag/sf_19',
      threads: 1 as const,
      hashMb: 32,
    },
    policy: MISTAKE_POLICY,
    coverage: {
      positions: positions.size,
      analyzed,
      terminalPositions: [...positions.values()].filter(
        (position) => position.terminal,
      ).length,
    },
    branches,
  }
  const dataset: MistakeDataset = {
    ...content,
    revision: hash(JSON.stringify(content)),
  }
  const destination = resolve(root, 'public/data/mistakes')
  await mkdir(destination, { recursive: true })
  await writeFile(
    resolve(destination, `${family.summary.id}.json`),
    JSON.stringify(dataset),
  )
  console.log(
    `Generated ${branches.length} mistakes from ${analyzed} positions (${dataset.revision}).`,
  )
  return dataset
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  const enginePath = process.env.STOCKFISH_PATH
  if (!enginePath)
    throw new Error(
      'Set STOCKFISH_PATH to a pinned Stockfish UCI executable before generating mistakes.',
    )
  await buildMistakes(enginePath)
}
