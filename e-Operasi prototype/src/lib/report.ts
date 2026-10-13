// Report downloads: Excel (the numbers behind each chart) and PDF (a snapshot
// of the page). Both libraries are large, so they are only loaded when someone
// actually clicks "Muat Turun".

import { fixMonth } from "./dates";

export type Cell = string | number | null | undefined;

export interface ReportColumn {
  header: string;
  /** Approximate column width in characters (Excel). */
  width?: number;
  /** "int" = 1,234 · "pct" = 12.3% (value given as 0.123) · "dec" = 12.3 · "date" = yyyy-mm-dd string. */
  format?: "int" | "pct" | "dec" | "date";
}

export interface ReportTable {
  /** Sheet name in Excel (max 31 characters, made unique automatically). */
  name: string;
  /** Heading shown above the table. */
  title: string;
  columns: ReportColumn[];
  rows: Cell[][];
  /** Adds a bold "Jumlah" row that sums these column indexes. */
  totalColumns?: number[];
}

export interface Report {
  /** Page title, e.g. "Demografi Guru". Also used in the file name. */
  title: string;
  /** Filters in force, as readable lines, e.g. "Jenis Sekolah: SMK". */
  filters: string[];
  tables: ReportTable[];
  /** Optional: builds its own Excel file instead of the standard one (e.g. Carian Guru). */
  excel?: (meta: ReportMeta) => Promise<void>;
}

export interface ReportMeta {
  dataDate: string;       // yyyy-mm-dd
  generatedBy: string;
  labels: ReportLabels;
  locale: string;
}

/** Fixed words used inside the files (passed in so they follow the chosen language). */
export interface ReportLabels {
  system: string;         // "e-Operasi · Pejabat Pendidikan Daerah Johor Bahru"
  dataDate: string;       // "Tarikh data SEPADU"
  generatedBy: string;    // "Dijana oleh"
  generatedAt: string;    // "Dijana pada"
  filters: string;        // "Tapisan"
  noFilters: string;      // "Tiada (semua guru)"
  info: string;           // sheet name "Maklumat"
  contents: string;       // "Kandungan"
  total: string;          // "Jumlah"
  page: string;           // "Halaman"
  confidential: string;   // footer note
}

// ---------------------------------------------------------------- helpers

function fileStem(title: string, dataDate: string) {
  const safe = title.replace(/[^\p{L}\p{N}]+/gu, "_").replace(/^_|_$/g, "");
  return `e-Operasi_${safe}_${dataDate}`;
}

function nowText(locale: string) {
  return fixMonth(new Date().toLocaleString(locale, { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }));
}

function dateText(iso: string, locale: string) {
  const d = new Date(`${iso}T00:00:00`);
  return isNaN(d.getTime()) ? iso : d.toLocaleDateString(locale, { day: "numeric", month: "long", year: "numeric" });
}

function saveBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

// ---------------------------------------------------------------- Excel

const NAVY = "FF1F4FA0";
const HEAD_BG = "FF2F62B5";
const ZEBRA = "FFF4F7FC";
const LINE = "FFD9E1EE";

