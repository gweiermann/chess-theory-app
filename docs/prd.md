# Product Requirements Document (PRD)

**Product:** Chess Theory Drill (working title as shown in the browser)  
**Stack (context):** Nuxt 4, client-side opening data, local persistence  
**Primary language:** German (UI copy, navigation, errors)  
**Last updated:** 2026-05-03  
**Sources:** Live app walkthrough (browser), `docs/glossary.md`, and application code.

---

## 1. Vision and goals

### 1.1 Problem statement

Learners who want to **internalize chess opening theory** need structured repetition: clear variations, correct move order (SAN), feedback on mistakes, and progress they can trust across sessions—without accounts or servers for core practice.

### 1.2 Product vision

Deliver a **mobile-first drill app** that lets a user browse a curated opening library by first-move “topic,” open a named family, pick a concrete line or subtree, and **practice that line** through guided phases until it is “mastered,” with progress and settings stored locally.

### 1.3 Success criteria (measurable)

- A new user can go from launch to **first successful move** on a line in under a few minutes (after choosing a short line).
- A returning user can **resume** a recently practiced line from profile activity in two taps.
- Progress survives **browser refresh** and **revisit** (same device, same origin).
- Training feedback is **unambiguous** (correct vs wrong, expected move available via help).

### 1.4 Non-goals (current scope)

- Multiplayer, engine analysis, cloud sync, accounts, or social features.
- Full PGN import/editing by end users.
- All learning modes beyond “openings from library” (see §7 backlog).

---

## 2. Personas and jobs-to-be-done

### 2.1 Persona: “Club improver”

Wants to memorize **repertoire lines** they already chose elsewhere; needs spaced repetition–style drilling and a sense of completion per variation.

**Jobs:** “Show me what to play next,” “Tell me when I’m wrong,” “Let me skip replaying moves I already proved I know.”

### 2.2 Persona: “Explorer”

Browses many openings by first move; compares families; drills one variation deeply.

**Jobs:** “Find Italian Game lines,” “See what’s mastered vs open,” “Jump into a subtree without losing context.”

### 2.3 Persona: “Busy mobile user”

Short sessions on phone; bottom navigation; leaves mid-line.

**Jobs:** “Pick up where I left off,” “Don’t make me hunt for the line again,” “Clear controls on the board screen.”

---

## 3. Information architecture and navigation

### 3.1 Route map (as implemented)

| Path | Purpose |
|------|---------|
| `/` | Redirects to `/learn` (default entry). |
| `/learn` | Learning hub: mode selection + CTA to start play. |
| `/learn/play` | Full-screen training session (play layout, no bottom tab bar). |
| `/openings` | Topic grid (e4, d4, …): counts + family-level mastery progress. |
| `/openings/:topic` | Topic detail: search, sections (Eröffnungen / Verteidigungen / Gambits), families, “Weiter lernen,” per-family Üben. |
| `/openings/:topic/family/:family` | Family tree: breadcrumbs, `?path=` for subtree, base line card, child navigation, practice actions. |
| `/profile` | Profile home: activity link + **Parent-Züge automatisch abspielen** toggle. |
| `/profile/activity` | Recent practice list with stats and **Üben** resume. |
| `/activity` | **301** redirect to `/profile/activity` (bookmark compatibility). |

### 3.2 Global chrome

- **Bottom navigation (fixed):** Lernen · Eröffnungen · Profil (with safe-area padding).
- **Play layout:** No bottom nav; dedicated top/back and bottom action bar on the drill screen.

### 3.3 Acceptance criteria (navigation)

- Tapping a tab highlights the **current** section and navigates reliably.
- From `/learn/play`, **Verlassen** (back) returns using history where possible.
- Deep links to `/openings/.../family/...?path=...` restore **breadcrumb** and node context.

---

## 4. User journeys and functional requirements

### 4.1 Journey A — First visit: land and understand the app

**Flow:** `/` → `/learn` → read mode cards → (optional) open Eröffnungen tab.

**Requirements**

- **A1.** Home redirect must send the user to **Lernen**, not a dead end.
- **A2.** Lernen page shows a **mode list** with exactly one active mode today: *Eröffnungen lernen*; other modes visible but **disabled** with “Demnächst” badge.
- **A3.** Primary CTA **Spielen** navigates to `/learn/play` when the user is ready to drill (same mode as selected).
- **A4.** Copy explains that practice uses the **Eröffnungsbibliothek** (built-in dataset).

**Observed UX risk (QA):** On small viewports, the fixed bottom nav can **intercept taps** intended for the primary CTA; acceptance should require that primary actions are reachable (scroll affordance, layout, or z-index).

