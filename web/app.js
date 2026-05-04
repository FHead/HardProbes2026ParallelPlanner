const COLUMN_KEYS = [
  "not-decided",
  "jet",
  "substructure",
  "highpt",
  "eec",
  "small-system",
  "hf",
  "npdf-saturation-early",
  "em",
  "future",
  "ai-ml",
];
const COLUMN_LABELS = {
  "not-decided": "Not decided",
  jet: "Jet",
  substructure: "Substructure",
  highpt: "HighPT",
  eec: "EEC",
  "small-system": "Small System",
  hf: "HF",
  "npdf-saturation-early": "nPDF/saturation/early",
  em: "EM",
  future: "Future",
  "ai-ml": "AI/ML",
};
const TRACK_DEFAULT_COLUMNS = {
  HF: "hf",
  "nPDF/saturation/early": "npdf-saturation-early",
  EM: "em",
  Future: "future",
  "AI/ML": "ai-ml",
};
const STORAGE_KEY = "parallel-program-layout";
const TRACK_MIGRATION_KEY = "parallel-program-track-columns-migrated-v1";
const STATUS_EL = document.getElementById("status-message");
const GRID_EL = document.getElementById("schedule-grid");
const CARD_TEMPLATE = document.getElementById("card-template");
const COMPACT_BUTTON = document.getElementById("compact-button");
const EXPORT_BUTTON = document.getElementById("export-button");
const IMPORT_INPUT = document.getElementById("import-input");
const RESET_BUTTON = document.getElementById("reset-button");

let contributions = [];
let positions = {};
let draggedId = null;
let draggedStack = null;

function setStatus(message) {
  STATUS_EL.textContent = message;
}

function slugTrack(track) {
  return track
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function defaultColumnFor(item) {
  return TRACK_DEFAULT_COLUMNS[item.track] || COLUMN_KEYS[0];
}

function initialPositions(items) {
  return Object.fromEntries(
    items.map((item, index) => [
      item.id,
      { column: defaultColumnFor(item), row: index + 1, order: 1 },
    ])
  );
}

function layoutRowCount() {
  const maxRow = Object.values(positions).reduce(
    (currentMax, value) => Math.max(currentMax, value.row),
    0
  );
  return Math.max(maxRow + 1, 1);
}

function contributionById(id) {
  return contributions.find((item) => item.id === id);
}

function occupantsAt(column, row) {
  return contributions.filter((item) => {
    const pos = positions[item.id];
    return pos && pos.column === column && pos.row === row;
  });
}

function sortedOccupantsAt(column, row) {
  return occupantsAt(column, row).sort((left, right) => {
    const leftOrder = positions[left.id]?.order || 1;
    const rightOrder = positions[right.id]?.order || 1;
    if (leftOrder !== rightOrder) {
      return leftOrder - rightOrder;
    }
    return left.id.localeCompare(right.id, undefined, { numeric: true });
  });
}

function normalizeCellOrder(column, row) {
  sortedOccupantsAt(column, row).forEach((item, index) => {
    positions[item.id].order = index + 1;
  });
}

function nextOrderForCell(column, row, excludedId = null) {
  const orders = contributions
    .filter((item) => item.id !== excludedId)
    .map((item) => ({ item, pos: positions[item.id] }))
    .filter(({ pos }) => pos && pos.column === column && pos.row === row)
    .map(({ pos }) => pos.order || 1);
  return orders.length === 0 ? 1 : Math.max(...orders) + 1;
}

function cloneStackPositions(column, row) {
  return sortedOccupantsAt(column, row).map((item) => ({
    id: item.id,
    order: positions[item.id]?.order || 1,
  }));
}

function swapStacks(sourceColumn, sourceRow, targetColumn, targetRow) {
  if (sourceColumn === targetColumn && sourceRow === targetRow) {
    return;
  }

  const sourceStack = cloneStackPositions(sourceColumn, sourceRow);
  const targetStack = cloneStackPositions(targetColumn, targetRow);

  sourceStack.forEach((entry, index) => {
    positions[entry.id] = {
      column: targetColumn,
      row: targetRow,
      order: index + 1,
    };
  });

  targetStack.forEach((entry, index) => {
    positions[entry.id] = {
      column: sourceColumn,
      row: sourceRow,
      order: index + 1,
    };
  });
}

function insertIntoCellOrder(id, column, row, targetId = null, placeAfter = false) {
  const current = positions[id];
  const sourceColumn = current?.column;
  const sourceRow = current?.row;
  const targetItems = sortedOccupantsAt(column, row).filter((item) => item.id !== id);

  let insertIndex = targetItems.length;
  if (targetId) {
    const targetIndex = targetItems.findIndex((item) => item.id === targetId);
    if (targetIndex >= 0) {
      insertIndex = targetIndex + (placeAfter ? 1 : 0);
    }
  }

  targetItems.splice(insertIndex, 0, contributionById(id));
  targetItems.forEach((item, index) => {
    positions[item.id] = { column, row, order: index + 1 };
  });

  if (
    sourceColumn &&
    sourceRow &&
    (sourceColumn !== column || sourceRow !== row)
  ) {
    normalizeCellOrder(sourceColumn, sourceRow);
  }
}

function saveLayout() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(positions));
}

