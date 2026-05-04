import { ref, type Ref } from 'vue'

export interface LockedAction {
  label: string
  onProceed: () => void
}

interface UseLockedActions {
  showLockedSheet: Ref<boolean>
  lockedAction: Ref<LockedAction | null>
  /** Run the action immediately if the gate is open; otherwise stash it and open the sheet. */
  guard: (params: { isOpen: boolean; label: string; onProceed: () => void }) => void
  confirmProceed: () => void
  reset: () => void
}

export const useLockedActions = (): UseLockedActions => {
  const showLockedSheet = ref(false)
  const lockedAction = ref<LockedAction | null>(null)

  const guard: UseLockedActions['guard'] = ({ isOpen, label, onProceed }) => {
    if (isOpen) {
      onProceed()
      return
    }
    lockedAction.value = { label, onProceed }
    showLockedSheet.value = true
  }

  const confirmProceed = (): void => {
    showLockedSheet.value = false
    lockedAction.value?.onProceed()
  }

  const reset = (): void => {
    showLockedSheet.value = false
    lockedAction.value = null
  }

  return { showLockedSheet, lockedAction, guard, confirmProceed, reset }
}
