"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useT } from "@/lib/i18n";

export const DOCS: { key: string; label: string; icon: string }[] = [
  { key: "offer", label: "Feuille d'offre", icon: "" },
  { key: "lease-agreement", label: "Contrat de location", icon: "" },
  { key: "finance-agreement", label: "Contrat de financement", icon: "" },
  { key: "bill-of-sale", label: "Contrat de vente", icon: "" },
  { key: "credit-application", label: "Demande de crédit", icon: "" },
  { key: "credit-approval", label: "Approbation de crédit", icon: "" },
  { key: "warranty", label: "Garantie prolongée", icon: "" },
  { key: "tire-rim", label: "Pneus & jantes", icon: "" },
  { key: "fi-products", label: "Plans de protection F&A", icon: "" },
  { key: "accessories", label: "Accessoires", icon: "" },
];

export const docHref = (id: number, key: string, lang: string, auto = false) =>
  (key === "offer" ? `/deals/${id}/print?lang=${lang}` : `/deals/${id}/documents/${key}?lang=${lang}`) + (auto ? "&auto=1" : "");

export default function PrintToolbar({ id, auto, lang, doc = "offer" }: { id: number; auto?: boolean; lang: "fr" | "en"; doc?: string }) {
  const t = useT();
  useEffect(() => {
    if (auto) {
      const tm = setTimeout(() => window.print(), 400);
      return () => clearTimeout(tm);
    }
  }, [auto]);
  return (
    <div className="no-print sticky top-0 z-10 shadow">
      <div className="win-title flex flex-wrap items-center gap-2 px-3 py-2">
        <Link href={`/deals/${id}`} className="btn">{t("← Retour au dossier")}</Link>
        <Link href="/deals" className="btn">{t("Dossiers")}</Link>
        <span className="ml-4 text-sm text-[#cfe3f2]">{t("Aperçu avant impression — format Lettre (8½ × 11)")}</span>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-sm text-[#cfe3f2]">{t("Langue de la feuille")} :</span>
          <div className="flex border border-white/50 rounded-sm overflow-hidden">
            {(["fr", "en"] as const).map((l) => (
              <Link
                key={l}
                href={docHref(id, doc, l)}
                replace
                className={`px-3 py-1 text-xs font-semibold ${lang === l ? "bg-white text-[#005a96]" : "text-[#cfe3f2] hover:bg-white/10"}`}
              >
                {l === "fr" ? "Français" : "English"}
              </Link>
            ))}
          </div>
          <button className="btn btn-primary !bg-white !text-[#005a96]" onClick={() => window.print()}>
            {doc === "all" ? `${t("Imprimer tous les documents")}` : t("Imprimer")}
          </button>
          {doc !== "all" && (
            <Link href={docHref(id, "all", lang, true)} className="btn !font-semibold" title={t("Feuille d'offre + contrat de vente + garantie + pneus & jantes + accessoires")}>
              {t("Imprimer tout")}
            </Link>
          )}
        </div>
      </div>
      <div className="flex flex-wrap gap-1 px-3 py-1.5 bg-[#dfe8f0] border-b border-[#a9bccb]">
        <span className="text-[12px] font-semibold text-[#003a5d] self-center mr-2">{t("Documents du dossier")} :</span>
        {DOCS.map((d) => (
          <Link
            key={d.key}
            href={docHref(id, d.key, lang)}
            replace
            className={`px-3 py-1 text-[12px] border rounded-sm ${
              doc === d.key ? "bg-[#0071bc] text-white border-[#005a96] font-semibold" : "bg-white text-[#003a5d] border-[#a9bccb] hover:border-[#0071bc]"
            }`}
          >
            {t(d.label)}
          </Link>
        ))}
        <Link
          href={docHref(id, "all", lang)}
          replace
          className={`ml-auto px-3 py-1 text-[12px] border rounded-sm font-semibold ${
            doc === "all" ? "bg-[#00263d] text-white border-[#00263d]" : "bg-white text-[#00263d] border-[#00263d] hover:bg-[#e6f1fa]"
          }`}
        >
          {t("Tous les documents")}
        </Link>
      </div>
    </div>
  );
}