function loadSavedLayout() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) {
      return false;
    }
    applyImportedLayout(JSON.parse(saved), false);
    return true;
  } catch {
    return false;
  }
}

function migrateTrackColumns() {
  let movedCount = 0;
  for (const item of contributions) {
    const targetColumn = defaultColumnFor(item);
    if (targetColumn === COLUMN_KEYS[0]) {
      continue;
    }
    const position = positions[item.id];
    if (position && position.column === COLUMN_KEYS[0]) {
      positions[item.id] = {
        column: targetColumn,
        row: position.row,
        order: position.order,
      };
      movedCount += 1;
    }
  }
  return movedCount;
}

function compactColumns() {
  let movedStacks = 0;

  for (const column of COLUMN_KEYS) {
    const rowEntries = [];
    const seenRows = new Set();

    for (const item of contributions) {
      const position = positions[item.id];
      if (!position || position.column !== column || seenRows.has(position.row)) {
        continue;
      }
      seenRows.add(position.row);
      rowEntries.push({
        sourceRow: position.row,
        occupants: sortedOccupantsAt(column, position.row),
      });
    }

    rowEntries.sort((left, right) => left.sourceRow - right.sourceRow);

    rowEntries.forEach((entry, index) => {
      const targetRow = index + 1;
      if (entry.sourceRow !== targetRow) {
        movedStacks += 1;
      }
      entry.occupants.forEach((item, occupantIndex) => {
        positions[item.id] = {
          column,
          row: targetRow,
          order: occupantIndex + 1,
        };
      });
    });
  }

  return movedStacks;
}

function columnIndex(columnKey) {
  return COLUMN_KEYS.indexOf(columnKey) + 1;
}

function exportLayout() {
  const payload = contributions.map((item) => ({
    id: item.id,
    gridColumn: positions[item.id].column,
    gridColumnIndex: columnIndex(positions[item.id].column),
    gridRow: positions[item.id].row,
    cellOrder: positions[item.id].order || 1,
  }));
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "parallel-program-layout.json";
  link.click();
  URL.revokeObjectURL(url);
  setStatus(`Exported ${payload.length} positions.`);
}

function normalizeImportedLayout(layout) {
  let entries = layout;
  if (!Array.isArray(entries) && entries && typeof entries === "object") {
    entries = Object.entries(entries).map(([id, value]) => ({ id, ...value }));
  }
  if (!Array.isArray(entries)) {
    throw new Error("Expected saved positions as an array or object map.");
  }

  const allowedIds = new Set(contributions.map((item) => item.id));
  const normalized = {};
  const occupiedOrders = new Map();

  function reserveOrder(cellKey, preferredOrder = null) {
    const usedOrders = occupiedOrders.get(cellKey) || new Set();
    let order = Number(preferredOrder);
    if (!Number.isInteger(order) || order < 1 || usedOrders.has(order)) {
      order = 1;
      while (usedOrders.has(order)) {
        order += 1;
      }
    }
    usedOrders.add(order);
    occupiedOrders.set(cellKey, usedOrders);
    return order;
  }

  for (const entry of entries) {
    if (!entry || !allowedIds.has(String(entry.id))) {
      continue;
    }
    let column;
    if (entry.gridColumnIndex) {
      const candidate = COLUMN_KEYS[Number(entry.gridColumnIndex) - 1];
      if (candidate) {
        column = candidate;
      }
    }
    if (!column) {
      column = entry.gridColumn || entry.column;
    }
    const rowValue = entry.gridRow || entry.row;
    if (!COLUMN_KEYS.includes(column)) {
      throw new Error(`Invalid column for contribution ${entry.id}.`);
    }
    const row = Number(rowValue);
    if (!Number.isInteger(row) || row < 1) {
      throw new Error(`Invalid row for contribution ${entry.id}.`);
    }
    const cellKey = `${column}:${row}`;
    const order = reserveOrder(
      cellKey,
      entry.cellOrder || entry.orderInCell || entry.order
    );
    normalized[String(entry.id)] = { column, row, order };
  }

  for (const item of contributions) {
    if (!normalized[item.id]) {
      const current = positions[item.id];
      const fallback = current || {
        column: defaultColumnFor(item),
        row: 1,
        order: 1,
      };
      const cellKey = `${fallback.column}:${fallback.row}`;
      const order = reserveOrder(cellKey, fallback.order);
      normalized[item.id] = { column: fallback.column, row: fallback.row, order };
    }
  }

  return normalized;
}

