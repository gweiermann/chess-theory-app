import { ref } from 'vue'

/** Own registration so only the learner's update action can reload a round. */
export default defineNuxtPlugin(() => {
  const available = ref(false)
  let waiting: ServiceWorker | null = null
  let applying = false
  const apply = () => {
    if (!waiting || applying) return
    applying = true
    navigator.serviceWorker.addEventListener(
      'controllerchange',
      () => window.location.reload(),
      { once: true },
    )
    waiting.postMessage({ type: 'SKIP_WAITING' })
  }

  if (
    !import.meta.dev &&
    window.isSecureContext &&
    'serviceWorker' in navigator
  ) {
    const base = useRuntimeConfig().app.baseURL
    void navigator.serviceWorker
      .register(`${base}sw.js`, { scope: base, updateViaCache: 'none' })
      .then((registration) => {
        const inspect = () => {
          waiting = registration.waiting
          available.value = !!waiting && !!navigator.serviceWorker.controller
        }
        inspect()
        registration.addEventListener('updatefound', () => {
          registration.installing?.addEventListener('statechange', inspect)
        })
      })
      .catch((error: unknown) => {
        // Registration can fail offline; the current app and saved state still work.
        console.warn('Offline installation could not be updated.', error)
      })
  }

  return { provide: { appUpdates: { available, apply } } }
})
