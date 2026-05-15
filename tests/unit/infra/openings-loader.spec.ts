import { describe, expect, it, vi } from 'vitest'
import { createHttpOpeningsLoader } from '~/infra/openings-loader'
import { treeFileToFamily } from '~/domain/data/family-tree-file'
import type { Topic } from '~/domain/types'
import type { OpeningsIndex, TopicIndexFile } from '~/domain/data/split-dataset'

const sampleIndex: OpeningsIndex = {
  generatedAt: '2026-01-01T00:00:00.000Z',
  topics: [
    {
      id: 'e4',
      label: '1.e4',
      firstMove: 'e4',
      familyCount: 1,
      lineCount: 1,
    },
  ],
}

const sampleTopicIndex: TopicIndexFile = {
  id: 'e4',
  label: '1.e4',
  firstMove: 'e4',
  families: [
    {
      id: 'italian-game',
      name: 'Italian Game',
      category: 'opening',
      lineCount: 1,
    },
  ],
}

const sampleItalianWire = {
  id: 'italian-game',
  name: 'Italian Game',
  category: 'opening' as const,
  label: 'Italian Game',
  line: {
    id: 'C50-italian-game',
    eco: 'C50',
    fullName: 'Italian Game',
    pgn: '1. e4 e5 2. Nf3 Nc6 3. Bc4',
    sanMoves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4'],
    userSide: 'white' as const,
  },
  children: [],
}

const sampleTopic: Topic = {
  id: 'e4',
  label: '1.e4',
  firstMove: 'e4',
  families: [treeFileToFamily(sampleItalianWire)],
}

const makeFetch = (responses: Record<string, unknown>) =>
  vi.fn(async (url: string) => {
    const body = responses[url]
    if (body === undefined) {
      return { ok: false, status: 404, statusText: 'Not Found' } as Response
    }
    const bodyJson = (): string => JSON.stringify(body)
    return {
      ok: true,
      status: 200,
      json: async () => body,
      text: bodyJson,
    } as unknown as Response
  })

describe('createHttpOpeningsLoader', () => {
  it('loads the index from the configured base URL', async () => {
    const fetchImpl = makeFetch({
      'https://example.test/data/openings/index.json': sampleIndex,
    })
    const loader = createHttpOpeningsLoader(
      'https://example.test/data/openings',
      fetchImpl as unknown as typeof fetch,
    )

    const index = await loader.loadIndex()
    expect(index).toEqual(sampleIndex)
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://example.test/data/openings/index.json',
    )
  })

  it('caches the index across calls', async () => {
    const fetchImpl = makeFetch({
      'https://example.test/data/openings/index.json': sampleIndex,
    })
    const loader = createHttpOpeningsLoader(
      'https://example.test/data/openings',
      fetchImpl as unknown as typeof fetch,
    )

    await loader.loadIndex()
    await loader.loadIndex()
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('loads a topic shell plus each family file', async () => {
    const fetchImpl = makeFetch({
      'https://example.test/data/openings/e4/index.json': sampleTopicIndex,
      'https://example.test/data/openings/e4/families/italian-game.json':
        sampleItalianWire,
    })
    const loader = createHttpOpeningsLoader(
      'https://example.test/data/openings',
      fetchImpl as unknown as typeof fetch,
    )

    const topic = await loader.loadTopic('e4')
    expect(topic).toEqual(sampleTopic)
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://example.test/data/openings/e4/index.json',
    )
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://example.test/data/openings/e4/families/italian-game.json',
    )
  })

  it('caches each topic separately', async () => {
    const fetchImpl = makeFetch({
      'https://example.test/data/openings/e4/index.json': sampleTopicIndex,
      'https://example.test/data/openings/e4/families/italian-game.json':
        sampleItalianWire,
    })
    const loader = createHttpOpeningsLoader(
      'https://example.test/data/openings',
      fetchImpl as unknown as typeof fetch,
    )

    await loader.loadTopic('e4')
    await loader.loadTopic('e4')
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })

  it('throws TopicNotFoundError when the topic shell is missing', async () => {
    const fetchImpl = makeFetch({})
    const loader = createHttpOpeningsLoader(
      'https://example.test/data/openings',
      fetchImpl as unknown as typeof fetch,
    )
    await expect(loader.loadTopic('missing')).rejects.toMatchObject({
      name: 'TopicNotFoundError',
      topicId: 'missing',
    })
  })

  it('maps SPA HTML fallback (200 + HTML document) on topic shell URL to TopicNotFoundError', async () => {
    const fetchImpl = vi.fn(async (url: string) => {
      if (url.endsWith('/ghost-topic/index.json')) {
        return {
          ok: true,
          status: 200,
          text: async () =>
            `<!DOCTYPE html><html lang="en"><body><div id="__nuxt"></div></body></html>`,
        } as Response
      }
      return {
        ok: false,
        status: 404,
        statusText: 'Not Found',
      } as Response
    }) as unknown as typeof fetch
    const loader = createHttpOpeningsLoader(
      'https://example.test/data/openings',
      fetchImpl,
    )
    await expect(loader.loadTopic('ghost-topic')).rejects.toMatchObject({
      name: 'TopicNotFoundError',
      topicId: 'ghost-topic',
    })
  })

  it('deduplicates inflight requests for the same topic', async () => {
    let resolveShell!: (value: TopicIndexFile) => void
    const shellReady = new Promise<TopicIndexFile>((r) => {
      resolveShell = r
    })
    let resolveFamily!: (value: typeof sampleItalianWire) => void
    const familyReady = new Promise<typeof sampleItalianWire>((r) => {
      resolveFamily = r
    })
    const fetchImpl = vi.fn(async (url: string) => {
      if (url.endsWith('/e4/index.json')) {
        return {
          ok: true,
          status: 200,
          json: () => shellReady,
          text: async () => JSON.stringify(await shellReady),
        } as unknown as Response
      }
      if (url.includes('/e4/families/italian-game.json')) {
        return {
          ok: true,
          status: 200,
          json: () => familyReady,
          text: async () => JSON.stringify(await familyReady),
        } as unknown as Response
      }
      return { ok: false, status: 404, statusText: 'Not Found' } as Response
    }) as unknown as typeof fetch
    const loader = createHttpOpeningsLoader(
      'https://example.test/data/openings',
      fetchImpl,
    )
    const a = loader.loadTopic('e4')
    const b = loader.loadTopic('e4')
    resolveShell(sampleTopicIndex)
    resolveFamily(sampleItalianWire)
    await Promise.all([a, b])
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })
})
