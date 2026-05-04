import { describe, expect, it, vi } from 'vitest'
import { useLockedActions } from '~/composables/useLockedActions'

describe('useLockedActions', () => {
  it('proceeds immediately when the gate is open', () => {
    const { showLockedSheet, lockedAction, guard } = useLockedActions()
    const onProceed = vi.fn()
    guard({ isOpen: true, label: 'Two Knights', onProceed })
    expect(onProceed).toHaveBeenCalledTimes(1)
    expect(showLockedSheet.value).toBe(false)
    expect(lockedAction.value).toBeNull()
  })

  it('opens the sheet and stashes the action when the gate is closed', () => {
    const { showLockedSheet, lockedAction, guard } = useLockedActions()
    const onProceed = vi.fn()
    guard({ isOpen: false, label: 'Two Knights', onProceed })
    expect(onProceed).not.toHaveBeenCalled()
    expect(showLockedSheet.value).toBe(true)
    expect(lockedAction.value?.label).toBe('Two Knights')
  })

  it('confirmProceed runs the stashed action and closes the sheet', () => {
    const { showLockedSheet, lockedAction, guard, confirmProceed } = useLockedActions()
    const onProceed = vi.fn()
    guard({ isOpen: false, label: 'Two Knights', onProceed })
    confirmProceed()
    expect(onProceed).toHaveBeenCalledTimes(1)
    expect(showLockedSheet.value).toBe(false)
    // lockedAction stays populated for the duration of the dialog close animation;
    // callers can call reset() when they need the slot empty again.
    expect(lockedAction.value).not.toBeNull()
  })

  it('confirmProceed is a no-op when no action is stashed', () => {
    const { showLockedSheet, confirmProceed } = useLockedActions()
    confirmProceed()
    expect(showLockedSheet.value).toBe(false)
  })

  it('reset clears both the stashed action and the sheet flag', () => {
    const { showLockedSheet, lockedAction, guard, reset } = useLockedActions()
    guard({ isOpen: false, label: 'X', onProceed: () => {} })
    reset()
    expect(showLockedSheet.value).toBe(false)
    expect(lockedAction.value).toBeNull()
  })
})
