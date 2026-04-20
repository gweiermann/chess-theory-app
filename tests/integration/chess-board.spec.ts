import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { nextTick } from 'vue'
import ChessBoard from '~/components/ChessBoard.vue'

beforeAll(() => {
  if (!HTMLElement.prototype.animate) {
    HTMLElement.prototype.animate = vi.fn().mockReturnValue({
      finished: Promise.resolve(),
      cancel: vi.fn(),
      finish: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }) as unknown as Element['animate']
  }
  vi.stubGlobal(
    'getComputedStyle',
    () => ({ getPropertyValue: () => '0px' }) as unknown as CSSStyleDeclaration,
  )
})

afterEach(() => {
  vi.clearAllTimers()
})

const waitForReady = async (
  wrapper: ReturnType<typeof mount>,
): Promise<void> => {
  for (let i = 0; i < 20; i += 1) {
    await flushPromises()
    await nextTick()
    if (wrapper.emitted('ready')) return
  }
  throw new Error('ChessBoard never emitted ready')
}

describe('ChessBoard', () => {
  it('does not emit user-move when the opponent move is played programmatically', async () => {
    const wrapper = mount(ChessBoard, {
      props: { orientation: 'white', playerColor: 'white' },
      attachTo: document.body,
    })
    await waitForReady(wrapper)

    const cmp = wrapper.vm as unknown as {
      playOpponentSan: (san: string) => boolean
    }

    const ok = cmp.playOpponentSan('e4')
    expect(ok).toBe(true)

    await flushPromises()
    await nextTick()

    const userMoves = wrapper.emitted('user-move') ?? []
    expect(userMoves).toHaveLength(0)

    wrapper.unmount()
  })

  it('drawHintForSan returns true and schedules an arrow shape for the SAN on the board', async () => {
    const rafCallbacks: Array<FrameRequestCallback> = []
    const originalRaf = window.requestAnimationFrame
    window.requestAnimationFrame = ((cb: FrameRequestCallback) => {
      rafCallbacks.push(cb)
      return rafCallbacks.length
    }) as typeof window.requestAnimationFrame

    const wrapper = mount(ChessBoard, {
      props: { orientation: 'white', playerColor: 'white' },
      attachTo: document.body,
    })
    await waitForReady(wrapper)

    const readyEvents = wrapper.emitted('ready') as Array<[unknown]>
    const api = readyEvents[0]![0] as {
      setShapes: (shapes: Array<unknown>) => void
    }
    const shapesSpy = vi.spyOn(api, 'setShapes')

    const cmp = wrapper.vm as unknown as {
      drawHintForSan: (san: string) => boolean
    }
    expect(cmp.drawHintForSan('e4')).toBe(true)

    // drawHintForSan clears any previously rendered shapes immediately so the
    // chessground diff-hash is forced to recompute on the next frame.
    expect(shapesSpy).toHaveBeenNthCalledWith(1, [])

    // The actual arrow is scheduled for the next animation frame so the board
    // has fully measured its bounds before chessground computes the SVG.
    expect(rafCallbacks.length).toBeGreaterThanOrEqual(1)
    rafCallbacks.forEach((cb) => cb(performance.now()))

    expect(shapesSpy).toHaveBeenCalledWith([
      { orig: 'e2', dest: 'e4', brush: 'paleBlue' },
    ])

    expect(cmp.drawHintForSan('not-a-real-move')).toBe(false)

    wrapper.unmount()
    window.requestAnimationFrame = originalRaf
  })

  it('refreshBounds dispatches a document scroll event so chessground re-measures its hit-test rect', async () => {
    const wrapper = mount(ChessBoard, {
      props: { orientation: 'white', playerColor: 'white' },
      attachTo: document.body,
    })
    await waitForReady(wrapper)

    const cmp = wrapper.vm as unknown as { refreshBounds: () => void }

    const scrollEvents: Event[] = []
    const captureScroll = (event: Event): void => {
      scrollEvents.push(event)
    }
    document.addEventListener('scroll', captureScroll, { capture: true })

    cmp.refreshBounds()

    expect(scrollEvents).toHaveLength(1)
    expect(scrollEvents[0]!.type).toBe('scroll')

    document.removeEventListener('scroll', captureScroll, { capture: true })
    wrapper.unmount()
  })

  it('drawHintForSan also refreshes the cached bounds so clicks stay aligned with the rendered squares', async () => {
    const rafCallbacks: Array<FrameRequestCallback> = []
    const originalRaf = window.requestAnimationFrame
    window.requestAnimationFrame = ((cb: FrameRequestCallback) => {
      rafCallbacks.push(cb)
      return rafCallbacks.length
    }) as typeof window.requestAnimationFrame

    const wrapper = mount(ChessBoard, {
      props: { orientation: 'white', playerColor: 'white' },
      attachTo: document.body,
    })
    await waitForReady(wrapper)

    // The hint arrow typically appears together with the hint banner above
    // the board, which can shift the board's viewport position. Make sure we
    // invalidate chessground's cached rect in the same frame as the arrow
    // draw so subsequent clicks hit the correct square.
    const scrollCount = { n: 0 }
    const listener = (): void => {
      scrollCount.n += 1
    }
    document.addEventListener('scroll', listener, { capture: true })

    const cmp = wrapper.vm as unknown as {
      drawHintForSan: (san: string) => boolean
    }
    cmp.drawHintForSan('e4')
    rafCallbacks.forEach((cb) => cb(performance.now()))

    expect(scrollCount.n).toBeGreaterThanOrEqual(1)

    document.removeEventListener('scroll', listener, { capture: true })
    wrapper.unmount()
    window.requestAnimationFrame = originalRaf
  })

  it('emits user-move with the SAN when the user makes a move via the api', async () => {
    const wrapper = mount(ChessBoard, {
      props: { orientation: 'white', playerColor: 'white' },
      attachTo: document.body,
    })
    await waitForReady(wrapper)

    const readyEvents = wrapper.emitted('ready') as Array<[unknown]>
    const api = readyEvents[0]![0] as { move(san: string): boolean }
    api.move('e4')

    await flushPromises()
    await nextTick()

    const userMoves = (wrapper.emitted('user-move') ?? []) as Array<[string, unknown]>
    expect(userMoves).toHaveLength(1)
    expect(userMoves[0]![0]).toBe('e4')

    wrapper.unmount()
  })
})
