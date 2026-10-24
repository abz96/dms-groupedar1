"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CONDITIONS, num, scoreBand, type CreditData } from "@/lib/credit";
import { fmtDesk } from "@/lib/deal";
import { useLang } from "@/lib/i18n";

const DEC: Record<string, { fr: string; en: string; fg: string; bg: string }> = {
  approved: { fr: "CRÉDIT APPROUVÉ", en: "CREDIT APPROVED", fg: "#1e7b45", bg: "#e7f6ec" },
  conditional: { fr: "APPROBATION CONDITIONNELLE", en: "CONDITIONAL APPROVAL", fg: "#a0620a", bg: "#fff4e0" },
  declined: { fr: "CRÉDIT REFUSÉ", en: "CREDIT DECLINED", fg: "#b42318", bg: "#fdecec" },
};

/** Shows the credit decision of the application linked to a quotation. */
export default function CreditStatusBanner({ dealId }: { dealId: number }) {
  const { lang } = useLang();
  const T = (fr: string, en: string) => (lang === "fr" ? fr : en);
  const [app, setApp] = useState<{ id: number; appNumber: string; data: CreditData } | null>(null);
  useEffect(() => {
    let alive = true;
    (async () => {
      const list = (await (await fetch("/api/credit")).json()) as { id: number; dealId: number | null }[];
      const hit = list.find((x) => x.dealId === dealId);
      if (!hit) return;
      const j = await (await fetch(`/api/credit/${hit.id}`)).json();
      if (alive) setApp({ id: j.id, appNumber: j.appNumber, data: j.data });
    })().catch(() => {});
    return () => {
      alive = false;
    };
  }, [dealId]);
  if (!app) return null;
  const d = app.data.decision;
  const score = num(app.data.bureau.score);
  if (!d.status) {
    return (
      <div className="mb-3 rounded-md border border-[#9fb3c4] bg-white px-3 py-2 text-[12.5px] text-[#3c5266] flex items-center gap-2">
        <b className="text-[#00263d]">{T("Demande de crédit", "Credit application")} {app.appNumber}</b> — {T("en attente des renseignements (revenu) pour l'analyse automatique.", "waiting for information (income) for the automatic analysis.")}
        <Link className="btn ml-auto" href={`/credit?id=${app.id}`}>{T("Compléter", "Complete")}</Link>
      </div>
    );
  }
  const st = DEC[d.status];
  const band = scoreBand(score);
  return (
    <div className="mb-3 rounded-md border-2 overflow-hidden" style={{ borderColor: st.fg, background: st.bg }}>
      <div className="flex flex-wrap items-center gap-3 px-3 py-2">
        <span className="text-[15px] font-extrabold tracking-wide" style={{ color: st.fg }}>{lang === "fr" ? st.fr : st.en}</span>
        {score > 0 && (
          <span className="text-[12px] font-bold px-2 py-0.5 rounded-sm bg-white border" style={{ color: band.color, borderColor: band.color }}>
            Equifax {score} · {lang === "fr" ? band.fr : band.en}
          </span>
        )}
        {d.status !== "declined" && d.approvedAmount && (
          <span className="text-[12.5px] text-[#00263d]">
            {T("Approuvé", "Approved")} <b>{fmtDesk(num(d.approvedAmount))} $</b> · {d.approvedRate} % · {d.approvedTerm} {T("mois", "mo")}
          </span>
        )}
        <span className="text-[11px] text-[#5a7086]">{d.auto === false ? T("décision du gestionnaire", "manager decision") : T("décision automatique", "automatic decision")}</span>
        <div className="ml-auto flex gap-1">
          <Link className="btn" href={`/credit?id=${app.id}`}>{T("Demande", "Application")}</Link>
          <Link className="btn btn-primary" href={`/equifax?id=${app.id}`}>Equifax</Link>
        </div>
      </div>
      {d.status === "conditional" && d.conditions.length > 0 && (
        <div className="px-3 pb-2 text-[12.5px] text-[#1e3a50]">
          <b className="text-[#a0620a]">{T("Conditions à remplir :", "Conditions to meet:")}</b>{" "}
          {d.conditions
            .map((k) => {
              const c = CONDITIONS.find((x) => x[0] === k);
              const lab = c ? (lang === "fr" ? c[1] : c[2]) : k;
              return k === "higher_down" && d.requiredDown ? `${lab} (${fmtDesk(num(d.requiredDown))} $)` : lab;
            })
            .join(" · ")}
        </div>
      )}
    </div>
  );
}