export async function downloadExcel(report: Report, meta: ReportMeta) {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = meta.generatedBy;
  wb.created = new Date();

  const L = meta.labels;
  const usedNames = new Set<string>();
  const sheetName = (raw: string) => {
    let base = raw.replace(/[\\/*?:[\]]/g, " ").trim().slice(0, 31) || "Sheet";
    let name = base, i = 2;
    while (usedNames.has(name.toLowerCase())) {
      const suffix = ` (${i++})`;
      name = base.slice(0, 31 - suffix.length) + suffix;
    }
    usedNames.add(name.toLowerCase());
    return name;
  };

  // Sheet 1: what this file is.
  const info = wb.addWorksheet(sheetName(L.info), { views: [{ showGridLines: false }] });
  info.columns = [{ width: 26 }, { width: 70 }];
  info.addRow([report.title]).font = { bold: true, size: 16, color: { argb: NAVY } };
  info.addRow([L.system]).font = { size: 10, color: { argb: "FF5B6576" } };
  info.addRow([]);
  const infoRows: [string, string][] = [
    [L.dataDate, dateText(meta.dataDate, meta.locale)],
    [L.generatedBy, meta.generatedBy],
    [L.generatedAt, nowText(meta.locale)],
    [L.filters, report.filters.length ? report.filters.join("\n") : L.noFilters],
  ];
  for (const [k, v] of infoRows) {
    const r = info.addRow([k, v]);
    r.getCell(1).font = { bold: true };
    r.getCell(2).alignment = { wrapText: true, vertical: "top" };
    r.getCell(1).alignment = { vertical: "top" };
  }
  info.addRow([]);
  info.addRow([L.contents]).font = { bold: true };
  report.tables.forEach((tb, i) => info.addRow([`${i + 1}.`, tb.title]));
  info.addRow([]);
  info.addRow([L.confidential]).font = { italic: true, size: 9, color: { argb: "FF8A94A6" } };

  // One sheet per table.
  for (const tb of report.tables) {
    const ws = wb.addWorksheet(sheetName(tb.name), { views: [{ state: "frozen", ySplit: 3 }] });
    ws.columns = tb.columns.map((c) => ({ width: c.width ?? Math.max(10, Math.min(48, c.header.length + 4)) }));

    const titleRow = ws.addRow([tb.title]);
    titleRow.font = { bold: true, size: 13, color: { argb: NAVY } };
    ws.addRow([`${L.dataDate}: ${dateText(meta.dataDate, meta.locale)}${report.filters.length ? " · " + report.filters.join(" · ") : ""}`])
      .font = { size: 9, color: { argb: "FF5B6576" } };

    const head = ws.addRow(tb.columns.map((c) => c.header));
    head.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEAD_BG } };
      cell.alignment = { vertical: "middle", wrapText: true };
      cell.border = { bottom: { style: "thin", color: { argb: LINE } } };
    });
    head.height = 22;

    tb.rows.forEach((row, ri) => {
      const r = ws.addRow(row.map((v) => (v === undefined ? null : v)));
      tb.columns.forEach((c, ci) => {
        const cell = r.getCell(ci + 1);
        if (c.format === "int") cell.numFmt = "#,##0";
        else if (c.format === "pct") cell.numFmt = "0.0%";
        else if (c.format === "dec") cell.numFmt = "#,##0.0";
        if (c.format && c.format !== "date") cell.alignment = { horizontal: "right" };
        cell.border = { bottom: { style: "hair", color: { argb: LINE } } };
        if (ri % 2 === 1) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: ZEBRA } };
      });
    });

    if (tb.totalColumns?.length && tb.rows.length) {
      const first = 4, last = 3 + tb.rows.length;
      const totals = tb.columns.map((_, ci) => {
        if (ci === 0) return L.total;
        if (!tb.totalColumns!.includes(ci)) return null;
        const col = ws.getColumn(ci + 1).letter;
        return { formula: `SUM(${col}${first}:${col}${last})` };
      });
      const r = ws.addRow(totals);
      r.font = { bold: true };
      tb.columns.forEach((c, ci) => {
        const cell = r.getCell(ci + 1);
        cell.border = { top: { style: "thin", color: { argb: NAVY } } };
        if (c.format === "int") { cell.numFmt = "#,##0"; cell.alignment = { horizontal: "right" }; }
      });
    }

    if (tb.rows.length) {
      ws.autoFilter = { from: { row: 3, column: 1 }, to: { row: 3 + tb.rows.length, column: tb.columns.length } };
    }
  }

  const buf = await wb.xlsx.writeBuffer();
  saveBlob(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    `${fileStem(report.title, meta.dataDate)}.xlsx`);
}

// ---------------------------------------------------------------- PDF

/**
 * Snapshot of `element` (the page content) into an A4 landscape PDF with a
 * header (title, data date, filters, who/when) and page numbers.
 * Always captured in the light theme so it prints well.
 */
export async function downloadPdf(element: HTMLElement, report: Report, meta: ReportMeta) {
  const [{ toCanvas }, { jsPDF }] = await Promise.all([import("html-to-image"), import("jspdf")]);
  const L = meta.labels;

  // Switch to light theme for the capture, then put the user's theme back.
  const root = document.documentElement;
  const prevTheme = root.getAttribute("data-theme");
  root.setAttribute("data-theme", "light");
  root.classList.add("report-capture");
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

  const PIXEL_RATIO = 2;
  let canvas: HTMLCanvasElement;
  // Good places for a page break (CSS px from the top): the bottom of each card
  // and each table row, so a page never cuts through the middle of one.
  const breaks: number[] = [];
  try {
    const width = element.scrollWidth;
    const height = element.scrollHeight;
    const top0 = element.getBoundingClientRect().top - element.scrollTop;
    element.querySelectorAll(".card, tr, .soft-grid > *").forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.height > 0) breaks.push(r.bottom - top0 + 6);
    });
    // The page background is transparent; JPEG would turn that black.
    const bg = getComputedStyle(root).getPropertyValue("--soft-bg").trim() || "#EEF2F8";
    canvas = await toCanvas(element, {
      pixelRatio: PIXEL_RATIO,
      width,
      height,
      backgroundColor: bg,
      // The page area normally scrolls; show all of it in the snapshot.
      style: { height: `${height}px`, maxHeight: "none", overflow: "visible", flex: "none" },
      // Download buttons and other controls don't belong in the PDF.
      filter: (node) => !(node instanceof HTMLElement && node.dataset.reportHide === "true"),
      skipFonts: true,
    });
  } finally {
    root.classList.remove("report-capture");
    if (prevTheme) root.setAttribute("data-theme", prevTheme); else root.removeAttribute("data-theme");
  }

  const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4", compress: true });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const margin = 10;
  const contentW = pageW - margin * 2;

  // ---- header on page 1
  let y = margin + 2;
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(16);
  pdf.setTextColor(31, 79, 160);
  pdf.text(report.title, margin, y + 4);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8.5);
  pdf.setTextColor(91, 101, 118);
  pdf.text(L.system, margin, y + 9);
  const right = [
    `${L.dataDate}: ${dateText(meta.dataDate, meta.locale)}`,
    `${L.generatedBy}: ${meta.generatedBy}`,
    `${L.generatedAt}: ${nowText(meta.locale)}`,
  ];
  right.forEach((line, i) => pdf.text(line, pageW - margin, y + 2 + i * 4, { align: "right" }));
  y += 15;
  const filterLine = `${L.filters}: ${report.filters.length ? report.filters.join(" · ") : L.noFilters}`;
  const filterLines = pdf.splitTextToSize(filterLine, contentW) as string[];
  pdf.setTextColor(21, 32, 51);
  pdf.text(filterLines, margin, y);
  y += filterLines.length * 4 + 2;
  pdf.setDrawColor(217, 225, 238);
  pdf.line(margin, y, pageW - margin, y);
  y += 3;

  // ---- the snapshot, sliced across pages
  const footerH = 8;
  const mmPerPx = contentW / canvas.width;
  let srcY = 0;
  let first = true;
  while (srcY < canvas.height) {
    const top = first ? y : margin;
    const availMm = pageH - top - footerH;
    let slicePx = Math.min(canvas.height - srcY, Math.floor(availMm / mmPerPx));
    if (srcY + slicePx < canvas.height) {
      // Move the cut up to the nearest card/row edge, unless that wastes more than 40% of the page.
      const limit = srcY + slicePx;
      const best = breaks.map((b) => Math.round(b * PIXEL_RATIO)).filter((b) => b <= limit && b > srcY + slicePx * 0.6).sort((a, b) => b - a)[0];
      if (best) slicePx = best - srcY;
    }
    const slice = document.createElement("canvas");
    slice.width = canvas.width;
    slice.height = slicePx;
    slice.getContext("2d")!.drawImage(canvas, 0, srcY, canvas.width, slicePx, 0, 0, canvas.width, slicePx);
    if (!first) pdf.addPage();
    pdf.addImage(slice.toDataURL("image/jpeg", 0.92), "JPEG", margin, top, contentW, slicePx * mmPerPx);
    srcY += slicePx;
    first = false;
  }

  // ---- footer on every page
  const pages = pdf.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    pdf.setPage(p);
    pdf.setFontSize(7.5);
    pdf.setTextColor(138, 148, 166);
    pdf.text(L.confidential, margin, pageH - 5);
    pdf.text(`${L.page} ${p} / ${pages}`, pageW - margin, pageH - 5, { align: "right" });
  }

  pdf.save(`${fileStem(report.title, meta.dataDate)}.pdf`);
}

