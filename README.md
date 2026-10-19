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

## Install and use offline

The production app is an installable PWA at https://gweiermann.github.io/chess-theory-app/. On Android, use the browser's install/add-to-home-screen action; on iOS, use Safari's Share → Add to Home Screen. The manifest, standalone launch, regular and maskable icons, and Apple touch icon use the deployment base URL.

After the first successful online load installs the service worker, the app shell, all routes, chess pieces, and Italian opening data are available offline. Progress continues to use IndexedDB. Each production build precaches its own revision of all app and course assets together. Updates wait rather than reloading an active round; when an update is ready, Profil offers “App aktualisieren”. Closing all app tabs also allows a waiting update to activate. Old precaches are removed when the new worker activates.

Service workers are disabled in `pnpm dev`. Installation and offline support require HTTPS, except on localhost; the phone's plain HTTP LAN URL remains suitable for development but cannot install the PWA. Test a generated production build to verify offline behavior. `pnpm pwa:icons` regenerates the checked-in PNG icons from the app's SVG rook mark using installed Playwright Chromium.

## Module ownership

| Module      | Owns                                                                                      |
| ----------- | ----------------------------------------------------------------------------------------- |
| `board`     | Accepted chess position, move attempts, history, checkpoints, input, arrows, and premoves |
| `openings`  | Validated opening data, lazy family loading, and sequence-based repertoires               |
| `learning`  | Versioned learner storage, progress, activity, settings, and saved sessions               |
| `mistakes`  | Validated Stockfish mistake branches, analysis revisions, and exact-history lookup        |
| `selection` | Lesson choice, opponent replies, exploration suggestions, and review priorities           |
| `training`  | Guided/review/sparring policies, round coordination, cancellation, and outcome recording  |

Each module exposes an `index.ts` entry point and `public.ts` contracts. Vue components render snapshots and emit commands. Core modules have no Nuxt runtime dependency. Training rejects stale asynchronous work using round generations; the board uses revision checks to protect accepted state.

The mobile training screen fits its viewport with a square board and compact controls. Board input supports touch/mouse pointer dragging, tap selection, keyboard input, and premoves; classic SVG piece assets have attribution in `public/pieces/cburnett`. Premoves are queued in selection order. Each opponent reply revalidates and immediately plays the next queued move. An unfinished selection or drag survives that reply and the automatic execution of a previous premove, while game resets and history browsing cancel it. An impossible queued move discards the remaining sequence. Automated game tests use accessible square buttons directly; the game has no move-command input. Pieces glide between accepted positions, including history changes and resets. The visual layer keeps stable piece identities without delaying accepted state or input, retargets unfinished transitions, and settles completed drags directly at their destination. Reduced-motion preferences disable these transitions.

Guided learning uses unique maximal SAN paths: shorter named prefixes and duplicate move sequences are not separate lessons. The first recommendation is the shortest complete path. Subsequent recommendations first prefer the deepest shared prefix with the previous lesson, then the shortest remaining sibling at that proximity. The home screen and library share this ordering. Reopening learning uses the most recently mastered line for that side; an unfinished old lesson does not establish the branch preference. Mastery is side-specific. The library opens directly to Italian variations and filters open, learned, or all complete lines.

Free play accepts every continuation in the Italian tree, including unfamiliar material. Selection prefers unseen responses and opponent branches; remaining depth breaks ties, so play can still continue to complete leaves. The selected target guides opponent replies until the learner chooses a different branch. After three completed exploration rounds, one familiar round is offered for review, with priority for due or difficult responses. Returning after a day also offers one review. History is side-specific and shared by both free modes. Previously seen responses stop showing as new even when guided learning is incomplete. A complete unassisted, error-free sparring round earns mastery; helped or retried responses still count as seen. Observed opponent moves inform variety without entering accuracy statistics. Solution hints and exploration arrows have separate learning grades.

## Experimental mistake training

The third home card, **Fehler ausnutzen**, shares free play's complete Italian repertoire. The opponent can deviate at eligible positions during a line or after a terminal theory position. An amber phase indicator marks the transition out of theory. The learner plays a precomputed continuation for one to three of their own moves against Stockfish's prepared best replies, with the usual second attempt and solution arrow. Only the generated continuations are accepted; another legal move can still be playable. Theory premoves are cleared at the transition, without counting as mistakes. Completing an early mistake exercise does not award mastery for the unfinished theory line. Unseen slips take precedence during exploration; repeated slips are deferred until later theory positions where possible. Review remains available through the smaller home action and library.

The checked-in Stockfish 19 artifact contains 673 mistake branches and 829 continuations from 362 of 421 inspected positions. Its continuations comprise 233 one-move, 127 two-move and 469 three-move learner responses.

