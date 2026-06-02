"use client";

import { useEffect } from "react";

type TableState = {
  globalFilter: string;
  columnFilters: string[];
  hiddenColumns: Set<number>;
  sortIndex: number | null;
  sortDirection: "asc" | "desc";
};

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function csvCell(value: string) {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

function getCellText(row: HTMLTableRowElement, index: number) {
  return row.cells[index]?.textContent?.replace(/\s+/g, " ").trim() ?? "";
}

function enhanceTable(table: HTMLTableElement) {
  if (table.dataset.adminExcelEnhanced === "true") return;
  if (table.closest("[data-admin-excel-skip='true']")) return;
  if (!table.tHead || !table.tBodies[0]) return;

  const headerRow = table.tHead.rows[0];
  if (!headerRow || headerRow.cells.length <= 1) return;

  table.dataset.adminExcelEnhanced = "true";
  const columnCount = headerRow.cells.length;
  const state: TableState = {
    globalFilter: "",
    columnFilters: Array.from({ length: columnCount }, () => ""),
    hiddenColumns: new Set<number>(),
    sortIndex: null,
    sortDirection: "asc",
  };

  const tableLabel =
    table.getAttribute("aria-label") ||
    table.closest("section")?.querySelector("h1,h2,h3")?.textContent?.trim() ||
    "tabla-admin";
  const toolbar = document.createElement("div");
  toolbar.className = "ui-admin-excel-toolbar";
  toolbar.dataset.adminExcelToolbar = "true";

  const search = document.createElement("input");
  search.className = "ui-admin-excel-search";
  search.type = "search";
  search.placeholder = "Buscar en tabla";
  search.setAttribute("aria-label", `Buscar en ${tableLabel}`);

  const counter = document.createElement("span");
  counter.className = "ui-admin-excel-counter";

  const details = document.createElement("details");
  details.className = "ui-admin-excel-columns";
  const summary = document.createElement("summary");
  summary.textContent = "Columnas";
  details.append(summary);
  const columnList = document.createElement("div");
  columnList.className = "ui-admin-excel-column-list";
  details.append(columnList);

  const exportButton = document.createElement("button");
  exportButton.type = "button";
  exportButton.className = "ui-admin-excel-button";
  exportButton.textContent = "CSV";

  toolbar.append(search, details, exportButton, counter);
  table.parentElement?.insertBefore(toolbar, table);

  const filterRow = table.tHead.insertRow(1);
  filterRow.className = "ui-admin-excel-filter-row";

  Array.from(headerRow.cells).forEach((cell, index) => {
    const title = cell.textContent?.replace(/\s+/g, " ").trim() || `Columna ${index + 1}`;

    const filterCell = document.createElement("th");
    const filter = document.createElement("input");
    filter.className = "ui-admin-excel-filter";
    filter.type = "search";
    filter.placeholder = `Filtrar ${title}`;
    filter.setAttribute("aria-label", `Filtrar columna ${title}`);
    filter.addEventListener("input", () => {
      state.columnFilters[index] = normalizeText(filter.value);
      applyTableState();
    });
    filterCell.append(filter);
    filterRow.append(filterCell);

    cell.classList.add("ui-admin-excel-sortable");
    cell.tabIndex = 0;
    cell.title = `Ordenar por ${title}`;
    const setSort = () => {
      if (state.sortIndex === index) {
        state.sortDirection = state.sortDirection === "asc" ? "desc" : "asc";
      } else {
        state.sortIndex = index;
        state.sortDirection = "asc";
      }
      applyTableState();
    };
    cell.addEventListener("click", setSort);
    cell.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        setSort();
      }
    });

    const label = document.createElement("label");
    label.className = "ui-admin-excel-column-option";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = true;
    checkbox.addEventListener("change", () => {
      if (checkbox.checked) {
        state.hiddenColumns.delete(index);
      } else {
        state.hiddenColumns.add(index);
      }
      applyColumnVisibility();
    });
    const text = document.createElement("span");
    text.textContent = title;
    label.append(checkbox, text);
    columnList.append(label);
  });

  search.addEventListener("input", () => {
    state.globalFilter = normalizeText(search.value);
    applyTableState();
  });

  exportButton.addEventListener("click", () => {
    const visibleIndexes = Array.from({ length: columnCount }, (_, index) => index).filter(
      (index) => !state.hiddenColumns.has(index),
    );
    const headers = visibleIndexes.map((index) =>
      csvCell(headerRow.cells[index]?.textContent?.trim() ?? ""),
    );
    const rows = getDataRows()
      .filter((row) => row.style.display !== "none")
      .map((row) => visibleIndexes.map((index) => csvCell(getCellText(row, index))).join(","));
    const blob = new Blob([[headers.join(","), ...rows].join("\n")], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${tableLabel.toLowerCase().replace(/[^a-z0-9]+/gi, "-")}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  });

  function getDataRows() {
    return Array.from(table.tBodies[0]?.rows ?? []);
  }

  function applyColumnVisibility() {
    for (const row of Array.from(table.rows)) {
      Array.from(row.cells).forEach((cell, index) => {
        cell.classList.toggle("ui-admin-excel-hidden-cell", state.hiddenColumns.has(index));
      });
    }
  }

  function applyTableState() {
    const tbody = table.tBodies[0];
    const rows = getDataRows();

    if (state.sortIndex !== null) {
      const sorted = rows.slice().sort((left, right) => {
        const leftText = getCellText(left, state.sortIndex ?? 0);
        const rightText = getCellText(right, state.sortIndex ?? 0);
        const result = leftText.localeCompare(rightText, "es", {
          numeric: true,
          sensitivity: "base",
        });
        return state.sortDirection === "asc" ? result : -result;
      });
      for (const row of sorted) tbody.append(row);
    }

    let visibleCount = 0;
    for (const row of getDataRows()) {
      const rowText = normalizeText(row.textContent ?? "");
      const globalMatch = !state.globalFilter || rowText.includes(state.globalFilter);
      const columnMatch = state.columnFilters.every((filter, index) => {
        if (!filter) return true;
        return normalizeText(getCellText(row, index)).includes(filter);
      });
      const visible = globalMatch && columnMatch;
      row.style.display = visible ? "" : "none";
      if (visible) visibleCount += 1;
    }

    counter.textContent = `${visibleCount} visibles`;
    Array.from(headerRow.cells).forEach((cell, index) => {
      const active = state.sortIndex === index;
      cell.setAttribute(
        "aria-sort",
        active ? (state.sortDirection === "asc" ? "ascending" : "descending") : "none",
      );
      cell.classList.toggle("ui-admin-excel-sort-active", active);
    });
    applyColumnVisibility();
  }

  applyTableState();
}

export default function AdminTableExcelEnhancer() {
  useEffect(() => {
    const enhanceAll = () => {
      document
        .querySelectorAll<HTMLTableElement>(
          ".ui-admin-table-shell table, [data-admin-excel-scope='true'] table, table[data-admin-excel-table='true']",
        )
        .forEach(enhanceTable);
    };

    enhanceAll();
    const observer = new MutationObserver(enhanceAll);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return null;
}