// ---------------------------------------------------------------- table helpers used by the pages

/** [label, count] pairs -> rows of label, count, share of `total`. */
export function countRows(items: [string, number][], total: number): Cell[][] {
  return items.map(([label, count]) => [label, count, total ? count / total : 0]);
}

/** Standard "label | Bilangan Guru | Peratus" table with a total row. */
export function countTable(
  name: string, title: string, labelHeader: string, items: [string, number][], total: number,
  h: { count: string; pct: string }, labelWidth = 34,
): ReportTable {
  return {
    name, title,
    columns: [{ header: labelHeader, width: labelWidth }, { header: h.count, format: "int", width: 15 }, { header: h.pct, format: "pct", width: 11 }],
    rows: countRows(items, total),
    totalColumns: [1],
  };
}

// ---------------------------------------------------------------- CSV

/**
 * All tables in one .csv file, one after another (title row, header row, data,
 * total, blank line). UTF-8 with BOM so Excel shows Malay text and symbols correctly.
 */
export function downloadCsv(report: Report, meta: ReportMeta) {
  const L = meta.labels;
  const esc = (v: Cell) => {
    if (v === null || v === undefined) return "";
    const s = String(v);
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const fmtCell = (v: Cell, c: ReportColumn | undefined) =>
    c?.format === "pct" && typeof v === "number" ? `${(v * 100).toFixed(1)}%` : v;

  const lines: string[] = [];
  const row = (cells: Cell[]) => lines.push(cells.map(esc).join(","));

  row([report.title]);
  row([L.system]);
  row([L.dataDate, dateText(meta.dataDate, meta.locale)]);
  row([L.generatedBy, meta.generatedBy]);
  row([L.generatedAt, nowText(meta.locale)]);
  row([L.filters, report.filters.length ? report.filters.join(" · ") : L.noFilters]);
  row([]);

  for (const tb of report.tables) {
    row([tb.title]);
    row(tb.columns.map((c) => c.header));
    tb.rows.forEach((r) => row(r.map((v, i) => fmtCell(v, tb.columns[i]))));
    if (tb.totalColumns?.length && tb.rows.length) {
      row(tb.columns.map((_, ci) => {
        if (ci === 0) return L.total;
        if (!tb.totalColumns!.includes(ci)) return null;
        return tb.rows.reduce((s, r) => s + (typeof r[ci] === "number" ? (r[ci] as number) : 0), 0);
      }));
    }
    row([]);
  }
  row([L.confidential]);

  saveBlob(new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" }),
    `${fileStem(report.title, meta.dataDate)}.csv`);
}
