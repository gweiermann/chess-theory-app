# Openings static data layout — decisions

Reference for the on-disk layout, URLs, types, build, and tests. This matches what the app and `pnpm build:openings` ship under `public/data/openings/`.

## 1. On-disk URL shape (no `topics/` segment)

First-move “topics” live **directly** under `data/openings/`, not under `data/openings/topics/<id>/`.

| Role | Path |
|------|------|
| Global catalog | `/data/openings/index.json` |
| One first move (topic) | `/data/openings/<topicId>/index.json` |
| One family (full lines) | `/data/openings/<topicId>/families/<familyId>.json` |

Examples: `e4/index.json`, `e4/families/ruy-lopez.json`.

## 2. Root `index.json` (slim topic list)

The root file is a **small list** of first-move topics, not a dump of all families or lines.

Each entry includes topic identity plus **aggregates** needed at list level: **`familyCount`** and **`lineCount`**. Legacy or redundant root fields are not used (e.g. no `totalFamilies` / `totalLines` naming on that shape, and no embedding `familyIds` on the root index where that was removed).

**Rationale:** Fast first paint; family detail loads on demand.

## 3. Per-topic `index.json`

Under `<topicId>/index.json`, list **families** for that first move only.

Each family row includes a **display name**, **`lineCount`**, and the **ids** needed to request `families/<familyId>.json`.

**Rationale:** Topic shell loads once; each family file is lazy-loaded.

## 4. Per-family `families/<familyId>.json`

The full **lines** payload lives here (and any other line metadata the tree needs). How parent/child is encoded must stay consistent with **section 5** (nested tree + strict `sanMoves` prefix).

**Rationale:** Large trees stay out of the topic index; one file per family.

## 5. Line trees: nested objects and parent/child semantics

- **Representation:** Tree structure for lines within a family should be modeled as **nested objects** (a hierarchy in JSON), not only as a flat list with cross-references. Use nesting to reflect containment; avoid relying on a parallel “graph over a bag of nodes” when a tree shape is intended.
- **Parent vs child (moves):** **Parent** and **child** refer to a **strict prefix** on each line’s **full** move list **`sanMoves`** (every ply from the start, same order as the line’s PGN). The parent’s `sanMoves` is **exactly the first *N* plies** of the child’s list; the child has **at least one more** ply. Same length ⇒ siblings, not parent/child. This is **not** a filtered subset of “only the user’s” plies — it is always the full alternating sequence.

Canonical wording lives in **`docs/glossary.md`** (“Parent and child (lines)”).

## 6. Build pipeline

`pnpm build:openings` (`scripts/build-openings.ts`) writes **`public/data/openings/`** with:

- root `index.json`
- `<topicId>/index.json`
- `<topicId>/families/*.json`

Log/output messaging reflects that layout without a `topics/` prefix.

## 7. Runtime loading (HTTP loader)

Loader base is `.../data/openings` and resolves:

- topic shell: `${base}/${topicId}/index.json`
- family: `${base}/${topicId}/families/${familyId}.json`

No `topics/` segment in any URL.

## 8. Domain / types

Shared types (e.g. topic index file, topic summary for the openings list) use **`familyCount`** / **`lineCount`** at the root index level, aligned with the JSON we ship.

## 9. UI

The openings list reads **`topic.familyCount`** and **`topic.lineCount`** from the root index.

## 10. Tests and E2E helpers

- Unit tests for split dataset and HTTP loader expect the **new field names** and **new URLs** (`/data/openings/e4/...`, not `.../topics/e4/...`).
- E2E bridge / POM fetch helpers use the same paths as production.

## 11. Verification

After layout or loader changes:

- `pnpm test --run` should pass.
- `pnpm build:openings` should regenerate `public/data/openings/` in this layout.

Old paths such as `public/data/openings/topics/` (or stale `.output/.../topics/`) are obsolete; remove stale directories locally if they remain so nothing references them by mistake.

## 12. Out of scope (unless added later)

- No requirement to version the JSON schema in filenames.
- No backward-compatible redirects from old `topics/` URLs — code and tests target the new paths only.