---

### 4.2 Journey B — Browse openings and pick a scope

**Flow:** `/openings` → topic card → `/openings/:topic` → optional search → open family card → `/openings/.../family/...`.

**Requirements**

- **B1.** Topic grid shows **label** (e.g. e4), **family count**, **line (Zugfolgen) count**, and **progress** “X / Y Eröffnungen” derived from whether **every line in a family** is mastered (family-level bar).
- **B2.** Loading and error states: user sees **Lade Eröffnungen…** or an error alert if index fetch fails.
- **B3.** Topic page header shows totals and **TopicProgress** for families mastered vs total.
- **B4.** **Weiter lernen** starts the **next suggested line** for the whole topic (`nextLine`); button disabled if none; copy shows **Vorschlag:** name or “Alle Zugfolgen gemeistert.”
- **B5.** Search (`Eröffnung suchen…`) matches **family name** and **any line fullName** (accent-stripped); empty state: “Keine Eröffnung gefunden für „…“.”
- **B6.** Families grouped into **three fixed buckets** in order: Eröffnungen → Verteidigungen → Gambits; empty buckets hidden.
- **B7.** Tapping a family **card** opens the family page; **Üben** on a family sets selection to **family focus** and routes to `/learn/play` (disabled when family already fully mastered).

---

### 4.3 Journey C — Family tree: understand structure and start the right drill

**Flow:** Family root → optional drill-down via `?path=Segment1/Segment2` → choose base line, subtree, or single leaf line.

**Requirements**

- **C1.** Breadcrumb reflects **topic / family / path segments**; each segment (except current) is a link.
- **C2.** Header shows **current node label** and **node mastery**: “M / N Zugfolgen gemeistert” for all lines under the node.
- **C3.** **Grundposition** card when the node has a **base line**: shows ECO/name, ply count, mastered badge or **Jetzt üben** / **Wiederholen**.
- **C4.** **Pedagogical lock:** If the base line of the current node is **not** mastered but **children** exist, sub-lines show **lock** affordance; info banner explains user must master the **Grundposition** first.
- **C5.** Locked **Üben** opens a modal: explain dependency; primary action **„[base]" jetzt üben**; secondary **Trotzdem ohne Grundposition üben** (explicit override).
- **C6.** Branch rows: tap label/chevron to **navigate deeper**; **Üben** on subtree sets **node focus** (`lineIds` + optional `prefixLineId`).
- **C7.** Leaf rows: show ECO + name + length; **Üben** sets **line focus** (with optional lock flow).
- **C8.** **Eröffnung üben** / **Alle üben** at root or node starts practice for **all lines under the node** (disabled when node fully mastered).
- **C9.** Invalid family or missing `path` node → clear **warning** alerts (unknown family, knoten nicht gefunden).

---

### 4.4 Journey D — Practice session (core product)

**Flow:** `/learn/play` with a persisted **selection** (topic + focus).

**Requirements — empty state**

- **D0.** If no selection: centered empty state **Noch keine Zugfolge ausgewählt** with explanation and **Eröffnungen öffnen** button.

**Requirements — loading / errors**

- **D1.** While topic loads: **Lade Thema…**
- **D2.** On topic load error: alert with message.

**Requirements — “all mastered” for current scope**

- **D3.** If every line in the resolved scope is mastered: success alert **Alles gemeistert** with guidance to pick a new selection.

**Requirements — active session UI**

- **D4.** Top bar: **back (Verlassen)**, centered **topic · optional family** label, **numeric progress** `mastered/total` scoped to current selection rules (topic vs family vs node vs exclusive line).
- **D5.** Line title shows **variation part** after first colon in `fullName` when present (family context already in header).
- **D6.** Phase strip shows **phase label** (Einführung, Aufbau step k/n, Wiederholung rep k/5, Fertig) and the **banner slot**; banner kinds, copy, and lifecycle are specified in **§4.4.1**.
- **D7.** Board: orientation and player color follow **`userSide`**; coordinates inside board.
- **D8.** Opponent plies: app **auto-plays** opponent SAN after short delay with **smooth on-board animation**; may chain until user to move.
- **D9.** **Premove / reset safety:** When opponent move crosses a reset boundary, board locks to avoid illegal premove races; premoves flush correctly after opponent move.

**Requirements — phases (see glossary)**

- **D10.** **Intro:** User plays prefix to reach line start when applicable; banner can prompt playing parent opening until **Grundposition**; **Hab ich vergessen** link can jump user to parent reminder flow when parent exists.
- **D11.** **Building (training):** Stepwise walk through user-relevant plies; hints on **new** steps until demonstrated.
- **D12.** **Repeating:** Fixed target repetition count (**5** reps in domain) with **full board resets** between reps; banner copy and precedence are specified in **§4.4.1**.
- **D13.** **Wrong move:** single-try feedback (undo + mistake banner), **not** a full-line reset; details and timings in **§4.4.1**.

