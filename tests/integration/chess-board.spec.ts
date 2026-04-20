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

  it('drawHintForSan returns true and resolves the SAN to a real arrow on the board', async () => {
    const wrapper = mount(ChessBoard, {
      props: { orientation: 'white', playerColor: 'white' },
      attachTo: document.body,
    })
    await waitForReady(wrapper)

    const readyEvents = wrapper.emitted('ready') as Array<[unknown]>
    const api = readyEvents[0]![0] as { drawMove: ReturnType<typeof vi.fn> }
    const drawSpy = vi.spyOn(api, 'drawMove')

    const cmp = wrapper.vm as unknown as {
      drawHintForSan: (san: string) => boolean
    }
    expect(cmp.drawHintForSan('e4')).toBe(true)
    expect(drawSpy).toHaveBeenCalledWith('e2', 'e4', expect.any(String))

    expect(cmp.drawHintForSan('not-a-real-move')).toBe(false)

    wrapper.unmount()
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
