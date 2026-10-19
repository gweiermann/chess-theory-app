# Chess Theory

A browser application for learning the Italian Game with guided practice, recall review, and branching free play. The interface is German; code and domain identifiers are English.

## Run locally

Use Node.js 24 and the pnpm version declared in `package.json`.

```sh
pnpm install --frozen-lockfile
pnpm data
pnpm dev
```

The development server listens on `0.0.0.0:3040`. Open `http://localhost:3040` on the PC or `http://<PC-LAN-IP>:3040` on a phone connected to the same network. The host firewall must permit the connection.

For the production static build:

```sh
pnpm generate
node scripts/serve-site.mjs --dir .output/public --host 0.0.0.0 --port 3040
```

## Module ownership

| Module      | Owns                                                                                      |
| ----------- | ----------------------------------------------------------------------------------------- |
| `board`     | Accepted chess position, move attempts, history, checkpoints, input, arrows, and premoves |
| `openings`  | Validated opening data, lazy family loading, and sequence-based repertoires               |
| `learning`  | Versioned learner storage, progress, activity, settings, and saved sessions               |
| `selection` | Lesson choice, opponent replies, exploration suggestions, and review priorities           |
| `training`  | Guided/review/sparring policies, round coordination, cancellation, and outcome recording  |

Each module exposes an `index.ts` entry point and `public.ts` contracts. Vue components render snapshots and emit commands. Core modules have no Nuxt runtime dependency. Training rejects stale asynchronous work using round generations; the board uses revision checks to protect accepted state.

The mobile training screen fits its viewport with a square board and compact controls. Board input supports touch/mouse pointer dragging, tap selection, keyboard input, and premoves; classic SVG piece assets have attribution in `public/pieces/cburnett`. Premoves are queued in selection order. Each opponent reply revalidates and immediately plays the next queued move. An unfinished selection or drag survives that reply and the automatic execution of a previous premove, while game resets and history browsing cancel it. An impossible queued move discards the remaining sequence. Automated game tests use accessible square buttons directly; the game has no move-command input. Pieces glide between accepted positions, including history changes and resets. The visual layer keeps stable piece identities without delaying accepted state or input, retargets unfinished transitions, and settles completed drags directly at their destination. Reduced-motion preferences disable these transitions.

Guided learning uses unique maximal SAN paths: shorter named prefixes and duplicate move sequences are not separate lessons. The first recommendation is the longest available path. Subsequent recommendations prefer the deepest shared prefix with the last practiced line, then the longest remaining sibling. Mastery is side-specific. The library opens directly to Italian variations and filters open, learned, or all complete lines.

Free play accepts every continuation in the Italian tree, including unfamiliar material. Opponent replies prefer the greatest remaining depth; equal-length options retain familiarity and response-memory weighting. Help follows the longest available continuation. New responses are graded as new material and do not count as forgotten moves or earn guided mastery. Solution hints and exploration arrows have separate learning grades.

## Data and browser state

The offline pipeline reads vendored TSV files in `data/source`, validates PGN with chess.js, and writes `public/data`. It delivers only the 187 Italian Game records, which contain 114 unique maximal paths. Other generated families are removed on rebuild. The original vendored TSV sources remain intact for attribution and stable record identities. Record identity is independent of display names. `public/data/manifest.json` contains source attribution, content hashes, and record counts. The upstream commit is unknown; source content is pinned by SHA-256.

Opening browsing and legal continuation paths are separate structures. Repertoires match complete SAN prefixes and do not merge transpositions.

Learner state lives in IndexedDB under `chess-theory-rebuild-v1`. State has explicit schema validation; saved sessions also identify the dataset revision. The Italian-only catalog has its own revision; obsolete sessions are not offered for resume, and profile counts exclude removed openings and prefix-only records. The application does not import prototype localStorage. Invalid or incompatible state is excluded from active training, and storage errors are visible.

## Verification

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm exec playwright install chromium
pnpm test:e2e
pnpm test:storybook
```

Unit tests cover module rules and data validation. Integration tests cover board/training coordination, repository behavior, and Vue interactions. E2E tests run against a generated static build in desktop and phone Chromium configurations. Storybook browser tests observe the actual completion of story interaction checks. Screenshots, video, and traces are disabled.

`pnpm storybook` opens component development on port 6006. `pnpm build-storybook` creates a standalone component catalog. Stories include an interactive move/reset animation demo with castling, en passant and promotion, board input, arrows, promotion, direct Italian lesson recommendations, library loading failures, learned variations, settings validation, and save/resume interactions.

CI runs all checks on Node.js 24. GitHub Pages deployment builds the exact successful main-branch CI revision with the configured repository base URL. Manual deployment runs the same verification before publishing. Stockfish mistake-punishment exercises and full-game play are not implemented.
