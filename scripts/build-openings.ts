#!/usr/bin/env tsx
import { mkdir, readFile, writeFile, stat } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildDatasetFromTsv } from '../app/domain/data/build-openings'
import { splitDataset } from '../app/domain/data/split-dataset'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const CACHE_DIR = resolve(ROOT, 'scripts/.cache')
const OUT_DIR = resolve(ROOT, 'public/data/openings')
const INDEX_FILE = resolve(OUT_DIR, 'index.json')
const TOPICS_DIR = resolve(OUT_DIR, 'topics')
const VOLUMES = ['a', 'b', 'c', 'd', 'e'] as const
const BASE_URL = 'https://raw.githubusercontent.com/lichess-org/chess-openings/master'

const CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000

const isFresh = async (path: string): Promise<boolean> => {
  try {
    const s = await stat(path)
    return Date.now() - s.mtimeMs < CACHE_MAX_AGE_MS
  } catch {
    return false
  }
}

const downloadVolume = async (volume: string): Promise<string> => {
  const cachePath = resolve(CACHE_DIR, `${volume}.tsv`)
  if (await isFresh(cachePath)) {
    return readFile(cachePath, 'utf8')
  }

  const url = `${BASE_URL}/${volume}.tsv`
  console.log(`[openings] fetching ${url}`)
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`Failed to download ${url}: ${res.status} ${res.statusText}`)
  }
  const tsv = await res.text()
  await mkdir(CACHE_DIR, { recursive: true })
  await writeFile(cachePath, tsv, 'utf8')
  return tsv
}

const main = async (): Promise<void> => {
  const allTsv: string[] = []
  for (const v of VOLUMES) {
    allTsv.push(await downloadVolume(v))
  }

  const merged = allTsv.join('\n')
  const dataset = buildDatasetFromTsv(merged)
  const split = splitDataset(dataset)

  await mkdir(TOPICS_DIR, { recursive: true })
  await writeFile(INDEX_FILE, JSON.stringify(split.index), 'utf8')

  for (const [topicId, topic] of split.topics) {
    const path = resolve(TOPICS_DIR, `${topicId}.json`)
    await writeFile(path, JSON.stringify(topic), 'utf8')
  }

  const totalLines = split.index.topics.reduce((s, t) => s + t.totalLines, 0)
  console.log(
    `[openings] wrote index + ${split.index.topics.length} topic files, `
    + `${totalLines} lines total → ${OUT_DIR}`,
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