function applyImportedLayout(layout, persist = true) {
  const normalized = normalizeImportedLayout(layout);
  positions = normalized;
  if (persist) {
    saveLayout();
  }
  renderGrid();
  setStatus("Imported layout.");
}

function moveContribution(id, targetColumn, targetRow) {
  insertIntoCellOrder(id, targetColumn, targetRow);
  saveLayout();
  renderGrid();
  const moved = contributionById(id);
  setStatus(`Placed ${moved.id} in ${COLUMN_LABELS[targetColumn]}, row ${targetRow}.`);
}

function reorderContribution(id, targetId, placeAfter) {
  const targetPos = positions[targetId];
  if (!targetPos) {
    return;
  }
  insertIntoCellOrder(id, targetPos.column, targetPos.row, targetId, placeAfter);
  saveLayout();
  renderGrid();
  const moved = contributionById(id);
  setStatus(
    `Reordered ${moved.id} in ${COLUMN_LABELS[targetPos.column]}, row ${targetPos.row}.`
  );
}

function renderCard(item) {
  const fragment = CARD_TEMPLATE.content.cloneNode(true);
  const card = fragment.querySelector(".contribution-card");
  const badge = fragment.querySelector(".card-badge");
  card.classList.add(slugTrack(item.track));
  card.dataset.id = item.id;
  badge.classList.add(item.talkType);
  badge.textContent = item.talkType === "experimental" ? "Exp" : "Th";
  badge.title = item.talkType === "experimental" ? "Experimental talk" : "Theory talk";
  card.querySelector(".card-id").textContent = `${item.id} • ${item.track}`;
  card.querySelector(".card-title").textContent = item.title;
  card.addEventListener("dragstart", (event) => {
    draggedId = item.id;
    draggedStack = null;
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", item.id);
  });
  card.addEventListener("dragend", () => {
    draggedId = null;
    draggedStack = null;
    document.querySelectorAll(".contribution-card.is-drop-before").forEach((node) => {
      node.classList.remove("is-drop-before");
    });
    document.querySelectorAll(".contribution-card.is-drop-after").forEach((node) => {
      node.classList.remove("is-drop-after");
    });
    document.querySelectorAll(".grid-cell.is-stack-target").forEach((cell) => {
      cell.classList.remove("is-stack-target");
    });
    document.querySelectorAll(".grid-cell.is-target").forEach((cell) => {
      cell.classList.remove("is-target");
    });
  });
  card.addEventListener("dragover", (event) => {
    if (!draggedId || draggedId === item.id) {
      return;
    }
    event.preventDefault();
    const rect = card.getBoundingClientRect();
    const placeAfter = event.clientY >= rect.top + rect.height / 2;
    card.classList.toggle("is-drop-before", !placeAfter);
    card.classList.toggle("is-drop-after", placeAfter);
  });
  card.addEventListener("dragleave", () => {
    card.classList.remove("is-drop-before", "is-drop-after");
  });
  card.addEventListener("drop", (event) => {
    if (!draggedId || draggedId === item.id) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    const rect = card.getBoundingClientRect();
    const placeAfter = event.clientY >= rect.top + rect.height / 2;
    card.classList.remove("is-drop-before", "is-drop-after");
    reorderContribution(draggedId, item.id, placeAfter);
  });
  return fragment;
}

