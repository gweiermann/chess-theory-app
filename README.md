# Chess Theory Drill

A static web app for memorizing chess opening lines fast. Pick an opening
(e.g. 1.e4), drill each line one move at a time, then repeat the full
sequence ten times before moving to the next variation.

## Stack

- [Nuxt 4](https://nuxt.com) + Vue 3 (`ssr: false`, GitHub Pages preset)
- [Nuxt UI 4](https://ui.nuxt.com) (Tailwind v4)
- [`vue3-chessboard`](https://github.com/qwerty084/vue3-chessboard) +
  [`chess.js`](https://github.com/jhlywa/chess.js)
- Lichess opening database
  ([`lichess-org/chess-openings`](https://github.com/lichess-org/chess-openings))
- Vitest, Vue Test Utils, Playwright

## Architecture

```
app/
  domain/        Pure functions: types, line/tree/session/progress logic
    data/        Pure dataset transformation (TSV -> OpeningsDataset)
  infra/         Side-effectful adapters: openings loader, progress repository
  composables/   Vue composables that wire domain + infra to UI state
  components/    Reusable components (ChessBoard, SessionHud, TopicProgress)
  pages/         Three pages: index, topic/[move], topic/[move]/practice
  plugins/       Nuxt plugins (provides `$repositories`)
scripts/         Build-time data generation (downloads Lichess TSVs)
tests/
  unit/          Pure-function tests (domain + data + infra)
  integration/   Composable tests
  e2e/           Playwright tests against the built static site
```

## Local development

```bash
pnpm install
pnpm dev          # downloads opening data + starts the dev server
```

## Tests

```bash
pnpm test                # unit + integration
pnpm test:coverage       # with coverage
pnpm test:e2e            # Playwright (builds site first)
```

## Deploy to GitHub Pages

The deployment workflow at
[.github/workflows/deploy.yml](.github/workflows/deploy.yml) generates the
static site with the right `baseURL` for GitHub Pages and uploads it via
`actions/deploy-pages`. Enable Pages with the "GitHub Actions" source in
your repository settings.
