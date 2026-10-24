"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  autoDecide,
  readyForAuto,
  CONDITIONS,
  creditMetrics,
  emptyCredit,
  emptyTradeline,
  maskSin,
  num,
  SCORE_BANDS,
  scoreBand,
  suggestDecision,
  type CreditData,
  type DecisionStatus,
  type Tradeline,
} from "@/lib/credit";
import { fmtDesk } from "@/lib/deal";
import { useLang } from "@/lib/i18n";
import { useSessionUser } from "@/lib/session-context";

interface AppRow {
  id: number;
  appNumber: string;
  applicantName: string;
  status: string;
  updatedAt: string;
  vehicle: string;
  quoteNumber?: string;
  score?: string;
  decision?: string;
}

const EFX = "#9e1b32"; // Equifax red
const DEC_STYLE: Record<string, { bg: string; fg: string; fr: string; en: string }> = {
  approved: { bg: "#e7f6ec", fg: "#1e7b45", fr: "APPROUVÉ", en: "APPROVED" },
  conditional: { bg: "#fff4e0", fg: "#a0620a", fr: "APPROBATION CONDITIONNELLE", en: "CONDITIONAL APPROVAL" },
  declined: { bg: "#fdecec", fg: "#b42318", fr: "REFUSÉ", en: "DECLINED" },
};

/* ---------------------------------------------------------------- small UI pieces (top-level: no remount on render) */