function renderStackHandle(column, row, count) {
  const handle = document.createElement("button");
  handle.type = "button";
  handle.className = "stack-handle";
  handle.draggable = true;
  handle.textContent = count === 1 ? "Move stack" : `Move stack (${count})`;
  handle.addEventListener("dragstart", (event) => {
    draggedId = null;
    draggedStack = { column, row };
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/stack", `${column}:${row}`);
  });
  handle.addEventListener("dragend", () => {
    draggedStack = null;
    document.querySelectorAll(".grid-cell.is-stack-target").forEach((cell) => {
      cell.classList.remove("is-stack-target");
    });
  });
  return handle;
}

function renderGrid() {
  GRID_EL.replaceChildren();

  Object.values(COLUMN_LABELS).forEach((label) => {
    const header = document.createElement("div");
    header.className = "column-header";
    header.textContent = label;
    GRID_EL.appendChild(header);
  });

  const totalRows = layoutRowCount();
  for (let row = 1; row <= totalRows; row += 1) {
    for (const column of COLUMN_KEYS) {
      const cell = document.createElement("div");
      cell.className = "grid-cell";
      cell.dataset.column = column;
      cell.dataset.row = String(row);
      cell.addEventListener("dragover", (event) => {
        event.preventDefault();
        if (draggedStack) {
          cell.classList.add("is-stack-target");
        } else {
          cell.classList.add("is-target");
        }
      });
      cell.addEventListener("dragleave", () => {
        cell.classList.remove("is-target");
        cell.classList.remove("is-stack-target");
      });
      cell.addEventListener("drop", (event) => {
        event.preventDefault();
        cell.classList.remove("is-target");
        cell.classList.remove("is-stack-target");
        if (draggedStack) {
          swapStacks(draggedStack.column, draggedStack.row, column, row);
          saveLayout();
          renderGrid();
          setStatus(
            `Swapped stacks between ${COLUMN_LABELS[draggedStack.column]}, row ${draggedStack.row} and ${COLUMN_LABELS[column]}, row ${row}.`
          );
          draggedStack = null;
          return;
        }
        const droppedId = event.dataTransfer.getData("text/plain") || draggedId;
        if (!droppedId) {
          return;
        }
        moveContribution(droppedId, column, row);
      });

      const occupants = occupantsAt(column, row);
      if (occupants.length > 0) {
        cell.appendChild(renderStackHandle(column, row, occupants.length));
        sortedOccupantsAt(column, row).forEach((occupant) => {
          cell.appendChild(renderCard(occupant));
        });
      } else {
        cell.classList.add("is-empty");
        const label = document.createElement("span");
        label.className = "empty-label";
        label.textContent = `Row ${row}`;
        cell.appendChild(label);
      }

      GRID_EL.appendChild(cell);
    }
  }
}

async function init() {
  try {
    const data = window.APP_DATA;
    if (!data || !Array.isArray(data.contributions)) {
      throw new Error("Contribution data is unavailable.");
    }
    contributions = data.contributions;
    positions = initialPositions(contributions);
    const loadedSaved = loadSavedLayout();
    if (loadedSaved && !localStorage.getItem(TRACK_MIGRATION_KEY)) {
      const movedCount = migrateTrackColumns();
      saveLayout();
      localStorage.setItem(TRACK_MIGRATION_KEY, "true");
      if (movedCount > 0) {
        setStatus(`Migrated ${movedCount} talks from Not decided into the new track columns.`);
      }
    }
    renderGrid();
    setStatus(
      loadedSaved
        ? `Loaded ${contributions.length} contributions with saved layout.`
        : `Loaded ${contributions.length} contributions with default track placement.`
    );
  } catch (error) {
    console.error(error);
    setStatus(error.message);
  }
}

EXPORT_BUTTON.addEventListener("click", exportLayout);

COMPACT_BUTTON.addEventListener("click", () => {
  const movedStacks = compactColumns();
  saveLayout();
  renderGrid();
  setStatus(
    movedStacks > 0
      ? `Shifted ${movedStacks} stack${movedStacks === 1 ? "" : "s"} upward to remove gaps.`
      : "No column gaps found."
  );
});

IMPORT_INPUT.addEventListener("change", async (event) => {
  const [file] = event.target.files;
  if (!file) {
    return;
  }
  try {
    const text = await file.text();
    applyImportedLayout(JSON.parse(text));
  } catch (error) {
    console.error(error);
    setStatus(`Import failed: ${error.message}`);
  } finally {
    IMPORT_INPUT.value = "";
  }
});

RESET_BUTTON.addEventListener("click", () => {
  positions = initialPositions(contributions);
  saveLayout();
  renderGrid();
  setStatus("Reset layout to the default ordering.");
});

init();
