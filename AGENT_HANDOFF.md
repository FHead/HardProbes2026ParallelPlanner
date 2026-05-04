# Agent Handoff

## Project goal

Build a static local web tool for arranging accepted oral contributions from `abstracts.csv` into a program grid by drag and drop.

The app lives under `web/` and is intended to work without a web server by opening `web/index.html` directly.

## Current data model

Source CSV:
- `abstracts.csv`

Relevant filtering:
- Keep only rows with `State == Accepted`
- Keep only rows with `Accepted type == Oral presentation`
- Keep only tracks:
  - `Jet modification and medium response`
  - `High-momentum hadrons and correlations`

Track selection logic:
- Use `Accepted track` when present
- Otherwise fall back to `Submitted for tracks`

Experimental/theory badge:
- Now comes from CSV column `Is this an experimental talk?`
- `Yes` => `experimental`
- everything else => `theory`

Generated client data:
- `web/data.js`
- produced by `web/build_data.py`

## Current UI behavior

Columns currently shown:
1. `Not decided`
2. `Jet`
3. `Substructure`
4. `HighPT`
5. `EEC`
6. `Small System`

Cards:
- show `id`, track label, title
- colored by source track:
  - `Jet`
  - `HighPT`
- badge in upper-right:
  - `Exp`
  - `Th`

Board interactions:
- Drag a card to another cell to move that single contribution
- Multiple contributions can occupy the same cell
- Within the same cell, drag one card onto another card:
  - upper half of target card => insert before
  - lower half of target card => insert after
- Each non-empty cell has a `Move stack` handle
- Dragging the handle onto another cell swaps the two stacks

## Export/import format

Exported layout entries are an array of objects like:

```json
{
  "id": "128",
  "gridColumn": "highpt",
  "gridColumnIndex": 4,
  "gridRow": 3,
  "cellOrder": 2
}
```

Import behavior:
- Prefer `gridColumnIndex` if present
- Otherwise fall back to `gridColumn` or `column`
- Prefer `cellOrder` if present
- Fall back to `orderInCell` or `order`
- If no per-cell order field is present, assign deterministic fallback order
- Older JSON files without `gridColumnIndex` and/or `cellOrder` should still work

Importer also accepts two shapes:
- exported array format
- object-map format used by browser autosave/localStorage

## Persistence

Current persistence is browser `localStorage` only.

Important caveat:
- because this is usually opened as `file://.../web/index.html`, localStorage behavior may be inconsistent across browsers or reloads
- the app tries to restore saved state on load, but this may not be reliable in local-file mode

No true file-backed autosave has been implemented yet.

## Key files

- `web/index.html`
  - page structure
  - control buttons
  - card template

- `web/style.css`
  - layout, colors, grid sizing
  - card styling
  - stack handle styling
  - same-cell reorder hover cues

- `web/app.js`
  - drag/drop logic
  - single-card moves
  - same-cell reordering
  - stack swapping
  - import/export
  - localStorage persistence

- `web/build_data.py`
  - CSV filtering
  - badge type derivation from explicit CSV column
  - writes `web/data.js`

- `conversation_log.md`
  - visible conversation record requested by user

## Current implementation details worth knowing

In `web/app.js`:
- `positions` is the runtime layout map keyed by contribution id
- each entry is currently:

```js
{
  column: "jet",
  row: 4,
  order: 2
}
```

Important helpers:
- `sortedOccupantsAt(column, row)`
- `insertIntoCellOrder(...)`
- `reorderContribution(...)`
- `swapStacks(...)`
- `normalizeImportedLayout(...)`

## Known limitations / likely next tasks

1. Autosave to actual local JSON file is not implemented.
   - User previously asked about automatic save/load across reloads.
   - Current answer is only browser localStorage.
   - If reliable file-backed persistence is needed, likely use the File System Access API with graceful fallback.

2. The app has not been live browser-tested in this environment.
   - Syntax checks passed, but interaction behavior was not exercised with a browser automation loop.

3. Stack dragging uses a dedicated handle, not the whole cell.
   - This was intentional to avoid conflicts with card dragging.

4. The six visible columns are scheduling buckets only.
   - They are not inferred from the CSV tracks.
   - Only the source tracks `Jet` and `HighPT` drive card color/data inclusion.

5. Initial default layout places all talks in `Not decided`, each in its own row.

## Commands used for verification

Mostly:

```bash
python3 web/build_data.py
python3 -m py_compile web/build_data.py
node --check web/app.js
```

## What another agent should do first

1. Read `instructions.md` because the user has been iteratively changing requirements there.
2. Read `AGENT_HANDOFF.md` and `conversation_log.md`.
3. Inspect `web/app.js` before changing drag/drop behavior because interactions are now layered:
   - card move
   - in-cell reorder
   - stack swap
4. If the CSV changed, regenerate `web/data.js` with:

```bash
python3 web/build_data.py
```

## Current state summary

The app is functional as a static scheduling board with:
- filtered contribution data
- drag/drop card moves
- multiple cards per cell
- same-cell reordering
- stack swapping
- import/export with backward compatibility
- browser-local persistence attempt

The main unresolved product issue is reliable persistence when opened from the local filesystem.
