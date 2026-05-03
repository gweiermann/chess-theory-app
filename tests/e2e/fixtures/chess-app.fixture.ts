import { test as base, expect } from '@playwright/test'
import { ActivityPage } from '../pages/activity.page'
import { AppLayout } from '../pages/app-layout.page'
import { FamilyTreePage } from '../pages/family-tree.page'
import { LearnHubPage } from '../pages/learn-hub.page'
import { LearnPlayPage } from '../pages/learn-play.page'
import { OpeningsIndexPage } from '../pages/openings-index.page'
import { OpeningsTopicPage } from '../pages/openings-topic.page'
import { ProfilePage } from '../pages/profile.page'

type ChessAppFixtures = {
  freshStorage: undefined
  appLayout: AppLayout
  learnHub: LearnHubPage
  learnPlay: LearnPlayPage
  openingsIndex: OpeningsIndexPage
  openingsTopic: OpeningsTopicPage
  familyTree: FamilyTreePage
  profile: ProfilePage
  activity: ActivityPage
}

export const test = base.extend<ChessAppFixtures>({
  freshStorage: [async ({ context }, use) => {
    await context.addInitScript(() => {
      try {
        const marker = 'e2eFreshStoragePrimed'
        if (window.sessionStorage.getItem(marker) === '1') {
          return
        }
        window.sessionStorage.setItem(marker, '1')
        window.localStorage.clear()
        for (let i = window.sessionStorage.length - 1; i >= 0; i -= 1) {
          const k = window.sessionStorage.key(i)
          if (k && k !== marker) {
            window.sessionStorage.removeItem(k)
          }
        }
      } catch {
        /* noop */
      }
    })
    await use(undefined)
  }, { auto: true }],

  appLayout: async ({ page }, use) => {
    await use(new AppLayout(page))
  },
  learnHub: async ({ page }, use) => {
    await use(new LearnHubPage(page))
  },
  learnPlay: async ({ page }, use) => {
    await use(new LearnPlayPage(page))
  },
  openingsIndex: async ({ page }, use) => {
    await use(new OpeningsIndexPage(page))
  },
  openingsTopic: async ({ page }, use) => {
    await use(new OpeningsTopicPage(page))
  },
  familyTree: async ({ page }, use) => {
    await use(new FamilyTreePage(page))
  },
  profile: async ({ page }, use) => {
    await use(new ProfilePage(page))
  },
  activity: async ({ page }, use) => {
    await use(new ActivityPage(page))
  },
})

export { expect }