**Requirements — bottom action bar**

- **D14.** **Hilfe:** shows expected move hint on board + banner (counts as help in analytics/progress where applicable).
- **D15.** **Zurück / Vor:** replay within current built position; disables appropriately; locks input while replaying “behind” live expected index; stepping applies plies **instantly** (no move animation).
- **D16.** **Neu starten:** restarts current line flow.
- **D17.** **Mehr:** additional actions (e.g. info modal—see code for exact menu).

**Requirements — progression**

- **D18.** Completing a line updates **progress** (status new / in progress / mastered, reps, timestamps, mistake/help counters as implemented).
- **D19.** After a line completes, app schedules **next line** in selection scope with delay; respects **parent line** relationships for prefix/skip logic (`findParentLine`, `selectLineForFocus`).
- **D20.** When selection points at a **mastered exclusive line**, broadening selection must prevent **stall** (implemented watcher)—acceptance: user never stuck with “nothing to do” while scope still has open lines.

**Requirements — profile-driven behavior**

- **D21.** **Parent-prefix autoplay** (when enabled in profile): on session start / resets, **replay mastered parent prefix** automatically so user does not manually replay setup each rep—distinct from opponent auto-reply (glossary terms must stay consistent in any future copy).

#### 4.4.1 Normative: errors, banners, and board reset

This subsection is the **authoritative UX spec** for the drill screen (implementation source: `app/domain/learn-banner.ts`, `app/pages/learn/play.vue`). Earlier bullets D6 / D12 / D13 summarize; this table is what QA and product should align on.

**Surface rules**

- **One contextual banner** above the board in a **fixed-height** strip so the board does not jump when copy wraps.
- Banners use **`role="status"`** and **`aria-live="polite"`** when shown.
- Each **banner kind** has a distinct color + icon in the UI (`hint`, `memory`, `setup-complete`, `motivation`, `mistake`).

**Ephemeral vs persistent banners**

- **Ephemeral** (`hint`, `mistake`): cleared on the next **correct** user move (or when superseded); they must not hide the meaning of longer-lived banners incorrectly—see code path `clearEphemeralBanner`.
- **Persistent through subsequent moves** (`memory`, `setup-complete`, `motivation`): stay visible until the next reset or clearing logic in the flow; the user should still see “play from memory” context while replaying plies.

**Wrong move (error feedback)—not a full line reset**

- On wrong SAN: show **`mistake`** banner with copy **`Falscher Zug – nochmal versuchen`** (`MISTAKE_BANNER_TEXT`).
- Board: **brief lock**, **undo the illegal try** after ~200 ms, then unlock; **no** `getResetReason` transition and **no** prefix replay for a simple wrong guess.
- Mistake banner **auto-clears** after **1800 ms** if still showing.

**When the full board resets** (physical reset + prefix replay + opponent chain)

A reset runs when a **phase-marker transition** matches one of these **reset reasons** (pure logic in `getResetReason`), **and** the UI treats the reason as requiring a **physical** board reset (clear board, prefix replay, opponent chain). The marker `next-step` (`building` → `building` with higher `currentStep`) is still computed for continuity with the domain but **does not** trigger a physical reset: Aufbau walks the line forward with an auto hint before each expected user move (see `showBuildingUserHint` / `useSessionFlow`).

| Reset reason | Transition (before → after) | Physical board reset (§4.4.1) |
|--------------|-----------------------------|-------------------------------|
| `intro-complete` | `intro` → `building` | **Yes** |
| `to-repeating` | `building` → `repeating` | **Yes** |
| `next-step` | `building` → `building` with **higher** `currentStep` | **No** (continuous Aufbau) |
| `next-rep` | `repeating` → `repeating` with **higher** `repsDone` | **Yes** |

- Entering **`done`** is handled separately (mastery finalize, delay, then **next line**); it is **not** a row in this reset-reason banner table.
- After a user move that triggers a **physical** reset (rows marked **Yes**), the UI waits **600 ms** (`STEP_RESET_DELAY_MS`) before running the reset sequence so the user perceives the boundary.

**Banner copy after a reset** (`bannerForResetReason`)

