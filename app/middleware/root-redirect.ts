export default defineNuxtRouteMiddleware((to) => {
  if (to.path !== '/') return
  return navigateTo('/learn')
})
