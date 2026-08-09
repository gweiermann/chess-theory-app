# Glossary

Project vocabulary for openings data and the learn flow.

## `sanMoves` and **SAN**

**SAN** (standard algebraic notation) is how a single move is written (e.g. `Nf3`, `e4`).

A **line**’s full sequence of moves is stored as **`sanMoves`**: an ordered list of plies, same order as the line’s PGN, alternating White and Black from the start position.

## Parent and child (lines)

Lines are grouped by topic → family → line. **Parent** and **child** refer to a **strict prefix** on the **full** move list **`sanMoves`** (every ply from the start), not a filtered subset of “only the user’s” plies.

- The **child** has the **longer** `sanMoves`.
- The **parent**’s `sanMoves` is **exactly the first *N* plies** of the child’s list; the child has **at least one more** ply. Same length ⇒ siblings, not parent/child.

When the app resolves a **mastered parent** (e.g. intro skip / parent-prefix autoplay), the candidate must **match the line’s `userSide`** as well as that prefix, so training stays on the correct color.

A legacy **name tree** built from parsed `fullName` was a separate idea and is **not** this parent/child relation; that navigation is being removed.

## Other terms

| Term | Definition |
|------|------------|
| **Topic** | Group keyed by the first move (e.g. `e4`, `d4`, or *other*); contains **families** of **lines**. |
| **Family** | Named group inside a topic, aggregating related **lines** (e.g. by opening name). |
| **Line** | One concrete variation: ECO, display name, PGN, **`sanMoves`**, **`userSide`**, and progress. |
| **ECO** | Encyclopedic opening code (e.g. B02) on a line, used for identity and ordering. |
| **userSide** | Whether the user trains that line as **White** or **Black**. |
| **FEN** | Forsyth–Edwards notation for board state (position, side to move, castling, etc.). |
| **PGN** | Portable Game Notation string for a line; parsed to **`sanMoves`**. |
| **expectedSan** | The next move the training session expects in the current step. |
| **Intro (phase)** | The user **plays the prefix** by hand (when applicable) to reach the line’s start for drilling, unless **parent-prefix autoplay** is on. |
| **Autoplay (parent-prefix)** | Profile setting: **replays the mastered parent prefix** (known setup from a parent line) instead of the intro, on session start and resets. Refers to **replaying setup you have already qualified**—not the opponent’s automatic moves in the live loop. |
| **Opponent auto-reply** | When the next expected move is the opponent’s, the app **plays that SAN** (after a short delay), possibly several plies in a row until the **user** must move. Distinct from **parent-prefix autoplay**. |
| **Building phase** | Phase (`'building'`) in which the line is first **walked** move-by-move (session builds the line from `sanMoves` in order), as opposed to only cycling **repetitions**. UI label: **Aufbau**. |
| **Repetition phase** | Part of the session where the line (or its steps) is practiced in a **repetition** loop: reps, resets, and completion criteria, after the intro and training work as needed. |
| **Progress** | Per-line **new** / **in progress** / **mastered** (and **reps**), stored for spaced practice. |
| **Reps** | Count of **repetitions** recorded for a line. |
| **Learned pool** | All lines with status **mastered** across **all** topics. The Zufallsmodus draws its rounds from this pool (read-only: it never writes progress). Built by `collectMasteredLines`. |
| **Continuation** | One SAN edge in the learned position tree. Every continuation leaving a node is a **valid learned continuation**, so a position may have several correct answers. |
**Round (Zufallsmodus)** | One random walk built around a randomly drawn **target line**: the computer auto-plays its side along the target while the user plays theirs, ending at a **terminal** node or when the target line is completed. |
**Target line (Ziel)** | The mastered line chosen at random each round and called out at the top (**Ziel: \<name\>**) so the user knows which variation the app intends. While the user stays on it the computer plays that line’s own side; a valid learned move off the target is accepted but drops the round off target (no bonus). |
**Continue bar** | The reusable mode-agnostic round-completion card (default button **Weiter**) that starts the next round manually — no auto-advance. Reusable by classic `/learn/play`. |
**Hilfe (practice)** | Reveals one valid continuation for the current turn. The helped move earns **0 points** and resets the streak; it does not disqualify the target-line bonus. |
**Score / Streak** | Practice-session totals: **+1** per correct no-help move, streak **+1** per streak move (reset on help or a mistake); **+5** bonus (`targetMet`) when the round follows the target line from the start with **0 mistakes**. |

---

*Last updated: added target line (Ziel) term; refined round/bonus semantics.*