| Reset reason | Banner kind | Copy (German) |
|--------------|-------------|----------------|
| `intro-complete` | `setup-complete` | `Grundposition erreicht – jetzt die Erweiterung` |
| `to-repeating` | `setup-complete` | `Aufbau geschafft – {TARGET_REPS}× auswendig` (with `TARGET_REPS` = **5**) |
| `next-rep` | `motivation` **only** when `repsDone === floor(TARGET_REPS / 2)` | `Halbzeit – weiter so! ({repsDone}/{TARGET_REPS})` |
| `next-rep` (otherwise) | `memory` | `Durchgang {repsDone+1}/{TARGET_REPS} · auswendig` |

Historical / optional: `next-step` was previously tied to a physical reset and a “play N moves from memory” banner; **continuous Aufbau** no longer resets the board on step advance, so this row is not used for a reset-driven banner in normal play.

**Precedence:** On the rep where the **halftime** motivation applies, the **motivation** banner **wins** over the default **memory** banner for that same reset (single visible nudge).

**Other banners (not tied to `getResetReason`)**

- **Aufbau (building):** automatic on-board hint arrow (`showBuildingUserHint`) before each expected **user** move in the building phase; cleared on the next correct user move or Help flow. Intro phase unchanged (no auto hints unless implemented separately).
- **Help (Hilfe):** `hint` with help copy including expected SAN.
- **Intro / parent reminder:** additional `hint` / copy paths as implemented on the learn page (e.g. intro banner text referencing the parent line).

**Timing constants (product-facing)**

| Constant | Value | Role |
|----------|------:|------|
| Opponent auto-move delay | 350 ms | Pause before the app plays the opponent’s SAN. |
| Delay before board reset after boundary | 600 ms | Beat between last move and snap-back. |
| Delay before advancing to **next line** after mastery | 1500 ms | Breathing room before new line session. |
| Mistake banner visible | 1800 ms | Auto-dismiss mistake feedback. |
| Parent-prefix replay on board | instant | Prefix SANs snap into place without move animation (see D8 vs D15). |

**Premove / lock interaction with reset**

- If the next **opponent** move would cross a **physical** reset boundary (`willMoveTriggerReset`), the board locks so **premove cannot queue** a move that would be discarded; after the opponent ply is applied, reset logic runs as usual. `next-step` is excluded from `willMoveTriggerReset` so mid–Aufbau opponent replies do not lock for a non-resetting step advance.

---

### 4.5 Journey E — Profile and activity

**Flow:** `/profile` → toggle setting → `/profile/activity` → resume a line.

**Requirements**

- **E1.** Profile explains purpose of **Aktivität** and deep-links to list.
- **E2.** **Parent-Züge automatisch abspielen** toggle persists in **`chess-theory:v1:profile-settings`**; default **off**; shows Aktiv/Aus.
- **E3.** Activity list shows last N entries with **topic · family · relative time**, ECO + name, stats (reps, mistakes, optional help count, optional average rep duration), status badge **Gemeistert** vs **In Arbeit**.
- **E4.** **Üben** sets selection to that line’s topic + line focus and routes to **`/learn`** (mode hub—not directly play); disabled if line no longer exists in dataset.
- **E5.** If dataset removed a line but history remains: show **Zugfolge nicht mehr verfügbar** and disable resume.

---

### 4.6 Journey F — Power user / edge paths

- **F1.** User hits **browser refresh** mid-session: selection and progress should rehydrate; session should recover or restart gracefully without data loss beyond in-flight move.
- **F2.** User manually clears localStorage: app behaves as first-time (no selection, empty progress).
- **F3.** Corrupt JSON in storage: parsers fall back safely (no crash loop); selection/progress invalid entries ignored or reset per repository rules.
- **F4.** Direct navigation to unknown `topic` or `family`: user-facing **German** warnings, no blank screen.

---

## 5. Data and domain rules (requirements on content)

### 5.1 Hierarchy

- **Topic** ≈ first-move grouping (`e4`, `d4`, …).
- **Family** belongs to a topic; has **category** `opening | defense | gambit` for UI sections.
- **Line** has `sanMoves`, `userSide`, `fullName`, `eco`, `pgn`, stable `id`.
- **Tree** inside a family: nodes reference **lineId** for base/leaf; children nest; URL `path` encodes drill-down.

### 5.2 Parent / child lines (strict SAN prefix)

Parent/child is defined by **strict prefix** of full `sanMoves` (see `docs/glossary.md`). Any feature touching “parent prefix” or skip logic **must** respect **`userSide`** so training stays on the intended color.

### 5.3 Dataset delivery

- Openings are **built** at dev/build time (`scripts/build-openings.ts`); client loads JSON from **`/public/data/openings/...`**.
- Requirements: versioning strategy for breaking shape changes; migrations or tolerant readers (already partially handled via try/catch in readers).

---

