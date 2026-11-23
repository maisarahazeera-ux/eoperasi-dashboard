import { useEffect, useRef, useState } from "react";
import { Download, FileText, FileSpreadsheet, FileType, Loader2 } from "lucide-react";
import { useLanguage } from "../context/LanguageContext";
import { useAuth } from "../context/AuthContext";
import { useDataDate } from "../lib/dataInfo";
import { downloadExcel, downloadPdf, downloadCsv, type ReportMeta, type Report } from "../lib/report";
import { logDownload } from "../lib/api";

export type ReportFormat = "pdf" | "excel" | "csv";

interface Props {
  /** Builds the report from the page's current (filtered) data. */
  getReport: () => Report;
  /** Which downloads to offer. */
  formats?: ReportFormat[];
  /** Part of the page captured for the PDF. */
  captureSelector?: string;
  /** Tooltip on the icon (default "Muat turun laporan"). */
  title?: string;
}

/** Download icon with a small menu: PDF (page snapshot), Excel and CSV. */
export default function ReportButton({ getReport, formats = ["pdf", "excel", "csv"], captureSelector = "main.mac-main", title }: Props) {
  const { t, lang } = useLanguage();
  const { fullName, username, token } = useAuth();
  const dataDate = useDataDate();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<ReportFormat | null>(null);
  const [failed, setFailed] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!wrapRef.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", esc); };
  }, [open]);

  async function run(kind: ReportFormat) {
    setOpen(false);
    setFailed(false);
    setBusy(kind);
    const meta: ReportMeta = {
      dataDate,
      generatedBy: fullName || username || "-",
      locale: lang === "en" ? "en-GB" : "ms-MY",
      labels: {
        system: t("rpSystem"),
        dataDate: t("rpDataDate"),
        generatedBy: t("rpGeneratedBy"),
        generatedAt: t("rpGeneratedAt"),
        filters: t("rpFilters"),
        noFilters: t("rpNoFilters"),
        info: t("rpInfoSheet"),
        contents: t("rpContents"),
        total: t("rpTotal"),
        page: t("rpPage"),
        confidential: t("rpConfidential"),
      },
    };
    try {
      const report = getReport();
      if (kind === "excel") {
        if (report.excel) await report.excel(meta);
        else await downloadExcel(report, meta);
      } else if (kind === "csv") {
        downloadCsv(report, meta);
      } else {
        const el = document.querySelector<HTMLElement>(captureSelector);
        if (!el) throw new Error("Nothing to capture");
        await downloadPdf(el, report, meta);
      }
      // Log Aktiviti: who downloaded which report, in which format, with which filters.
      logDownload(token, {
        report: report.title,
        format: kind,
        filters: report.filters.join(" · "),
        rows: report.tables.length === 1 ? report.tables[0].rows.length : 0,
      });
    } catch (err) {
      console.error("Report download failed", err);
      setFailed(true);
    } finally {
      setBusy(null);
    }
  }

  const single = formats.length === 1;

  return (
    <div ref={wrapRef} data-report-hide="true" style={{ position: "relative", display: "inline-flex", alignItems: "center", gap: 8 }}>
      {failed && <span role="alert" style={{ fontSize: 11.5, color: "var(--bad-ink)" }}>{t("rpFailed")}</span>}
      <button
        type="button"
        className="soft-pill icon-btn"
        disabled={!!busy}
        title={busy ? t("rpWorking") : (title ?? t("rpDownloadReport"))}
        aria-label={title ?? t("rpDownloadReport")}
        aria-haspopup={single ? undefined : "menu"}
        aria-expanded={single ? undefined : open}
        onClick={() => (single ? run(formats[0]) : (setFailed(false), setOpen((v) => !v)))}
      >
        {busy ? <Loader2 size={16} className="spin" /> : <Download size={16} />}
      </button>
      {open && (
        <div role="menu" className="soft-dialog" style={{
          position: "absolute", right: 0, top: "calc(100% + 6px)", zIndex: 50, padding: 6, width: 280, maxWidth: "calc(100vw - 32px)", borderRadius: 14,
          display: "flex", flexDirection: "column", gap: 2, textAlign: "left",
        }}>
          {formats.includes("pdf") && (
            <MenuItem icon={<FileText size={16} />} tone="rose" title={t("rpPdf")} sub={t("rpPdfSub")} onClick={() => run("pdf")} />
          )}
          {formats.includes("excel") && (
            <MenuItem icon={<FileSpreadsheet size={16} />} tone="teal" title={t("rpExcel")} sub={t("rpExcelSub")} onClick={() => run("excel")} />
          )}
          {formats.includes("csv") && (
            <MenuItem icon={<FileType size={16} />} tone="blue" title={t("rpCsv")} sub={t("rpCsvSub")} onClick={() => run("csv")} />
          )}
        </div>
      )}
    </div>
  );
}

function MenuItem({ icon, tone, title, sub, onClick }: { icon: React.ReactNode; tone: string; title: string; sub: string; onClick: () => void }) {
  return (
    <button type="button" role="menuitem" onClick={onClick} className="report-menu-item"
      style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "9px 10px", border: "none", borderRadius: 10, background: "transparent", cursor: "pointer", textAlign: "left", fontFamily: "inherit", color: "var(--soft-text)" }}>
      <span style={{ width: 30, height: 30, borderRadius: 9, flexShrink: 0, background: `var(--tint-${tone})`, color: `var(--ink-${tone})`, display: "flex", alignItems: "center", justifyContent: "center" }}>{icon}</span>
      <span>
        <span style={{ display: "block", fontSize: 13, fontWeight: 700 }}>{title}</span>
        <span style={{ display: "block", fontSize: 11.5, color: "var(--soft-muted)", marginTop: 1 }}>{sub}</span>
      </span>
    </button>
  );
}
