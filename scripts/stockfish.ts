import { spawn } from 'node:child_process'
import { createInterface } from 'node:readline'
import type { Chess } from 'chess.js'

export interface EngineLine {
  depth: number
  cp: number
  mate: number | null
  pv: string[]
}

/** MultiPV reports arrive in batches; an interrupted batch must never reuse old ranks. */
export function parseEngineOutput(
  lines: readonly string[],
  count: number,
): EngineLine[] {
  let batch: EngineLine[] = [],
    complete: EngineLine[] = []
  for (const line of lines) {
    const match = line.match(
      /^info depth (\d+).*? multipv (\d+) score (cp|mate) (-?\d+)(.*?) pv (.+)$/,
    )
    if (!match) continue
    const depth = Number(match[1]),
      rank = Number(match[2]),
      score = Number(match[4])
    if (rank === 1) batch = []
    if (
      /bound/.test(match[5]!) ||
      rank !== batch.length + 1 ||
      (batch.length && batch[0]!.depth !== depth)
    ) {
      batch = []
      continue
    }
    batch.push({
      depth,
      cp:
        match[3] === 'cp'
          ? score
          : Math.sign(score) * (100000 - Math.abs(score)),
      mate: match[3] === 'mate' ? score : null,
      pv: match[6]!.split(' '),
    })
    if (
      batch.length === count &&
      new Set(batch.map((entry) => entry.pv[0])).size === count &&
      batch.every(
        (entry, index) => !index || entry.cp <= batch[index - 1]!.cp,
      ) &&
      depth >= (complete[0]?.depth ?? 0)
    )
      complete = [...batch]
  }
  if (!complete.length) throw new Error('Incomplete Stockfish analysis batch')
  return complete
}

/** Serialized UCI adapter. A fresh search state and fixed nodes avoid time-based results. */
export async function startStockfish(path: string) {
  const process = spawn(path, [], {
    windowsHide: true,
    stdio: ['pipe', 'pipe', 'pipe'],
  })
  const output = createInterface({ input: process.stdout })
  let receive: ((line: string) => void) | undefined
  let fail: ((error: Error) => void) | undefined
  let stderr = ''
  process.stderr.on('data', (data) => {
    stderr = `${stderr}${data}`.slice(-2000)
  })
  process.on('error', (error) => fail?.(error))
  process.on('exit', (code) =>
    fail?.(new Error(`Stockfish exited (${code}): ${stderr}`)),
  )
  output.on('line', (line) => receive?.(line))
  const command = (text: string, done: (line: string) => boolean) =>
    new Promise<string[]>((resolve, reject) => {
      const lines: string[] = []
      const timer = setTimeout(() => {
        process.kill()
        reject(new Error('Stockfish search timed out'))
      }, 60000)
      fail = (error) => {
        clearTimeout(timer)
        reject(error)
      }
      receive = (line) => {
        lines.push(line)
        if (line.includes('CRITICAL ERROR')) fail?.(new Error(line))
        if (done(line)) {
          clearTimeout(timer)
          receive = undefined
          fail = undefined
          resolve(lines)
        }
      }
      process.stdin.write(`${text}\n`)
    })
  const hello = await command('uci', (line) => line === 'uciok')
  const name = hello.find((line) => line.startsWith('id name '))?.slice(8)
  if (!name?.startsWith('Stockfish')) {
    process.kill()
    throw new Error('A Stockfish UCI binary is required')
  }
  await command(
    'setoption name Threads value 1\nsetoption name Hash value 32\nisready',
    (line) => line === 'readyok',
  )
  return {
    name,
    async analyze(
      game: Chess,
      multipv: number,
      nodes: number,
    ): Promise<EngineLine[]> {
      if (game.isGameOver()) return []
      const count = Math.min(multipv, game.moves().length)
      await command(
        `ucinewgame\nsetoption name MultiPV value ${count}\nisready`,
        (line) => line === 'readyok',
      )
      const moves = game
        .history({ verbose: true })
        .map((move) => `${move.from}${move.to}${move.promotion ?? ''}`)
      const lines = await command(
        `position startpos moves ${moves.join(' ')}\ngo nodes ${nodes}`,
        (line) => line.startsWith('bestmove '),
      )
      return parseEngineOutput(lines, count)
    },
    close() {
      receive = undefined
      fail = undefined
      process.stdin.end('quit\n')
      output.close()
    },
  }
}
