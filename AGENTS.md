# Working in this repository

Read the relevant module's `public.ts` and `index.ts` before changing its behavior. Import other modules through their public entry points; ESLint enforces this boundary. `README.md` describes implemented ownership, data, and verification commands.

The Board module owns accepted chess state. Training owns teaching decisions and asynchronous round effects. Components render snapshots and emit commands. Browser tests and agents interact with labeled board-square buttons; do not add test-only move inputs or other automation controls to learner-facing screens. Preserve revision checks and round-generation cancellation when changing move, reset, history, or premove flows.

Use English identifiers and domain values; learner-facing text is German. Keep reusable UI states in Storybook. Browser state and opening data must pass their version and runtime-validation boundaries before use.

Write tests through public seams, following one failing test, implementation, and verification at a time. Regressions involving timers or storage need integration coverage; user-flow changes need browser verification. Consult `package.json` for commands. Complete the relevant checks and report any failures.

Generate opening artifacts from `data/source` with the pipeline rather than editing generated JSON. Preserve source records independently of names and browsing placement.

Never stage or commit changes. Take screenshots only when the user explicitly requests them. Keep documentation factual about the implemented application; update affected facts when behavior changes.
