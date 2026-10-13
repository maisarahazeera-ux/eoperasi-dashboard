import { useLanguage } from "../context/LanguageContext";
import { useDataDate } from "../lib/dataInfo";
import { fixMonth } from "../lib/dates";

/**
 * Page heading: "Data SEPADU · dikemas kini 2 Sep 2026" above a big title,
 * with optional controls (filters) on the right.
 */
export default function PageHero({ title, children }: { title: string; children?: React.ReactNode }) {
  const { t, lang } = useLanguage();
  const locale = lang === "en" ? "en-GB" : "ms-MY";
  const dataDate = useDataDate();
  const date = fixMonth(new Date(dataDate).toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" }));

  return (
    <div className="soft-hero">
      <div style={{ minWidth: 0 }}>
        <div className="soft-hero-kicker">{t("macDataAsOf")} · {t("softUpdated")} {date}</div>
        <h1 className="soft-hero-title">{title}</h1>
      </div>
      {children && <div className="soft-hero-right">{children}</div>}
    </div>
  );
}
