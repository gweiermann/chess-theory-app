import { describe, expect, it, vi } from 'vitest'
import { createHttpOpeningsLoader } from '~/infra/openings-loader'
import type { Topic } from '~/domain/types'
import type { OpeningsIndex } from '~/domain/data/split-dataset'

const sampleIndex: OpeningsIndex = {
  generatedAt: '2026-01-01T00:00:00.000Z',
  topics: [
    {
      id: 'e4',
      label: '1.e4',
      firstMove: 'e4',
      totalFamilies: 1,
      totalLines: 1,
      familyIds: ['italian-game'],
    },
  ],
}

const sampleTopic: Topic = {
  id: 'e4',
  label: '1.e4',
  firstMove: 'e4',
  families: [
    {
      id: 'italian-game',
      name: 'Italian Game',
      topicId: 'e4',
      tree: { name: 'Italian Game', lineId: null, children: {} },
      lines: [],
    },
  ],
}

const makeFetch = (responses: Record<string, unknown>) =>
  vi.fn(async (url: string) => {
    const body = responses[url]
    if (body === undefined) {
      return { ok: false, status: 404, statusText: 'Not Found' } as Response
    }
    return {
      ok: true,
      status: 200,
      json: async () => body,
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

  it('loads a single topic on demand', async () => {
    const fetchImpl = makeFetch({
      'https://example.test/data/openings/topics/e4.json': sampleTopic,
    })
    const loader = createHttpOpeningsLoader(
      'https://example.test/data/openings',
      fetchImpl as unknown as typeof fetch,
    )

    const topic = await loader.loadTopic('e4')
    expect(topic.id).toBe('e4')
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://example.test/data/openings/topics/e4.json',
    )
  })

  it('caches each topic separately', async () => {
    const fetchImpl = makeFetch({
      'https://example.test/data/openings/topics/e4.json': sampleTopic,
    })
    const loader = createHttpOpeningsLoader(
      'https://example.test/data/openings',
      fetchImpl as unknown as typeof fetch,
    )

    await loader.loadTopic('e4')
    await loader.loadTopic('e4')
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('throws a useful error when the topic is missing', async () => {
    const fetchImpl = makeFetch({})
    const loader = createHttpOpeningsLoader(
      'https://example.test/data/openings',
      fetchImpl as unknown as typeof fetch,
    )
    await expect(loader.loadTopic('missing')).rejects.toThrow(/missing/)
  })

  it('deduplicates inflight requests for the same topic', async () => {
    let resolveJson!: (value: Topic) => void
    const jsonReady = new Promise<Topic>((r) => {
      resolveJson = r
    })
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: () => jsonReady,
    })) as unknown as typeof fetch
    const loader = createHttpOpeningsLoader(
      'https://example.test/data/openings',
      fetchImpl,
    )
    const a = loader.loadTopic('e4')
    const b = loader.loadTopic('e4')
    resolveJson(sampleTopic)
    await Promise.all([a, b])
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })
})
