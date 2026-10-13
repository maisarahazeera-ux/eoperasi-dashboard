// Carian Guru export, laid out like PPD's "Senarai Pengetua dan Guru Besar" file:
// title, source, Tarikh Kiraan (=TODAY()), totals, then 14 columns where the
// service periods are Excel formulas that update by themselves every day.

import type { Teacher } from "./api";
import { jawatanLabel } from "./pgb";

export interface TeacherListLabels {
  title: string;               // "Senarai Pengetua dan Guru Besar PPD Johor Bahru"
  source: string;              // "Sumber: Data SEPADU ... bertarikh 2 September 2026."
  calcDate: string;            // "Tarikh Kiraan"
  note: string;                // "Tempoh dan baki perkhidmatan dikira secara automatik ..."
  filters: string | null;      // "Tapisan: ..." or null
  summary: [string, number][]; // e.g. [["Jumlah PGB", 138], ["Guru Besar", 97], ...]
  headers: string[];           // the 14 column headers
  words: { year: string; month: string; day: string; retired: string; yearOne?: string; monthOne?: string; dayOne?: string };
  fullSheet: string;           // second sheet name, e.g. "Maklumat Penuh"
  fullHeaders: string[];       // headers of the second sheet
  confidential: string;
}

const HEAD_BG = "FF17365D";   // same dark blue as the reference file
const LINE = "FFD9E1EE";

function toDate(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);   // UTC midnight = the same calendar day in Excel
  return isNaN(d.getTime()) ? null : d;
}

const up = (s: string | null | undefined) => (s ?? "").toUpperCase();

export async function downloadTeacherListExcel(
  teachers: Teacher[], labels: TeacherListLabels, fileName: string,
  fullRows: (x: Teacher) => (string | number | null)[],
) {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(labels.title.slice(0, 31).replace(/[\\/*?:[\]]/g, " "), {
    views: [{ state: "frozen", xSplit: 4, ySplit: 9 }],
  });

  const widths = [10, 34, 30, 16, 22, 8, 14, 14, 13, 28, 46, 24, 24, 24];
  ws.columns = widths.map((w) => ({ width: w }));

  ws.getCell("A2").value = labels.title;
  ws.getCell("A2").font = { bold: true, size: 15 };
  ws.getCell("A3").value = labels.source;
  ws.getCell("A3").font = { italic: true, size: 10 };
  ws.getCell("A4").value = labels.calcDate;
  ws.getCell("A4").font = { bold: true };
  ws.getCell("B4").value = { formula: "TODAY()" };
  ws.getCell("B4").numFmt = "dd/mm/yyyy";
  ws.getCell("B4").alignment = { horizontal: "left" };
  if (labels.filters) {
    ws.getCell("D4").value = labels.filters;
    ws.getCell("D4").font = { size: 10, color: { argb: "FF5B6576" } };
  }

  // Totals in pairs: label, number, label, number, ...
  labels.summary.forEach(([label, n], i) => {
    const l = ws.getCell(6, 1 + i * 2), v = ws.getCell(6, 2 + i * 2);
    l.value = label; l.font = { bold: true };
    v.value = n; v.alignment = { horizontal: "left" };
  });
  ws.getCell("A7").value = labels.note;
  ws.getCell("A7").font = { italic: true, size: 9, color: { argb: "FF5B6576" } };

  const head = ws.getRow(9);
  labels.headers.forEach((h, i) => {
    const c = head.getCell(i + 1);
    c.value = h;
    c.font = { bold: true, color: { argb: "FFFFFFFF" } };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEAD_BG } };
    c.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    c.border = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } };
  });
  head.height = 32;

  // Same formulas as the reference file: "x tahun y bulan z hari", using Tarikh Kiraan ($B$4).
  const w = labels.words;
  const months = (a: string, b: string) => `((YEAR(${b})-YEAR(${a}))*12+MONTH(${b})-MONTH(${a})-IF(DAY(${b})<DAY(${a}),1,0))`;
  // n & " year(s)": the singular word when n = 1 ("1 year", not "1 years").
  const unit = (n: string, many: string, one?: string) =>
    one && one !== many ? `${n}&IF(${n}=1," ${one}"," ${many}")` : `${n}&" ${many}"`;
  const span = (a: string, b: string) =>
    `${unit(`INT(${months(a, b)}/12)`, w.year, w.yearOne)}&" "&${unit(`MOD(${months(a, b)},12)`, w.month, w.monthOne)}&" "&${unit(`(${b}-EDATE(${a},${months(a, b)}))`, w.day, w.dayOne)}`;

  teachers.forEach((x, i) => {
    const r = 10 + i;
    const row = ws.getRow(r);
    const values: (string | Date | null)[] = [
      x.schoolCode || null, up(x.school), up(x.name), x.icNumber, up(jawatanLabel(x)), x.gredPenyandang,
      toDate(x.tarikhLantikanJawatanSemasa), toDate(x.tarikhKhidmatSekolahSemasa), toDate(x.retirementDate),
      up(x.subjects.map((s) => s.name).join("; ")) || null, up(x.address) || null,
    ];
    values.forEach((v, c) => { row.getCell(c + 1).value = v; });
    [7, 8, 9].forEach((c) => { row.getCell(c).numFmt = "dd/mm/yyyy"; });
    row.getCell(12).value = { formula: `IF(H${r}="","",${span(`H${r}`, "$B$4")})` };
    row.getCell(13).value = { formula: `IF(G${r}="","",${span(`G${r}`, "$B$4")})` };
    row.getCell(14).value = { formula: `IF(I${r}="","",IF(I${r}<$B$4,"${w.retired.toUpperCase()}",${span("$B$4", `I${r}`)}))` };
    for (let c = 1; c <= 14; c++) {
      const cell = row.getCell(c);
      cell.border = { bottom: { style: "hair", color: { argb: LINE } }, left: { style: "hair", color: { argb: LINE } }, right: { style: "hair", color: { argb: LINE } } };
      cell.alignment = { vertical: "top", wrapText: c === 2 || c === 3 || c === 10 || c === 11 };
    }
  });
  if (teachers.length) {
    ws.autoFilter = { from: { row: 9, column: 1 }, to: { row: 9 + teachers.length, column: 14 } };
  }
  const foot = ws.getRow(11 + teachers.length);
  foot.getCell(1).value = labels.confidential;
  foot.getCell(1).font = { italic: true, size: 9, color: { argb: "FF8A94A6" } };

  // Second sheet: every detail (phone, email, qualifications, ...).
  const full = wb.addWorksheet(labels.fullSheet, { views: [{ state: "frozen", xSplit: 1, ySplit: 1 }] });
  full.columns = labels.fullHeaders.map((h) => ({ width: Math.max(10, Math.min(46, h.length + 6)) }));
  const fh = full.getRow(1);
  labels.fullHeaders.forEach((h, i) => {
    const c = fh.getCell(i + 1);
    c.value = h;
    c.font = { bold: true, color: { argb: "FFFFFFFF" } };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEAD_BG } };
    c.alignment = { vertical: "middle", wrapText: true };
  });
  fh.height = 30;
  teachers.forEach((x) => full.addRow(fullRows(x)));
  if (teachers.length) {
    full.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1 + teachers.length, column: labels.fullHeaders.length } };
  }

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = fileName;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