The `mistakes` module validates the artifact against the current opening revision and exposes exact-history lookup and branch lookup. Training owns the active branch and phase. Saved challenges include both the branch ID and analysis revision; incompatible or illegal resumes restart safely. Opening mode and analysis revisions remain separate, so rebuilding engine analysis does not invalidate ordinary lessons. The PWA precaches the checked-in analysis JSON along with the course; no engine runs on the phone.

`pnpm data:mistakes` is an explicit offline generation command requiring `STOCKFISH_PATH`. Normal data/build commands consume the artifact without downloading or running an engine. The generator uses the pinned official [Stockfish 19 release](https://github.com/official-stockfish/Stockfish/releases/tag/sf_19), records the executable SHA-256, and runs independent single-thread searches with 32 MiB hash, cleared search state, fixed node budgets and stable ordering. Four engine processes analyze independent positions; results are sorted before hashing. The executable is local tooling, excluded from Git and production assets. Reproducibility requires the same engine binary/CPU implementation; searches do not use wall-clock time. A local analysis cache makes reruns inexpensive.

Generation enumerates every unique SAN prefix from the Italian setup through every maximal leaf. A 60,000-node MultiPV search screens legal deviations; 250,000-node searches verify the baseline, responses and resulting positions. A retained slip must lose at least 150 engine centipawns against the opponent's best play and give the learner at least +100 centipawns. Known theory continuations are excluded. Up to two slips per position and two near-best root responses within 35 centipawns are retained. Responses require a completed search depth of at least 10. Complete UCI batches are kept together so interrupted MultiPV output cannot mix ranks from different reports.

Continuations follow the engine principal variation and stop after material has been converted and the opponent has replied, checkmate, or three learner moves. Their final position is searched again and must retain at least +100 centipawns and stay within 80 centipawns of the initial advantage. Scores are engine estimates at finite search budgets, not proof of a forced win. Candidate screening is deliberately bounded: not every possible mistake or equally good response is represented. The mode samples an available slip with 30% probability on an opponent turn and forces an available terminal slip; a path without a verified opportunity finishes normally.

To regenerate on PowerShell after downloading the official engine locally:

```powershell
$env:STOCKFISH_PATH = 'C:\path\to\stockfish.exe'
pnpm data
pnpm data:mistakes
```

## Data and browser state

The offline pipeline reads vendored TSV files in `data/source`, validates PGN with chess.js, and writes `public/data`. It delivers 184 records starting with the Italian move order, which contain 109 unique maximal paths. Course membership is derived from the shortest exact-name source entry for Italian Game (1. e4 e5 2. Nf3 Nc6 3. Bc4), then includes every source record with that exact SAN prefix, regardless of its position name. Missing or ambiguous shortest anchors fail the build. This excludes nine Italian-labeled records reached through the Scotch move order and includes six Italian-starting records named for other reached positions. Source names and ECO codes describe the reached position; course placement describes the move order. The pipeline does not infer course membership from ECO codes or display-name prefixes, and does not merge transpositions by board position. A changed selection policy changes the dataset revision so previous active sessions are not resumed against a different repertoire. Other generated families are removed on rebuild. The original vendored TSV sources remain intact for attribution and stable record identities. Record identity is independent of display names. `public/data/manifest.json` contains source attribution, content hashes, and record counts. The upstream commit is unknown; source content is pinned by SHA-256.

Opening browsing and legal continuation paths are separate structures. Repertoires match complete SAN prefixes and do not merge transpositions.

Learner state lives in IndexedDB under `chess-theory-rebuild-v1`. State has explicit schema validation; saved sessions also identify the dataset revision. The Italian-only catalog has its own revision; obsolete sessions are not offered for resume, and profile counts exclude removed openings and prefix-only records. The application does not import prototype localStorage. Invalid or incompatible state is excluded from active training, and storage errors are visible.

## Verification

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm exec playwright install chromium
pnpm test:e2e
pnpm test:pwa
pnpm test:storybook
```

Unit tests cover module rules and data validation. Integration tests cover board/training coordination, repository behavior, and Vue interactions. E2E tests run against a generated static build in desktop and phone Chromium configurations. Dedicated PWA tests build under the GitHub Pages subdirectory and verify install metadata, actual icon decoding, worker scope, offline library loading, gameplay and deep-link reloads. Storybook browser tests observe the actual completion of story interaction checks. Screenshots, video, and traces are disabled.

`pnpm storybook` opens component development on port 6006. `pnpm build-storybook` creates a standalone component catalog. Stories include an interactive move/reset animation demo with castling, en passant and promotion, board input, arrows, promotion, direct Italian lesson recommendations, library loading failures, learned variations, settings validation, and save/resume interactions.

CI runs all checks on Node.js 24. GitHub Pages deployment builds the exact successful main-branch CI revision with the configured repository base URL. Manual deployment runs the same verification before publishing. Full-game play is not implemented.