function Card({ title, right, children, accent }: { title: string; right?: ReactNode; children: ReactNode; accent?: string }) {
  return (
    <section className="bg-white rounded-md border border-[#cbd8e3] shadow-[0_1px_3px_rgba(0,38,61,0.08)] overflow-hidden">
      <header className="flex items-center gap-2 px-4 py-2 border-b border-[#e3eaf1]" style={accent ? { borderTop: `3px solid ${accent}` } : undefined}>
        <h3 className="text-[12px] font-bold uppercase tracking-wider text-[#00263d]">{title}</h3>
        <div className="ml-auto">{right}</div>
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}

function Field({ label, value, onChange, type = "text", w = "" }: { label: string; value: string; onChange: (v: string) => void; type?: string; w?: string }) {
  return (
    <label className={w}>
      <span className="text-[10px] font-bold uppercase tracking-wider text-[#5a7086]">{label}</span>
      <input className="fld !h-8 mt-0.5" type={type} value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

function Gauge({ score, lang }: { score: number; lang: "fr" | "en" }) {
  const s = Math.max(300, Math.min(900, score || 300));
  const cx = 150, cy = 140, r = 110;
  const ang = (v: number) => 180 - ((v - 300) / 600) * 180;
  const pt = (a: number, rr = r) => [cx + rr * Math.cos((a * Math.PI) / 180), cy - rr * Math.sin((a * Math.PI) / 180)];
  const arc = (from: number, to: number) => {
    const [x1, y1] = pt(ang(from));
    const [x2, y2] = pt(ang(to));
    return `M ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2}`;
  };
  const band = scoreBand(score);
  const [nx, ny] = pt(ang(s), r - 18);
  return (
    <svg viewBox="0 0 300 170" className="w-full max-w-[340px] mx-auto">
      {SCORE_BANDS.map((b) => (
        <path key={b.min} d={arc(b.min, b.max + (b.max === 900 ? 0 : 1))} stroke={b.color} strokeWidth={20} fill="none" opacity={score && b === band ? 1 : 0.35} />
      ))}
      <line x1={cx} y1={cy} x2={nx} y2={ny} stroke="#00263d" strokeWidth={4} strokeLinecap="round" />
      <circle cx={cx} cy={cy} r={8} fill="#00263d" />
      <text x={cx} y={cy - 38} textAnchor="middle" fontSize="38" fontWeight="800" fill="#00263d">{score ? s : "—"}</text>
      <text x={cx} y={cy - 16} textAnchor="middle" fontSize="12" fontWeight="800" fill={score ? band.color : "#93a8ba"} letterSpacing="1">
        {score ? (lang === "fr" ? band.fr : band.en) : lang === "fr" ? "AUCUN POINTAGE" : "NO SCORE"}
      </text>
      <text x={pt(180)[0]} y={cy + 22} textAnchor="middle" fontSize="11" fill="#5a7086">300</text>
      <text x={pt(0)[0]} y={cy + 22} textAnchor="middle" fontSize="11" fill="#5a7086">900</text>
    </svg>
  );
}

/* ---------------------------------------------------------------- page */

export default function EquifaxManager({ initialId }: { initialId: number | null }) {
  const { lang } = useLang();
  const T = (fr: string, en: string) => (lang === "fr" ? fr : en);
  const me = useSessionUser();
  const canDecide = me?.role === "admin" || me?.permission === "finance";
  const loc = lang === "fr" ? "fr-CA" : "en-CA";
  const [list, setList] = useState<AppRow[] | null>(null);
  const [sel, setSel] = useState<number | null>(initialId);
  const [data, setData] = useState<CreditData>(emptyCredit());
  const [meta, setMeta] = useState<{ appNumber: string; status: string; dealId: number | null }>({ appNumber: "", status: "draft", dealId: null });
  const [q, setQ] = useState("");
  const [save, setSave] = useState("");
  const loaded = useRef(false);

  const reload = useCallback(async () => {
    const r = await fetch("/api/credit");
    setList(await r.json());
  }, []);
  const [genErr, setGenErr] = useState("");
  const [generating, setGenerating] = useState(false);
  const generate = useCallback(async (id: number) => {
    setGenerating(true);
    setGenErr("");
    const r = await fetch(`/api/credit/${id}/generate`, { method: "POST" });
    const j = await r.json();
    setGenerating(false);
    if (!r.ok) {
      setGenErr(j.error ?? "Erreur");
      return;
    }
    loaded.current = false;
    setData(j.data);
    setMeta((m) => ({ ...m, status: j.status }));
    setTimeout(() => (loaded.current = true), 50);
  }, []);
  const open = useCallback(async (id: number) => {
    loaded.current = false;
    setSel(id);
    setGenErr("");
    const j = await (await fetch(`/api/credit/${id}`)).json();
    // automatic pull: complete application without a report → generate it now
    if (!num(j.data?.bureau?.score) && j.data?.bureau?.source !== "manual" && readyForAuto(j.data)) {
      setMeta({ appNumber: j.appNumber, status: j.status, dealId: j.dealId });
      history.replaceState(null, "", `/equifax?id=${id}`);
      await generate(id);
      return;
    }
    setData(j.data);
    setMeta({ appNumber: j.appNumber, status: j.status, dealId: j.dealId });
    history.replaceState(null, "", `/equifax?id=${id}`);
    setTimeout(() => (loaded.current = true), 50);
  }, [generate]);
  useEffect(() => {
    void reload();
    if (initialId) void open(initialId);
  }, [reload, open, initialId]);

  useEffect(() => {
    if (!sel || !loaded.current) return;
    setSave("…");
    const tm = setTimeout(async () => {
      const status = meta.status;
      await fetch(`/api/credit/${sel}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ data, status }) });
      setSave("ok");
      void reload();
    }, 700);
    return () => clearTimeout(tm);
  }, [data, sel, meta.status, reload]);

  const view = useMemo(() => autoDecide(data), [data]);
  const isAuto = view.decision.auto !== false;
  const m = useMemo(() => creditMetrics(data), [data]);
  const sug = useMemo(() => suggestDecision(data, m), [data, m]);
  const score = num(data.bureau.score);
  const band = scoreBand(score);
  const B = data.bureau;
  const setB = <K extends keyof CreditData["bureau"]>(k: K, v: CreditData["bureau"][K]) =>
    setData((d) => ({ ...d, bureau: { ...d.bureau, [k]: v, source: k === "score" || d.bureau.source === "manual" ? "manual" : d.bureau.source } }));
  const setDec = <K extends keyof CreditData["decision"]>(k: K, v: CreditData["decision"][K]) =>
    setData((d) => {
      if (k === "auto") return { ...d, decision: { ...d.decision, auto: Boolean(v) } };
      const base = autoDecide(d).decision; // freeze the current automatic values, then override
      return { ...d, decision: { ...base, [k]: v, auto: false, decidedBy: me?.name ?? base.decidedBy, decidedAt: new Date().toISOString() } };
    });
  const setTrade = (i: number, k: keyof Tradeline, v: string) => setB("tradelines", B.tradelines.map((x, j) => (j === i ? { ...x, [k]: v } : x)));

  const filtered = useMemo(() => {
    const s = q.toLowerCase().trim();
    return (list ?? []).filter((r) => !s || `${r.appNumber} ${r.applicantName} ${r.vehicle} ${r.quoteNumber ?? ""}`.toLowerCase().includes(s));
  }, [list, q]);

  const money = (n: number) => `${fmtDesk(n)} $`;
  const pct = (n: number) => (n >= 999 ? "999%" : `${n.toFixed(1)}%`);
  const tiles: { k: string; v: string; warn?: boolean; bad?: boolean }[] = [
    { k: T("Revenu mensuel", "Monthly income"), v: money(m.monthlyIncome) },
    { k: T("Taxes", "Taxes"), v: money(m.taxes) },
    { k: T("Montant financé", "Amount financed"), v: money(m.amountFinanced) },
    { k: T("Équité négative", "Negative equity"), v: money(m.negativeEquity), warn: m.negativeEquity > 0 },
    { k: "LTV (Black Book)", v: pct(m.ltv), warn: m.ltv > 125 && m.ltv < 999, bad: m.ltv > 175 },
    { k: T("Utilisation renouvelable", "Revolving utilization"), v: `${m.revolvingUtil.toFixed(0)}%`, warn: m.revolvingUtil > 50, bad: m.revolvingUtil > 75 },
    { k: `${T("Paiement est.", "Est. payment")} @${m.testRate.toFixed(2)}%`, v: money(m.estPayment) },
    { k: "PTI", v: pct(m.pti), warn: m.pti > 15 && m.pti < 999, bad: m.pti > 30 },
    { k: "TDS", v: pct(m.tds), warn: m.tds > 42 && m.tds < 999, bad: m.tds > 60 },
  ];

  function decide(status: DecisionStatus) {
    setData((d) => ({
      ...d,
      decision: {
        ...autoDecide(d).decision,
        auto: false,
        status,
        conditions: status === "conditional" ? (d.decision.conditions.length ? d.decision.conditions : sug.conditions) : status === "approved" ? [] : d.decision.conditions,
        requiredDown: status === "conditional" && !d.decision.requiredDown && sug.requiredDown ? String(sug.requiredDown) : d.decision.requiredDown,
        approvedAmount: d.decision.approvedAmount || (status !== "declined" ? String(Math.round(m.amountFinanced - (status === "conditional" ? sug.requiredDown : 0))) : ""),
        approvedRate: d.decision.approvedRate || d.rate || String(m.testRate),
        approvedTerm: d.decision.approvedTerm || d.termRequested || String(m.testTerm),
        lender: d.decision.lender || d.lender,
        decidedBy: me?.name ?? "",
        decidedAt: new Date().toISOString(),
      },
    }));
    setMeta((x) => ({ ...x, status: status || "submitted" }));
  }

  const lbl = "text-[10px] font-bold uppercase tracking-wider text-[#5a7086]";
  const th = "px-2 py-1.5 text-left font-bold text-[10px] uppercase tracking-wider text-white";
  const cellIn = "w-full h-7 px-1.5 text-[12px] border border-[#cbd8e3] rounded-sm outline-none focus:border-[#0071bc]";
  const dec = DEC_STYLE[view.decision.status];

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[320px_minmax(0,1fr)] gap-4 items-start">
      {/* ---------------- list ---------------- */}
      <aside className="bg-white rounded-md border border-[#cbd8e3] shadow-[0_1px_3px_rgba(0,38,61,0.08)] overflow-hidden xl:sticky xl:top-[72px]">
        <div className="px-4 py-3 text-white" style={{ background: `linear-gradient(90deg, ${EFX}, #6d1022)` }}>
          <div className="text-[16px] font-bold tracking-wide">EQUIFAX</div>
          <div className="text-[11px] text-white/80">{T("Approbation de crédit", "Credit approval")}</div>
        </div>
        <div className="p-3 border-b border-[#e3eaf1] space-y-2">
          <input className="fld !h-8" placeholder={T("Recherche — client, CA#, quotation…", "Search — client, CA#, quotation…")} value={q} onChange={(e) => setQ(e.target.value)} />
          <Link className="btn w-full !py-1.5 text-center block" href="/credit">+ {T("Nouvelle demande de crédit", "New credit application")}</Link>
        </div>
        <div className="max-h-[65vh] overflow-y-auto">
          {list === null && <div className="p-4 text-[13px] text-[#5a7086]">{T("Chargement…", "Loading…")}</div>}
          {list !== null && filtered.length === 0 && <div className="p-4 text-[13px] text-[#5a7086]">{T("Aucune demande de crédit.", "No credit applications.")}</div>}
          {filtered.map((r) => {
            const sc = num(r.score ?? "");
            const bd = scoreBand(sc);
            const ds = r.decision ? DEC_STYLE[r.decision] : null;
            return (
              <button
                key={r.id}
                onClick={() => void open(r.id)}
                className={`w-full text-left px-4 py-2.5 border-b border-[#eef3f7] border-l-[3px] ${sel === r.id ? "bg-[#fdf2f4]" : "border-l-transparent hover:bg-[#f8fafc]"}`}
                style={sel === r.id ? { borderLeftColor: EFX } : undefined}
              >
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-[13px] text-[#00263d] truncate">{r.applicantName || T("(sans nom)", "(no name)")}</span>
                  <span className="ml-auto text-[13px] font-bold tabular-nums" style={{ color: sc ? bd.color : "#93a8ba" }}>{sc || "—"}</span>
                </div>
                <div className="text-[11px] text-[#5a7086] truncate">
                  <span className="font-mono">{r.appNumber}</span>
                  {r.quoteNumber ? ` · Q#${r.quoteNumber}` : ""}
                </div>
                {ds && (
                  <span className="inline-block mt-0.5 text-[9.5px] font-bold px-1.5 py-0.5 rounded-sm" style={{ background: ds.bg, color: ds.fg }}>
                    {lang === "fr" ? ds.fr : ds.en}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </aside>

      {/* ---------------- workspace ---------------- */}
      {!sel ? (
        <div className="bg-white rounded-md border border-dashed border-[#9fb3c4] p-12 text-center">
          <div className="text-[15px] font-semibold text-[#00263d]">{T("Sélectionnez une demande de crédit.", "Select a credit application.")}</div>
          <div className="text-[12.5px] text-[#5a7086] mt-1">
            {T("Entrez les données du rapport Equifax, consultez les ratios en direct et rendez la décision de crédit.", "Enter the Equifax report data, review live ratios and make the credit decision.")}
          </div>
        </div>
      ) : (
        <div className="space-y-4 min-w-0">
          {/* header */}
          <div className="bg-white rounded-md border border-[#cbd8e3] shadow-[0_1px_3px_rgba(0,38,61,0.08)] px-5 py-3 flex flex-wrap items-center gap-3" style={{ borderTop: `3px solid ${EFX}` }}>
            <div className="min-w-0">
              <div className={lbl}>
                {T("Demande", "Application")} <span className="font-mono">{meta.appNumber}</span>
                {data.quoteNumber && <> · {T("Quotation", "Quotation")} <span className="font-mono">#{data.quoteNumber}</span></>}
              </div>
              <div className="text-[19px] font-bold text-[#00263d] truncate">{`${data.applicant.firstName} ${data.applicant.lastName}`.trim() || T("Demandeur", "Applicant")}</div>
              <div className="text-[12px] text-[#5a7086] truncate">{data.vehicle || "—"}{data.lender ? ` · ${data.lender}` : ""}</div>
            </div>
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <span className="text-[11.5px] text-[#5a7086]">{save === "…" ? T("Sauvegarde…", "Saving…") : save === "ok" ? `✓ ${T("Sauvegardé", "Saved")}` : ""}</span>
              <Link className="btn !py-1.5" href={`/credit?id=${sel}`}>{T("Demande de crédit", "Credit application")}</Link>
              {meta.dealId && <Link className="btn !py-1.5" href={`/deals/${meta.dealId}`}>{T("Ouvrir le quotation", "Open quotation")}</Link>}
              <button className="btn !py-1.5" disabled={generating} onClick={() => sel && confirm(T("Générer un nouveau rapport automatique ? Les données saisies du rapport seront remplacées.", "Generate a new automatic report? Entered report data will be replaced.")) && void generate(sel)}>
                {generating ? T("Génération…", "Generating…") : B.score ? T("Régénérer le rapport", "Regenerate report") : T("Générer le rapport", "Generate report")}
              </button>
              <a className="btn btn-primary !py-1.5" href={`/credit/${sel}/approval?lang=${lang}`} target="_blank" rel="noreferrer">{T("Imprimer l'approbation", "Print approval")}</a>
            </div>
          </div>

          {/* score + metrics */}
          <div className="grid grid-cols-1 2xl:grid-cols-[380px_minmax(0,1fr)] gap-4">
            <Card title={T("Aperçu du pointage en direct", "Live Score Preview")} accent={EFX}>
              <Gauge score={score} lang={lang} />
              <div className="flex items-center gap-2 mt-1">
                <input
                  className="fld !h-10 !text-[20px] font-bold text-center tabular-nums"
                  inputMode="numeric"
                  maxLength={3}
                  placeholder="300–900"
                  value={B.score}
                  onChange={(e) => setB("score", e.target.value.replace(/\D/g, "").slice(0, 3))}
                />
              </div>
              <div className="text-[11px] text-[#5a7086] text-center mt-1.5">Equifax Risk Score 2.0 · {T("entrez le pointage pour mettre à jour", "enter score to update")}</div>
              <div className="flex mt-3 h-1.5 rounded-full overflow-hidden">
                {SCORE_BANDS.map((b) => (
                  <div key={b.min} style={{ background: b.color, flex: b.max - b.min }} title={`${b.min}–${b.max} ${lang === "fr" ? b.fr : b.en}`} />
                ))}
              </div>
              <div className="flex justify-between text-[9.5px] text-[#93a8ba] mt-0.5">
                {SCORE_BANDS.map((b) => <span key={b.min}>{b.min}</span>)}
                <span>900</span>
              </div>
              {num(B.score) > 0 && (num(B.score) < 300 || num(B.score) > 900) && <div className="text-[12px] text-red-700 mt-1">{T("Le pointage doit être entre 300 et 900.", "Score must be between 300 and 900.")}</div>}
            </Card>

            <Card title={T("Indicateurs du dossier (en direct)", "Deal Metrics (live)")} right={<span className="text-[11px] text-[#93a8ba]">{T("Taux test", "Test rate")} {m.testRate.toFixed(2)}% · {m.testTerm} {T("mois", "mo")}</span>}>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {tiles.map((x) => (
                  <div
                    key={x.k}
                    className={`rounded-md border px-3 py-2 ${x.bad ? "border-red-200 bg-red-50" : x.warn ? "border-amber-200 bg-amber-50" : "border-[#e3eaf1] bg-[#f8fafc]"}`}
                  >
                    <div className={lbl}>{x.k}</div>
                    <div className={`text-[18px] font-bold tabular-nums ${x.bad ? "text-red-700" : x.warn ? "text-amber-800" : "text-[#00263d]"}`}>{x.v}</div>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-3">
                <Field label={T("Valeur Black Book ($)", "Black Book value ($)")} value={B.bookValue} onChange={(v) => setB("bookValue", v)} />
                <Field label={T("Taux test (%)", "Test rate (%)")} value={B.testRate} onChange={(v) => setB("testRate", v)} />
                <Field label={T("Terme test (mois)", "Test term (months)")} value={B.testTerm} onChange={(v) => setB("testTerm", v)} />
                <div className="text-[11px] text-[#5a7086] self-end leading-tight">
                  {T("Logement", "Housing")} {money(m.housing)} · {T("Autres dettes", "Other debts")} {money(m.otherDebts)} / {T("mois", "mo")}
                </div>
              </div>
            </Card>
          </div>

          {/* Equifax report */}
          <section className="bg-white rounded-md border border-[#cbd8e3] shadow-[0_1px_3px_rgba(0,38,61,0.08)] overflow-hidden">
            <div className="flex flex-wrap items-center gap-3 px-4 py-2 text-white" style={{ background: EFX }}>
              <span className="text-[15px] font-extrabold tracking-[0.18em]">EQUIFAX</span>
              <span className="text-[12px] text-white/85">{T("Rapport de crédit — consommateur (Canada)", "Consumer Credit Report — Canada")}</span>
              <span className="ml-auto text-[10.5px] text-white/85 font-semibold">
                {B.source === "simulated"
                  ? T("Rapport généré automatiquement (simulation) — remplacez par le rapport Equifax réel au besoin", "Automatically generated report (simulation) — replace with the real Equifax report if needed")
                  : B.source === "manual"
                    ? T("Données saisies à partir du rapport Equifax", "Data entered from the Equifax report")
                    : T("Aucun rapport", "No report")}
              </span>
            </div>
            <div className="p-4 space-y-4">
              {/* subject + file */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="border border-[#e3eaf1] rounded-md p-3">
                  <div className={`${lbl} mb-1`}>{T("Identification du sujet", "Subject identification")}</div>
                  <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-[12.5px]">
                    {[
                      [T("Nom", "Name"), `${data.applicant.lastName.toUpperCase()}, ${data.applicant.firstName}`.replace(/^, |, $/g, "")],
                      [T("Naissance", "DOB"), data.applicant.dob || "—"],
                      ["NAS / SIN", maskSin(data.applicant.sin) || "—"],
                      [T("Adresse actuelle", "Current address"), [data.applicant.address, data.applicant.city, data.applicant.province, data.applicant.postal].filter(Boolean).join(", ") || "—"],
                      [T("Adresse précédente", "Previous address"), data.applicant.prevAddress || "—"],
                      [T("Employeur", "Employer"), [data.applicant.employer, data.applicant.occupation].filter(Boolean).join(" — ") || "—"],
                    ].map(([k, v]) => (
                      <div key={k} className="contents">
                        <dt className="text-[#5a7086]">{k}</dt>
                        <dd className="font-semibold text-[#00263d]">{v}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
                <div className="border border-[#e3eaf1] rounded-md p-3">
                  <div className={`${lbl} mb-1`}>{T("Sommaire du dossier", "File summary")}</div>
                  <div className="grid grid-cols-3 gap-2">
                    <Field label={T("Dossier depuis", "File since")} type="month" value={B.fileSince} onChange={(v) => setB("fileSince", v)} />
                    <Field label={T("Date du rapport", "Report date")} type="date" value={B.pulledAt} onChange={(v) => setB("pulledAt", v)} />
                    <Field label={T("N° de référence", "Reference #")} value={B.reference} onChange={(v) => setB("reference", v)} />
                  </div>
                  <div className="grid grid-cols-4 gap-2 mt-2 text-center">
                    {[
                      [T("Comptes", "Trades"), m.tradeCount],
                      [T("Demandes 12 m", "Inquiries 12m"), m.inquiries12],
                      [T("Recouvrements", "Collections"), m.openCollections],
                      [T("Dossiers publics", "Public records"), m.activePublic + m.dischargedPublic],
                    ].map(([k, v]) => (
                      <div key={String(k)} className="rounded-sm bg-[#f8fafc] border border-[#e3eaf1] py-1">
                        <div className="text-[18px] font-bold text-[#00263d]">{v}</div>
                        <div className="text-[9.5px] uppercase tracking-wider text-[#5a7086]">{k}</div>
                      </div>
                    ))}
                  </div>
                  <div className="text-[11.5px] text-[#5a7086] mt-2">
                    {T("Retards", "Late payments")} — 30 {T("jours", "days")} : <b>{m.late30}</b> · 60 : <b>{m.late60}</b> · 90+ : <b className={m.late90 ? "text-red-700" : ""}>{m.late90}</b>
                  </div>
                </div>
              </div>

              {/* tradelines */}
              <div>
                <div className="flex items-center mb-1">
                  <div className={lbl}>{T("Comptes de crédit (tradelines)", "Trade lines")}</div>
                  <button className="btn !py-0.5 ml-auto" onClick={() => setB("tradelines", [...B.tradelines, emptyTradeline()])}>+ {T("Ajouter un compte", "Add trade")}</button>
                </div>
                <div className="overflow-x-auto border border-[#e3eaf1] rounded-md">
                  <table className="w-full text-[12px] min-w-[1050px]">
                    <thead style={{ background: EFX }}>
                      <tr>
                        <th className={th}>{T("Créancier / membre", "Creditor / member")}</th>
                        <th className={th}>{T("Type", "Type")}</th>
                        <th className={th}>{T("Cote", "Rating")}</th>
                        <th className={th}>{T("Ouvert", "Opened")}</th>
                        <th className={th}>{T("Limite / crédit max.", "Limit / high credit")}</th>
                        <th className={th}>{T("Solde", "Balance")}</th>
                        <th className={th}>{T("Paiement/mois", "Payment/mo")}</th>
                        <th className={th}>{T("Arriéré", "Past due")}</th>
                        <th className={th}>30</th>
                        <th className={th}>60</th>
                        <th className={th}>90+</th>
                        <th className={th}>{T("Statut", "Status")}</th>
                        <th className={th} />
                      </tr>
                    </thead>
                    <tbody>
                      {B.tradelines.length === 0 && (
                        <tr>
                          <td colSpan={13} className="px-3 py-4 text-center text-[#5a7086]">{T("Aucun compte — ajoutez les comptes du rapport Equifax.", "No trades — add the trade lines from the Equifax report.")}</td>
                        </tr>
                      )}
                      {B.tradelines.map((x, i) => (
                        <tr key={i} className="border-t border-[#eef3f7]">
                          <td className="p-1 min-w-[160px]"><input className={cellIn} value={x.creditor} onChange={(e) => setTrade(i, "creditor", e.target.value)} placeholder="ex. TD VISA" /></td>
                          <td className="p-1 w-[120px]">
                            <select className={cellIn} value={x.type} onChange={(e) => setTrade(i, "type", e.target.value)}>
                              <option value="R">R — {T("Renouvelable", "Revolving")}</option>
                              <option value="I">I — {T("Versements", "Installment")}</option>
                              <option value="O">O — {T("Ouvert", "Open")}</option>
                              <option value="M">M — {T("Hypothèque", "Mortgage")}</option>
                            </select>
                          </td>
                          <td className="p-1 w-[66px]">
                            <select className={`${cellIn} font-bold ${num(x.rating) >= 3 ? "text-red-700" : num(x.rating) === 2 ? "text-amber-700" : "text-emerald-700"}`} value={x.rating} onChange={(e) => setTrade(i, "rating", e.target.value)}>
                              {["1", "2", "3", "4", "5", "7", "8", "9"].map((n) => <option key={n} value={n}>{x.type}{n}</option>)}
                            </select>
                          </td>
                          <td className="p-1 w-[120px]"><input className={cellIn} type="month" value={x.opened} onChange={(e) => setTrade(i, "opened", e.target.value)} /></td>
                          <td className="p-1 w-[105px]"><input className={`${cellIn} text-right`} value={x.limit} onChange={(e) => setTrade(i, "limit", e.target.value)} /></td>
                          <td className="p-1 w-[100px]"><input className={`${cellIn} text-right`} value={x.balance} onChange={(e) => setTrade(i, "balance", e.target.value)} /></td>
                          <td className="p-1 w-[90px]"><input className={`${cellIn} text-right`} value={x.payment} onChange={(e) => setTrade(i, "payment", e.target.value)} /></td>
                          <td className="p-1 w-[85px]"><input className={`${cellIn} text-right`} value={x.pastDue} onChange={(e) => setTrade(i, "pastDue", e.target.value)} /></td>
                          <td className="p-1 w-[44px]"><input className={`${cellIn} text-center`} value={x.late30} onChange={(e) => setTrade(i, "late30", e.target.value)} /></td>
                          <td className="p-1 w-[44px]"><input className={`${cellIn} text-center`} value={x.late60} onChange={(e) => setTrade(i, "late60", e.target.value)} /></td>
                          <td className="p-1 w-[44px]"><input className={`${cellIn} text-center`} value={x.late90} onChange={(e) => setTrade(i, "late90", e.target.value)} /></td>
                          <td className="p-1 w-[100px]">
                            <select className={cellIn} value={x.status} onChange={(e) => setTrade(i, "status", e.target.value)}>
                              <option value="open">{T("Ouvert", "Open")}</option>
                              <option value="closed">{T("Fermé", "Closed")}</option>
                              <option value="chargeoff">{T("Radié", "Charged off")}</option>
                            </select>
                          </td>
                          <td className="p-1 w-[30px] text-center"><button className="text-red-700" onClick={() => setB("tradelines", B.tradelines.filter((_, j) => j !== i))}>✕</button></td>
                        </tr>
                      ))}
                    </tbody>
                    {B.tradelines.length > 0 && (
                      <tfoot>
                        <tr className="border-t-2 border-[#cbd8e3] bg-[#f8fafc] font-bold">
                          <td className="px-2 py-1.5" colSpan={4}>{T("Totaux", "Totals")}</td>
                          <td className="px-2 py-1.5 text-right tabular-nums">{fmtDesk(B.tradelines.reduce((a, x) => a + num(x.limit), 0))}</td>
                          <td className="px-2 py-1.5 text-right tabular-nums">{fmtDesk(B.tradelines.reduce((a, x) => a + num(x.balance), 0))}</td>
                          <td className="px-2 py-1.5 text-right tabular-nums">{fmtDesk(B.tradelines.reduce((a, x) => a + num(x.payment), 0))}</td>
                          <td className="px-2 py-1.5 text-right tabular-nums">{fmtDesk(B.tradelines.reduce((a, x) => a + num(x.pastDue), 0))}</td>
                          <td className="px-2 py-1.5 text-center">{m.late30}</td>
                          <td className="px-2 py-1.5 text-center">{m.late60}</td>
                          <td className="px-2 py-1.5 text-center">{m.late90}</td>
                          <td colSpan={2} />
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
                <div className="text-[10.5px] text-[#93a8ba] mt-1">
                  {T("Cote : 1 = paie selon les conditions · 2 = 30 jours · 3 = 60 jours · 4 = 90 jours · 5 = 120 jours+ · 7 = programme de consolidation · 8 = reprise · 9 = mauvaise créance / recouvrement", "Rating: 1 = pays as agreed · 2 = 30 days · 3 = 60 days · 4 = 90 days · 5 = 120+ days · 7 = debt management program · 8 = repossession · 9 = bad debt / collection")}
                </div>
              </div>

              {/* inquiries / collections / public records */}
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                <div className="border border-[#e3eaf1] rounded-md p-3">
                  <div className="flex items-center mb-1">
                    <div className={lbl}>{T("Demandes de renseignements", "Inquiries")}</div>
                    <button className="btn !py-0 ml-auto" onClick={() => setB("inquiries", [...B.inquiries, { date: "", member: "" }])}>+</button>
                  </div>
                  {B.inquiries.length === 0 && <div className="text-[12px] text-[#93a8ba]">{T("Aucune", "None")}</div>}
                  {B.inquiries.map((x, i) => (
                    <div key={i} className="flex gap-1 mb-1">
                      <input className={`${cellIn} !w-[130px]`} type="date" value={x.date} onChange={(e) => setB("inquiries", B.inquiries.map((y, j) => (j === i ? { ...y, date: e.target.value } : y)))} />
                      <input className={cellIn} placeholder={T("Membre", "Member")} value={x.member} onChange={(e) => setB("inquiries", B.inquiries.map((y, j) => (j === i ? { ...y, member: e.target.value } : y)))} />
                      <button className="text-red-700 px-1" onClick={() => setB("inquiries", B.inquiries.filter((_, j) => j !== i))}>✕</button>
                    </div>
                  ))}
                </div>
                <div className="border border-[#e3eaf1] rounded-md p-3">
                  <div className="flex items-center mb-1">
                    <div className={lbl}>{T("Recouvrements", "Collections")}</div>
                    <button className="btn !py-0 ml-auto" onClick={() => setB("collections", [...B.collections, { date: "", agency: "", creditor: "", amount: "", status: "open" }])}>+</button>
                  </div>
                  {B.collections.length === 0 && <div className="text-[12px] text-[#93a8ba]">{T("Aucun", "None")}</div>}
                  {B.collections.map((x, i) => {
                    const up = (k: string, v: string) => setB("collections", B.collections.map((y, j) => (j === i ? { ...y, [k]: v } : y)));
                    return (
                      <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-1 mb-1.5 pb-1.5 border-b border-[#eef3f7]">
                        <input className={cellIn} placeholder={T("Agence", "Agency")} value={x.agency} onChange={(e) => up("agency", e.target.value)} />
                        <input className={cellIn} placeholder={T("Créancier d'origine", "Original creditor")} value={x.creditor} onChange={(e) => up("creditor", e.target.value)} />
                        <button className="text-red-700 px-1" onClick={() => setB("collections", B.collections.filter((_, j) => j !== i))}>✕</button>
                        <input className={cellIn} type="date" value={x.date} onChange={(e) => up("date", e.target.value)} />
                        <input className={`${cellIn} text-right`} placeholder="$" value={x.amount} onChange={(e) => up("amount", e.target.value)} />
                        <select className={cellIn} value={x.status} onChange={(e) => up("status", e.target.value)}>
                          <option value="open">{T("Non payé", "Unpaid")}</option>
                          <option value="paid">{T("Payé", "Paid")}</option>
                        </select>
                      </div>
                    );
                  })}
                </div>
                <div className="border border-[#e3eaf1] rounded-md p-3">
                  <div className="flex items-center mb-1">
                    <div className={lbl}>{T("Dossiers publics", "Public records")}</div>
                    <button className="btn !py-0 ml-auto" onClick={() => setB("publicRecords", [...B.publicRecords, { type: "bankruptcy", date: "", amount: "", status: "active" }])}>+</button>
                  </div>
                  {B.publicRecords.length === 0 && <div className="text-[12px] text-[#93a8ba]">{T("Aucun", "None")}</div>}
                  {B.publicRecords.map((x, i) => {
                    const up = (k: string, v: string) => setB("publicRecords", B.publicRecords.map((y, j) => (j === i ? { ...y, [k]: v } : y)));
                    return (
                      <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-1 mb-1.5 pb-1.5 border-b border-[#eef3f7]">
                        <select className={cellIn} value={x.type} onChange={(e) => up("type", e.target.value)}>
                          <option value="bankruptcy">{T("Faillite", "Bankruptcy")}</option>
                          <option value="proposal">{T("Proposition de consommateur", "Consumer proposal")}</option>
                          <option value="judgment">{T("Jugement", "Judgment")}</option>
                        </select>
                        <input className={cellIn} type="date" value={x.date} onChange={(e) => up("date", e.target.value)} />
                        <button className="text-red-700 px-1" onClick={() => setB("publicRecords", B.publicRecords.filter((_, j) => j !== i))}>✕</button>
                        <input className={`${cellIn} text-right`} placeholder="$" value={x.amount} onChange={(e) => up("amount", e.target.value)} />
                        <select className={`${cellIn} col-span-2`} value={x.status} onChange={(e) => up("status", e.target.value)}>
                          <option value="active">{T("Non libéré / actif", "Undischarged / active")}</option>
                          <option value="discharged">{T("Libéré", "Discharged")}</option>
                          <option value="paid">{T("Payé / réglé", "Paid / satisfied")}</option>
                        </select>
                      </div>
                    );
                  })}
                </div>
              </div>
              <label className="block">
                <span className={lbl}>{T("Alertes et déclarations au dossier (fraude, vérification d'identité…)", "Alerts & consumer statements (fraud, ID verification…)")}</span>
                <textarea className="fld !h-14 py-1 mt-0.5 !tracking-normal" value={B.alerts} onChange={(e) => setB("alerts", e.target.value)} />
              </label>
            </div>
          </section>

          {/* decision */}
          {genErr && <div className="rounded-md border border-amber-300 bg-amber-50 px-4 py-2 text-[13px] text-amber-900">{genErr}</div>}
          {view.decision.status && (
            <div className="rounded-md border-2 px-4 py-3 flex flex-wrap items-center gap-3" style={{ borderColor: DEC_STYLE[view.decision.status].fg, background: DEC_STYLE[view.decision.status].bg }}>
              <div className="text-[20px] font-extrabold tracking-wide" style={{ color: DEC_STYLE[view.decision.status].fg }}>
                {lang === "fr" ? DEC_STYLE[view.decision.status].fr : DEC_STYLE[view.decision.status].en}
              </div>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-white border" style={{ color: DEC_STYLE[view.decision.status].fg, borderColor: DEC_STYLE[view.decision.status].fg }}>
                {isAuto ? T("AUTOMATIQUE", "AUTOMATIC") : T("DÉCISION DU GESTIONNAIRE", "MANAGER OVERRIDE")}
              </span>
              {view.decision.status === "conditional" && (
                <div className="w-full text-[12.5px] text-[#1e3a50]">
                  <b className="text-[#a0620a]">{T("Conditions :", "Conditions:")}</b>{" "}
                  {view.decision.conditions
                    .map((k) => {
                      const c = CONDITIONS.find((x) => x[0] === k);
                      const lab = c ? (lang === "fr" ? c[1] : c[2]) : k;
                      return k === "higher_down" && view.decision.requiredDown ? `${lab} (${fmtDesk(num(view.decision.requiredDown))} $)` : lab;
                    })
                    .join(" · ")}
                </div>
              )}
            </div>
          )}
          <Card title={T("Décision de crédit", "Credit decision")} accent={dec?.fg ?? "#00263d"}>
            <div className="grid grid-cols-1 2xl:grid-cols-[1fr_1.2fr] gap-4">
              <div>
                <div className={`${lbl} mb-1`}>{T("Recommandation du système", "System recommendation")}</div>
                {sug.status ? (
                  <div className="rounded-md px-3 py-2 mb-2" style={{ background: DEC_STYLE[sug.status].bg, color: DEC_STYLE[sug.status].fg }}>
                    <div className="text-[15px] font-extrabold tracking-wide">{lang === "fr" ? DEC_STYLE[sug.status].fr : DEC_STYLE[sug.status].en}</div>
                    {sug.requiredDown > 0 && (
                      <div className="text-[12.5px] font-semibold">
                        {T("Mise de fonds additionnelle suggérée", "Suggested additional down payment")} : {fmtDesk(sug.requiredDown)} $ · {T("financement max.", "max financing")} {fmtDesk(sug.maxFinance)} $
                      </div>
                    )}
                  </div>
                ) : null}
                <ul className="text-[12.5px] text-[#1e3a50] space-y-0.5 list-disc pl-5">
                  {sug.reasons.map((r, i) => <li key={i}>{lang === "fr" ? r[0] : r[1]}</li>)}
                </ul>
                <div className="text-[10.5px] text-[#93a8ba] mt-2">
                  {T("Critères : pointage ≥ 660, PTI ≤ 15 % (refus > 30 %), TDS ≤ 42 % (refus > 60 %), LTV ≤ 125 %, aucun recouvrement ni faillite active. Recommandation indicative — la décision finale appartient au gestionnaire et au prêteur.", "Criteria: score ≥ 660, PTI ≤ 15% (decline > 30%), TDS ≤ 42% (decline > 60%), LTV ≤ 125%, no collections or active bankruptcy. Guidance only — the final decision belongs to the manager and the lender.")}
                </div>
                {sug.status && (
                  <button
                    className="btn mt-2"
                    disabled={!canDecide}
                    onClick={() => {
                      setDec("conditions", sug.conditions);
                      if (sug.requiredDown) setDec("requiredDown", String(sug.requiredDown));
                    }}
                  >
                    {T("Appliquer les conditions suggérées", "Apply suggested conditions")}
                  </button>
                )}
              </div>

              <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  {(["approved", "conditional", "declined"] as const).map((k) => (
                    <button
                      key={k}
                      disabled={!canDecide}
                      onClick={() => decide(k)}
                      className="flex-1 min-w-[150px] h-11 rounded-md border-2 font-extrabold text-[12.5px] tracking-wide disabled:opacity-50"
                      style={
                        view.decision.status === k
                          ? { background: DEC_STYLE[k].fg, borderColor: DEC_STYLE[k].fg, color: "#fff" }
                          : { background: DEC_STYLE[k].bg, borderColor: DEC_STYLE[k].fg, color: DEC_STYLE[k].fg }
                      }
                    >
                      {lang === "fr" ? DEC_STYLE[k].fr : DEC_STYLE[k].en}
                    </button>
                  ))}
                </div>
                {!canDecide && <div className="text-[12px] text-[#5a7086]">{T("Seul un gestionnaire ou le directeur F&A peut rendre la décision.", "Only a manager or the F&I director can make the decision.")}</div>}
                {view.decision.status && (
                  <>
                    {view.decision.status === "conditional" && (
                      <div className="border border-amber-200 bg-amber-50/50 rounded-md p-2">
                        <div className={`${lbl} mb-1`}>{T("Conditions d'approbation", "Approval conditions")}</div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-3 gap-y-0.5">
                          {CONDITIONS.map(([k, fr, en]) => (
                            <label key={k} className="flex items-start gap-1.5 text-[12.5px] text-[#1e3a50]">
                              <input
                                type="checkbox"
                                className="mt-0.5"
                                disabled={!canDecide}
                                checked={view.decision.conditions.includes(k)}
                                onChange={(e) => setDec("conditions", e.target.checked ? [...view.decision.conditions, k] : view.decision.conditions.filter((x) => x !== k))}
                              />
                              <span>
                                {lang === "fr" ? fr : en}
                                {k === "higher_down" && view.decision.conditions.includes(k) && view.decision.requiredDown ? ` : ${fmtDesk(num(view.decision.requiredDown))} $` : ""}
                              </span>
                            </label>
                          ))}
                        </div>
                      </div>
                    )}
                    {view.decision.status !== "declined" && (
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                        {view.decision.status === "conditional" && <Field label={T("Mise de fonds requise ($)", "Required down ($)")} value={view.decision.requiredDown} onChange={(v) => setDec("requiredDown", v)} />}
                        <Field label={T("Montant approuvé ($)", "Approved amount ($)")} value={view.decision.approvedAmount} onChange={(v) => setDec("approvedAmount", v)} />
                        <Field label={T("Taux approuvé (%)", "Approved rate (%)")} value={view.decision.approvedRate} onChange={(v) => setDec("approvedRate", v)} />
                        <Field label={T("Terme (mois)", "Term (months)")} value={view.decision.approvedTerm} onChange={(v) => setDec("approvedTerm", v)} />
                        <Field label={T("Prêteur", "Lender")} value={view.decision.lender} onChange={(v) => setDec("lender", v)} />
                      </div>
                    )}
                    <label className="block">
                      <span className={lbl}>{view.decision.status === "declined" ? T("Motifs du refus", "Reasons for decline") : T("Notes au dossier", "File notes")}</span>
                      <textarea className="fld !h-16 py-1 mt-0.5 !tracking-normal" value={data.decision.notes} onChange={(e) => setDec("notes", e.target.value)} />
                    </label>
                    <div className="text-[11.5px] text-[#5a7086]">
                      {T("Décision rendue par", "Decision by")} <b>{view.decision.decidedBy || "—"}</b>
                      {view.decision.decidedAt ? ` · ${new Date(view.decision.decidedAt).toLocaleString(loc, { dateStyle: "medium", timeStyle: "short" })}` : ""}
                      {!isAuto && (
                        <button className="ml-3 text-[#0071bc] hover:underline" disabled={!canDecide} onClick={() => setDec("auto", true)}>
                          {T("Revenir à la décision automatique", "Return to automatic decision")}
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          </Card>
          <div className="text-[10.5px] text-[#93a8ba] text-center">
            {T(
              "Outil interne d'analyse de crédit. Les données Equifax sont saisies à partir du rapport obtenu avec le consentement du client; aucune connexion directe au bureau de crédit.",
              "Internal credit analysis tool. Equifax data is entered from the report obtained with the client's consent; there is no direct connection to the credit bureau.",
            )}
          </div>
        </div>
      )}
    </div>
  );
}