## 6. Persistence contract (local)

| Key | Purpose |
|-----|---------|
| `chess-theory:v1:selection` | Current `{ topicId, focus }` for play routing. |
| `chess-theory:v1:progress` | Per-line progress blob (by topic). |
| `chess-theory:v1:profile-settings` | `{ autoPlayParentPrefix: boolean }` |

**Requirements**

- Writes must be **debounced or batched** where high-frequency (avoid main-thread jank on mobile)—verify per implementation.
- Never store secrets; these keys are **device-local**.

---

## 7. Backlog / future requirements (explicitly not done)

- **Zufallsmodus:** random lines across topics (UI placeholder exists).
- **Fehlertrainer:** prioritize historically mistaken moves (UI placeholder exists).
- Optional: **cloud backup**, **account**, **cross-device sync**.
- Optional: **PGN export** of mastered repertoire.
- Optional: **lichess-style** puzzle mode for tactical motifs inside lines.

---

## 8. Non-functional requirements

- **N1. Performance:** Topic and family pages may be large; interactions (search, expand) remain responsive on mid-tier phones.
- **N2. Accessibility:** Phase/banners use polite live regions; icon buttons have **aria-label** where text is visually secondary.
- **N3. Internationalization:** Today **German-only**; if English ships later, all user-visible strings must go through i18n layer.
- **N4. SEO / sharing:** Play session is client state; shared URLs should remain meaningful for **openings routes** (`path` query).
- **N5. Testing:** Critical flows covered by unit/integration tests (`vitest`) and e2e (`playwright`) per repo conventions. UI atoms and feature components ship with co-located unit tests against `@vue/test-utils`; reusable composables (`useTopicSearch`, etc.) get their own spec.
- **N6. Component workshop:** Reusable UI components are developed and reviewed in **Storybook** (`pnpm storybook`). Each component ships with co-located `*.stories.ts` covering its meaningful states. The static bundle (`pnpm build-storybook`) doubles as a design reference.
  - *Note:* `@nuxtjs/storybook` 9.0.1 is incompatible with Nuxt 4 (transitive `@nuxt/vite-builder@3.x` clashes with Nuxt 4's built-in vite and breaks `@nuxt/ui` resolution). It is intentionally **not registered** as a Nuxt module in `nuxt.config.ts`. Storybook is invoked as a standalone CLI; the `@storybook-vue/nuxt` framework still works for stories without the module wrapper.

---

## 9. Open questions for stakeholders

1. Should **resume** from activity land on `/learn/play` directly when mode is unambiguous, or always `/learn` (current: `/learn`)?
2. Should **family progress** on `/openings` count **lines** instead of **families** for finer granularity?
3. Product copy: standardize **Parent-Züge** spelling (`Züge`) and teaching tone for the autoplay feature for non-expert users.
4. Do we want an explicit **“clear progress for topic”** control for privacy / reset?

---

## 10. Traceability

- Domain vocabulary: `docs/glossary.md`.
- Key implementation anchors: `app/pages/learn/play.vue`, `app/pages/openings/**`, `app/composables/training-session`, `app/domain/session.ts` (`TARGET_REPS`), `app/infra/selection-repository.ts`, `app/composables/useProfileSettings.ts`.
- UI building blocks: `app/design/tokens.ts` (radius / surface / padding / heading / body / focusRing), `app/components/base/**` (atoms — `BasePageHeader`, `BaseProgressBar`, `BaseSelectableCard`, `BaseEmptyState`, `BaseLoadingState`, `BaseErrorAlert`, `BaseSectionHeading`, `BaseStatPill`, `BaseIconAction`).
- Feature components grouped by page: `app/components/play/**` (board panel, action bar, top bar, action sheet, phase + feedback banners, help + complete modals, empty state), `app/components/family/**` (breadcrumb, header, base-line card, info banner, child rows, tree list, locked dialog), `app/components/topic/**` (header, family grid + card, search bar), `app/components/activity/**` (list + item).
- Play composables: `useSessionFlow` (board lock, hint, opponent auto-play, premove buffer), `useReplayControls` (move-history step + view), `useScopedProgress` (mastery counter scoped to focus), `usePlayHeadings` (page title + phase label), `useLineLifecycle` (start/next/restart/skip/previous + mastery finalisation).
- Page composables: `useFamilyTree`, `useFamilyNavigation`, `useLockedActions`, `useTopicSearch`.
- Pure-domain helpers: `app/domain/line-setup.ts` (`computeLineSetup`).

This PRD describes **observed and code-backed behavior** as of the revision date; when implementation diverges, either update the PRD or treat the mismatch as a defect, per team policy.
