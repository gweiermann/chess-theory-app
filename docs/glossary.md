# Glossary

Project vocabulary for openings data and the learn flow.

## `sanMoves` and **SAN**

**SAN** (standard algebraic notation) is how a single move is written (e.g. `Nf3`, `e4`).

A **line**’s full sequence of moves is stored as **`sanMoves`**: an ordered list of plies, same order as the line’s PGN, alternating White and Black from the start position.

## Parent and child (lines)
Lines are grouped by openings first move > family > line.
But lines then have a separate tree representation where a line can inherit a parent line, based on its `sanMoves` and `userSide`

Here's how to determine who's parent and who's child in the tree:
- The **child** is the line with the **longer** user move list; both lines use the same **user side** for a valid parent/child pair.
- The **parent** is a **strict prefix** of the child **in user moves**: the parent’s list is **exactly the first *N* user moves** of the child’s list, the child has **at least one more** user move than that, and the lists are not the same length (strict prefix, not a sibling match).

So “deeper” variation = **more user moves**; **shared lead-in** = **prefix of user moves** after stripping.

Attention:
Any former notion of a separate **name tree** of parents (labels parsed from `fullName`) is **not** a second definition of parent/child; that implementation is being removed. Progress (e.g. which parent counts as *mastered* when skipping intro) is expressed on top of the same user-move prefix relationship plus stored progress state.

## Other terms

| Term | Definition |
|------|------------|
| **Topic** | Group keyed by the first move (e.g. `e4`, `d4`, or *other*); contains **families** of **lines**. |
| **Family** | Named group inside a topic, aggregating related **lines** (e.g. by opening name). |
| **Line** | One concrete variation: ECO, display name, PGN, **`sanMoves`**, **`userSide`**, and progress. |
| **ECO** | Encyclopedic opening code (e.g. B02) on a line, used for identity and ordering. |
| **userSide** | Whether the user trains that line as **White** or **Black**. |
| **User Moves** | `sanMoves` but only the moves of the `userSide` and none of the opponents |
| **FEN** | Forsyth–Edwards notation for board state (position, side to move, castling, etc.). |
| **PGN** | Portable Game Notation string for a line; parsed to **`sanMoves`**. |
| **expectedSan** | The next move the training session expects in the current step. |
| **Intro (phase)** | The user **plays the prefix** by hand (when applicable) to reach the line’s start for drilling, unless **parent-prefix autoplay** is on. |
| **Autoplay (parent-prefix)** | Profile setting: **replays the mastered parent prefix** (known setup from a parent line) instead of the intro, on session start and resets. Refers to **replaying setup you have already qualified**—not the opponent’s automatic moves in the live loop. |
| **Opponent auto-reply** | When the next expected move is the opponent’s, the app **plays that SAN** (after a short delay), possibly several plies in a row until the **user** must move. Distinct from **parent-prefix autoplay**. |
| **Training phase** | Phase in which the line is first **walked** move-by-move (session builds the line from `sanMoves` in order), as opposed to only cycling **repetitions**. |
| **Repetition phase** | Part of the session where the line (or its steps) is practiced in a **repetition** loop: reps, resets, and completion criteria, after the intro and training work as needed. |
| **Progress** | Per-line **new** / **in progress** / **mastered** (and **reps**), stored for spaced practice. |
| **Reps** | Count of **repetitions** recorded for a line. |

---

*Last updated to align on a user-move prefix model for parent/child; legacy name-tree navigation is being removed from the product.*
