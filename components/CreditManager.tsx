"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { annualIncome, applyFinancing, CONDITIONS, emptyCredit, num, OPT, optLabel, readyForAuto, scoreBand, type CreditData, type DealFinancing, type Person } from "@/lib/credit";
import { fmtDesk, PROVINCES } from "@/lib/deal";
import { useLang } from "@/lib/i18n";
import type { Client } from "./ClientsManager";

interface AppRow {
  id: number;
  appNumber: string;
  customerId: number | null;
  dealId: number | null;
  status: string;
  applicantName: string;
  createdBy: string;
  updatedAt: string;
  vehicle: string;
  amountRequested: string;
  dealType: string;
  phone: string;
  quoteNumber?: string;
  score?: string;
  decision?: string;
}
interface DealLite {
  id: number;
  dealNumber: string;
  customerName: string;
  vehicleLabel: string;
  dealType: string;
}

const STATUS_STYLE: Record<string, string> = {
  draft: "bg-slate-100 text-slate-700 ring-slate-500/30",
  submitted: "bg-[#e6f1fa] text-[#005a96] ring-[#0071bc]/30",
  approved: "bg-emerald-50 text-emerald-700 ring-emerald-600/30",
  conditional: "bg-amber-50 text-amber-800 ring-amber-600/30",
  declined: "bg-red-50 text-red-700 ring-red-600/30",
};

const lbl = "text-[10px] font-bold uppercase tracking-wider text-[#5a7086]";

function In({ label, value, onChange, type = "text", span = 1, placeholder }: { label: string; value: string; onChange: (v: string) => void; type?: string; span?: number; placeholder?: string }) {
return (
  <label style={{ gridColumn: `span ${span} / span ${span}` }}>
    <span className={lbl}>{label}</span>
    <input className="fld !h-8 mt-0.5" type={type} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
  </label>
);
}

function Sel({ label, value, onChange, children, span = 1 }: { label: string; value: string; onChange: (v: string) => void; children: ReactNode; span?: number }) {
return (
  <label style={{ gridColumn: `span ${span} / span ${span}` }}>
    <span className={lbl}>{label}</span>
    <select className="fld !h-8 mt-0.5" value={value} onChange={(e) => onChange(e.target.value)}>{children}</select>
  </label>
);
}

function Section({ n, title, children }: { n: number; title: string; children: ReactNode }) {
return (
  <section className="border border-[#cbd8e3] rounded-md overflow-hidden">
    <header className="px-3 py-1.5 bg-[#f4f7fa] border-b border-[#e3eaf1] text-[12px] font-bold uppercase tracking-wider text-[#00263d]">
      {n}. {title}
    </header>
    <div className="p-3 grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-2">{children}</div>
  </section>
);
}

export default function CreditManager({ initialId, initialCustomerId, initialDealId }: { initialId: number | null; initialCustomerId: number | null; initialDealId: number | null }) {
  const { t, lang } = useLang();
  const loc = lang === "fr" ? "fr-CA" : "en-CA";
  const [list, setList] = useState<AppRow[] | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [sel, setSel] = useState<number | null>(initialId);
  const [data, setData] = useState<CreditData>(emptyCredit());
  const [meta, setMeta] = useState<{ appNumber: string; status: string; customerId: number | null; dealId: number | null }>({ appNumber: "", status: "draft", customerId: null, dealId: null });
  const [q, setQ] = useState("");
  const [statusF, setStatusF] = useState("");
  const [saveState, setSaveState] = useState<"" | "saving" | "saved">("");
  const [newClient, setNewClient] = useState<string>("");
  // automatic report / decision (kept on the server — the form never overwrites it)
  const [auto, setAuto] = useState<{ bureau: CreditData["bureau"]; decision: CreditData["decision"] } | null>(null);
  const [notice, setNotice] = useState<string>("");
  const lastStatus = useRef("");
  const [dealList, setDealList] = useState<DealLite[]>([]);
  const [linking, setLinking] = useState(false);
  const T = (fr: string, en: string) => (lang === "fr" ? fr : en);
  useEffect(() => {
    fetch("/api/deals").then(async (r) => setDealList(await r.json()));
  }, []);
  async function linkQuotation(dealId: number) {
    setLinking(true);
    const r = await fetch(`/api/deals/${dealId}/financing`);
    if (r.ok) {
      const f = (await r.json()) as DealFinancing;
      setData((d) => applyFinancing(d, f));
      setMeta((m) => ({ ...m, dealId, customerId: m.customerId ?? f.customerId }));
    }
    setLinking(false);
  }
  const loaded = useRef(false);
  const created = useRef(false);

  const reload = useCallback(async () => {
    const r = await fetch("/api/credit");
    setList(await r.json());
  }, []);

  const open = useCallback(async (id: number) => {
    loaded.current = false;
    setSel(id);
    const r = await fetch(`/api/credit/${id}`);
    const j = await r.json();
    setData(j.data);
    setAuto({ bureau: j.data.bureau, decision: j.data.decision });
    lastStatus.current = j.data.decision.status ?? "";
    setNotice("");
    setMeta({ appNumber: j.appNumber, status: j.status, customerId: j.customerId, dealId: j.dealId });
    history.replaceState(null, "", `/credit?id=${id}`);
    setTimeout(() => (loaded.current = true), 50);
  }, []);

  const create = useCallback(
    async (customerId: number | null, dealId: number | null = null) => {
      const r = await fetch("/api/credit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ customerId, dealId }) });
      const j = await r.json();
      await reload();
      await open(j.id);
    },
    [reload, open],
  );

  useEffect(() => {
    void reload();
    fetch("/api/customers").then(async (r) => setClients(await r.json()));
    if (initialId) void open(initialId);
    else if ((initialCustomerId || initialDealId) && !created.current) {
      created.current = true;
      void create(initialCustomerId, initialDealId);
    }
  }, [reload, open, create, initialId, initialCustomerId, initialDealId]);

  // autosave
  useEffect(() => {
    if (!sel || !loaded.current) return;
    setSaveState("saving");
    const tm = setTimeout(async () => {
      const r = await fetch(`/api/credit/${sel}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data, status: meta.status, customerId: meta.customerId, dealId: meta.dealId, preserve: ["bureau", "decision"] }),
      });
      const j = (await r.json().catch(() => null)) as { status: string; data: CreditData } | null;
      if (j?.data) {
        const before = lastStatus.current;
        setAuto({ bureau: j.data.bureau, decision: j.data.decision });
        setMeta((m) => (m.status === j.status ? m : { ...m, status: j.status }));
        if (j.data.decision.status && j.data.decision.status !== before) setNotice(j.data.decision.status);
        lastStatus.current = j.data.decision.status;
      }
      setSaveState("saved");
      void reload();
    }, 700);
    return () => clearTimeout(tm);
  }, [data, meta.status, meta.customerId, meta.dealId, sel, reload]);

  const filtered = useMemo(() => {
    const s = q.toLowerCase().trim();
    return (list ?? []).filter((r) => (!statusF || r.status === statusF) && (!s || `${r.appNumber} ${r.applicantName} ${r.vehicle} ${r.phone}`.toLowerCase().includes(s)));
  }, [list, q, statusF]);

  const setA = (who: "applicant" | "coApplicant", k: keyof Person, v: string) => setData((d) => ({ ...d, [who]: { ...d[who], [k]: v } }));
  const setD = <K extends keyof CreditData>(k: K, v: CreditData[K]) => setData((d) => ({ ...d, [k]: v }));
  const o = (list: readonly (readonly string[])[]) => list.map((x) => <option key={x[0]} value={x[0]}>{lang === "fr" ? x[1] : x[2]}</option>);


  const personFields = (who: "applicant" | "coApplicant") => {
    const p = data[who];
    const f = (k: keyof Person) => ({ value: p[k], onChange: (v: string) => setA(who, k, v) });
    return (
      <>
        <Sel label={t("Titre")} {...f("title")}>{o(OPT.title)}</Sel>
        <In label={t("Prénom")} {...f("firstName")} span={2} />
        <In label={t("Second prénom")} {...f("middleName")} />
        <In label={t("Nom")} {...f("lastName")} span={2} />
        <In label={t("Date de naissance")} type="date" {...f("dob")} />
        <In label={t("NAS (facultatif)")} {...f("sin")} placeholder="___ ___ ___" />
        <Sel label={t("État civil")} {...f("maritalStatus")}>{o(OPT.marital)}</Sel>
        <In label={t("Personnes à charge")} {...f("dependents")} />
        <In label={t("Courriel")} type="email" {...f("email")} span={2} />
        <In label={t("Cellulaire")} {...f("mobile")} />
        <In label={t("Tél. maison")} {...f("homePhone")} />
        <In label={t("Tél. travail")} {...f("workPhone")} />
        <In label={t("N° de permis de conduire")} {...f("licenseNo")} span={2} />
        <Sel label={t("Province du permis")} {...f("licenseProv")}>{PROVINCES.map((x) => <option key={x.code} value={x.code}>{x.code}</option>)}</Sel>
      </>
    );
  };
  const addressFields = (who: "applicant" | "coApplicant") => {
    const p = data[who];
    const f = (k: keyof Person) => ({ value: p[k], onChange: (v: string) => setA(who, k, v) });
    return (
      <>
        <In label={t("Adresse")} {...f("address")} span={3} />
        <In label={t("App.")} {...f("unit")} />
        <In label={t("Ville")} {...f("city")} />
        <Sel label={t("Province")} {...f("province")}>{PROVINCES.map((x) => <option key={x.code} value={x.code}>{x.code}</option>)}</Sel>
        <In label={t("Code postal")} {...f("postal")} />
        <Sel label={t("Type de résidence")} {...f("residenceType")}>{o(OPT.residence)}</Sel>
        <In label={t("Loyer / hypothèque ($/mois)")} {...f("housingPayment")} />
        <In label={t("Années à l'adresse")} {...f("yearsAtAddress")} />
        <In label={t("Mois")} {...f("monthsAtAddress")} />
        <In label={t("Propriétaire / créancier hyp.")} {...f("landlord")} />
        <In label={t("Adresse précédente (si moins de 2 ans)")} {...f("prevAddress")} span={4} />
        <In label={t("Années")} {...f("prevYears")} />
      </>
    );
  };
  const employmentFields = (who: "applicant" | "coApplicant") => {
    const p = data[who];
    const f = (k: keyof Person) => ({ value: p[k], onChange: (v: string) => setA(who, k, v) });
    return (
      <>
        <Sel label={t("Statut d'emploi")} {...f("employmentType")}>{o(OPT.employment)}</Sel>
        <In label={t("Employeur")} {...f("employer")} span={2} />
        <In label={t("Poste / occupation")} {...f("occupation")} span={2} />
        <In label={t("Tél. employeur")} {...f("employerPhone")} />
        <In label={t("Adresse de l'employeur")} {...f("employerAddress")} span={3} />
        <In label={t("Années chez l'employeur")} {...f("yearsEmployed")} />
        <In label={t("Mois")} {...f("monthsEmployed")} />
        <In label={t("Revenu brut ($)")} {...f("grossIncome")} />
        <Sel label={t("Fréquence du revenu")} {...f("incomeFrequency")}>{o(OPT.incomeFreq)}</Sel>
        <In label={t("Autre revenu ($/an)")} {...f("otherIncome")} />
        <In label={t("Source de l'autre revenu")} {...f("otherIncomeSource")} span={2} />
        <In label={t("Employeur précédent (si moins de 2 ans)")} {...f("prevEmployer")} span={2} />
        <In label={t("Années")} {...f("prevYearsEmployed")} />
        <div className="col-span-2 self-end text-[12px] text-[#003a5d]">
          {t("Revenu annuel estimé")} : <b>{fmtDesk(annualIncome(p) + (Number(p.otherIncome) || 0))} $</b>
        </div>
      </>
    );
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[360px_minmax(0,1fr)] gap-4 items-start">
      {notice && <DecisionToast status={notice} conditions={auto?.decision.conditions ?? []} requiredDown={auto?.decision.requiredDown ?? ""} lang={lang} onClose={() => setNotice("")} appId={sel} />}
      {/* ---------- list ---------- */}
      <aside className="bg-white rounded-md border border-[#cbd8e3] shadow-[0_1px_3px_rgba(0,38,61,0.08)] overflow-hidden xl:sticky xl:top-[72px]">
        <div className="bg-gradient-to-r from-[#00263d] to-[#0a4a73] text-white px-4 py-3">
          <div className="text-[16px] font-bold">{t("Demandes de crédit")}</div>
          <div className="text-[11px] text-[#b9d2e5]">{list?.length ?? 0} {t("demande(s)")}</div>
        </div>
        <div className="p-3 border-b border-[#e3eaf1] space-y-2">
          <label className="block">
            <span className={lbl}>{t("Nouvelle demande pour un client existant")}</span>
            <div className="flex gap-1 mt-0.5">
              <select className="fld !h-8" value={newClient} onChange={(e) => setNewClient(e.target.value)}>
                <option value="">— {t("Choisir un client")} —</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {`${c.firstName} ${c.lastName}`.trim()}
                    {c.mobile ? ` — ${c.mobile}` : ""}
                  </option>
                ))}
              </select>
              <button className="btn btn-primary !h-8" disabled={!newClient} onClick={() => void create(Number(newClient)).then(() => setNewClient(""))}>
                {t("Créer")}
              </button>
            </div>
          </label>
          <button className="btn w-full !py-1.5" onClick={() => void create(null)}>+ {t("Nouvelle demande vierge")}</button>
          <div className="flex gap-1">
            <input className="fld !h-8" placeholder={t("Recherche…")} value={q} onChange={(e) => setQ(e.target.value)} />
            <select className="fld !h-8 !w-36" value={statusF} onChange={(e) => setStatusF(e.target.value)}>
              <option value="">{t("Tous")}</option>
              {o(OPT.status)}
            </select>
          </div>
        </div>
        <div className="max-h-[60vh] overflow-y-auto">
          {list === null && <div className="p-4 text-[13px] text-[#5a7086]">{t("Chargement…")}</div>}
          {list !== null && filtered.length === 0 && <div className="p-4 text-[13px] text-[#5a7086]">{t("Aucune demande.")}</div>}
          {filtered.map((r) => (
            <button
              key={r.id}
              onClick={() => void open(r.id)}
              className={`w-full text-left px-4 py-2.5 border-b border-[#eef3f7] border-l-[3px] ${sel === r.id ? "bg-[#e6f1fa] border-l-[#0071bc]" : "border-l-transparent hover:bg-[#f8fafc]"}`}
            >
              <div className="flex items-center gap-2">
                <span className="font-semibold text-[13px] text-[#00263d] truncate">{r.applicantName || t("(sans nom)")}</span>
                <span className={`ml-auto shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ring-inset ${STATUS_STYLE[r.status] ?? STATUS_STYLE.draft}`}>{optLabel(OPT.status, r.status, lang)}</span>
              </div>
              <div className="text-[11px] text-[#5a7086] truncate">
                <span className="font-mono">{r.appNumber}</span>
                {r.quoteNumber ? ` · Q#${r.quoteNumber}` : ""}
                {r.vehicle ? ` · ${r.vehicle}` : ""}
                {r.score ? ` · ${r.score}` : ""}
              </div>
              <div className="text-[10.5px] text-[#93a8ba]">{new Date(r.updatedAt).toLocaleString(loc, { dateStyle: "medium", timeStyle: "short" })}{r.createdBy ? ` · ${r.createdBy}` : ""}</div>
            </button>
          ))}
        </div>
      </aside>

      {/* ---------- form ---------- */}
      {!sel ? (
        <div className="bg-white rounded-md border border-dashed border-[#9fb3c4] p-12 text-center text-[#5a7086]">
          <div className="font-semibold text-[#00263d] text-[15px]">{t("Sélectionnez une demande ou créez-en une nouvelle.")}</div>
          <div className="text-[12.5px] mt-1">{t("Les renseignements du client existant sont remplis automatiquement.")}</div>
        </div>
      ) : (
        <div className="bg-white rounded-md border border-[#cbd8e3] shadow-[0_1px_3px_rgba(0,38,61,0.08)] min-w-0">
          <header className="flex flex-wrap items-center gap-3 px-5 py-3 border-b border-[#e3eaf1]">
            <div className="min-w-0">
              <div className={lbl}>{t("Demande de crédit")} · <span className="font-mono">{meta.appNumber}</span></div>
              <div className="text-[18px] font-bold text-[#00263d] truncate">{`${data.applicant.firstName} ${data.applicant.lastName}`.trim() || t("Nouveau demandeur")}</div>
            </div>
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <span className="text-[11.5px] text-[#5a7086]">{saveState === "saving" ? t("Sauvegarde…") : saveState === "saved" ? `✓ ${t("Sauvegardé")}` : ""}</span>
              <select className={`fld !h-8 !w-52 font-semibold`} value={meta.status} onChange={(e) => setMeta((m) => ({ ...m, status: e.target.value }))}>
                {o(OPT.status)}
              </select>
              <a className="btn !py-1.5" href={`/credit/${sel}/print?lang=${lang}`} target="_blank" rel="noreferrer">{t("Imprimer")}</a>
              <Link className="btn btn-primary !py-1.5" href={`/equifax?id=${sel}`}>{T("Approbation Equifax", "Equifax approval")}</Link>
              {meta.dealId && <Link className="btn !py-1.5" href={`/deals/${meta.dealId}`}>{t("Ouvrir le dossier")}</Link>}
              <button
                className="btn btn-danger !py-1.5"
                onClick={async () => {
                  if (!confirm(t("Supprimer cette demande de crédit ?"))) return;
                  await fetch(`/api/credit/${sel}`, { method: "DELETE" });
                  setSel(null);
                  history.replaceState(null, "", "/credit");
                  await reload();
                }}
              >
                {t("Supprimer")}
              </button>
            </div>
          </header>
          <div className="p-4 space-y-3">
            <AutoDecisionBanner auto={auto} ready={readyForAuto(data)} appId={sel} lang={lang} />
            <Section n={1} title={t("Demandeur principal")}>{personFields("applicant")}</Section>
            <Section n={2} title={t("Adresse et logement")}>{addressFields("applicant")}</Section>
            <Section n={3} title={t("Emploi et revenus")}>{employmentFields("applicant")}</Section>
            <section className="border border-[#cbd8e3] rounded-md overflow-hidden">
              <header className="px-3 py-1.5 bg-[#f4f7fa] border-b border-[#e3eaf1] flex items-center gap-3">
                <span className="text-[12px] font-bold uppercase tracking-wider text-[#00263d]">4. {t("Co-demandeur")}</span>
                <label className="flex items-center gap-1 text-[12px] text-[#1e3a50]">
                  <input type="checkbox" checked={data.hasCoApplicant} onChange={(e) => setD("hasCoApplicant", e.target.checked)} /> {t("Ajouter un co-demandeur")}
                </label>
              </header>
              {data.hasCoApplicant && (
                <div className="p-3 space-y-3">
                  <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-2">
                    <In label={t("Lien avec le demandeur")} value={data.coRelation} onChange={(v) => setD("coRelation", v)} span={2} />
                    {personFields("coApplicant")}
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-2">{addressFields("coApplicant")}</div>
                  <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-2">{employmentFields("coApplicant")}</div>
                </div>
              )}
            </section>
            <section className="border-2 border-[#0071bc] rounded-md overflow-hidden">
              <header className="px-3 py-1.5 bg-[#e6f1fa] border-b border-[#b9d2e5] flex flex-wrap items-center gap-2">
                <span className="text-[12px] font-bold uppercase tracking-wider text-[#00263d]">5. {T("Quotation lié — financement demandé", "Linked quotation — financing requested")}</span>
                <select
                  className="fld !h-8 !w-[380px] ml-auto"
                  value={meta.dealId ?? ""}
                  onChange={(e) => e.target.value && void linkQuotation(Number(e.target.value))}
                >
                  <option value="">— {T("Choisir un quotation", "Choose a quotation")} —</option>
                  {dealList.map((d) => (
                    <option key={d.id} value={d.id}>
                      #{d.dealNumber} · {d.customerName || T("(sans nom)", "(no name)")} · {d.vehicleLabel || "—"}
                    </option>
                  ))}
                </select>
                {meta.dealId && (
                  <button className="btn btn-primary !h-8" disabled={linking} onClick={() => void linkQuotation(meta.dealId!)}>
                    {linking ? T("Importation…", "Importing…") : T("Actualiser depuis le quotation", "Refresh from quotation")}
                  </button>
                )}
              </header>
              <div className="p-3 space-y-2">
                {data.quoteNumber ? (
                  <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-2">
                    {[
                      [T("Quotation #", "Quotation #"), data.quoteNumber],
                      [T("Type", "Type"), optLabel(OPT.dealType, data.dealType, lang)],
                      [T("Prêteur", "Lender"), data.lender || "—"],
                      [T("Taux", "Rate"), data.rate ? `${data.rate} %` : "—"],
                      [T("Terme", "Term"), data.termRequested ? `${data.termRequested} ${T("mois", "mo")}` : "—"],
                      [T("Paiement", "Payment"), data.payment ? `${fmtDesk(num(data.payment))} $` : "—"],
                    ].map(([k, v]) => (
                      <div key={k} className="rounded-sm bg-[#f4f8fb] border border-[#e3eaf1] px-2 py-1">
                        <div className={lbl}>{k}</div>
                        <div className="text-[13px] font-bold text-[#00263d] truncate">{v}</div>
                      </div>
                    ))}
                    <div className="col-span-2 md:col-span-4 xl:col-span-6 rounded-sm bg-[#00263d] text-white px-3 py-2 flex flex-wrap items-center gap-4">
                      <span className="text-[11px] uppercase tracking-wider text-[#b9d2e5]">{T("Montant à financer", "Amount to finance")}</span>
                      <span className="text-[22px] font-bold tabular-nums">{fmtDesk(num(data.amountRequested))} $</span>
                      <span className="text-[12px] text-[#cfe3f2] ml-auto">
                        {T("Prix", "Price")} {fmtDesk(num(data.price))} $ · {T("Comptant", "Down")} {fmtDesk(num(data.downPayment))} $ · {T("Échange", "Trade")} {fmtDesk(num(data.tradeIn))} $ · {T("Solde dû", "Lien")} {fmtDesk(num(data.lienPayout))} $ · {T("Taxes", "Taxes")} {fmtDesk(num(data.taxes))} $
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="text-[12.5px] text-[#5a7086]">{T("Choisissez le quotation du client : véhicule, prix, comptant, échange, taxes, prêteur, terme, taux, paiement et montant à financer seront importés automatiquement.", "Choose the client's quotation: vehicle, price, down payment, trade-in, taxes, lender, term, rate, payment and amount to finance are imported automatically.")}</div>
                )}
                <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-2">
                  <In label={t("Véhicule")} value={data.vehicle} onChange={(v) => setD("vehicle", v)} span={3} />
                  <In label={t("NIV")} value={data.vin} onChange={(v) => setD("vin", v.toUpperCase())} span={2} />
                  <Sel label={t("Type")} value={data.dealType} onChange={(v) => setD("dealType", v)}>{o(OPT.dealType)}</Sel>
                  <In label={t("Prix de vente ($)")} value={data.price} onChange={(v) => setD("price", v)} />
                  <In label={t("Comptant ($)")} value={data.downPayment} onChange={(v) => setD("downPayment", v)} />
                  <In label={t("Valeur d'échange ($)")} value={data.tradeIn} onChange={(v) => setD("tradeIn", v)} />
                  <In label={T("Solde dû sur l'échange ($)", "Trade lien payout ($)")} value={data.lienPayout} onChange={(v) => setD("lienPayout", v)} />
                  <In label={T("Taxes ($)", "Taxes ($)")} value={data.taxes} onChange={(v) => setD("taxes", v)} />
                  <In label={T("Montant à financer ($)", "Amount to finance ($)")} value={data.amountRequested} onChange={(v) => setD("amountRequested", v)} />
                  <In label={T("Prêteur", "Lender")} value={data.lender} onChange={(v) => setD("lender", v)} span={2} />
                  <In label={T("Taux (%)", "Rate (%)")} value={data.rate} onChange={(v) => setD("rate", v)} />
                  <In label={t("Terme (mois)")} value={data.termRequested} onChange={(v) => setD("termRequested", v)} />
                  <In label={T("Paiement ($)", "Payment ($)")} value={data.payment} onChange={(v) => setD("payment", v)} />
                  {data.dealType === "lease" && <In label={T("Valeur résiduelle ($)", "Residual ($)")} value={data.residual} onChange={(v) => setD("residual", v)} />}
                </div>
              </div>
            </section>
            <Section n={6} title={t("Situation financière")}>
              <In label={t("Institution financière")} value={data.bank} onChange={(v) => setD("bank", v)} span={2} />
              <In label={t("Succursale")} value={data.bankBranch} onChange={(v) => setD("bankBranch", v)} />
              <Sel label={t("Type de compte")} value={data.accountType} onChange={(v) => setD("accountType", v)}>{o(OPT.account)}</Sel>
              <In label={t("Paiements mensuels — dettes ($)")} value={data.monthlyDebts} onChange={(v) => setD("monthlyDebts", v)} span={2} />
              <In label={t("Cartes de crédit (solde total $)")} value={data.creditCards} onChange={(v) => setD("creditCards", v)} span={2} />
              <In label={t("Autres prêts (solde total $)")} value={data.otherLoans} onChange={(v) => setD("otherLoans", v)} span={2} />
              <Sel label={t("Faillite / proposition ?")} value={data.bankruptcy} onChange={(v) => setD("bankruptcy", v)}>
                <option value="no">{t("Non")}</option>
                <option value="yes">{t("Oui")}</option>
              </Sel>
              {data.bankruptcy === "yes" && <In label={t("Détails (date de libération)")} value={data.bankruptcyDetails} onChange={(v) => setD("bankruptcyDetails", v)} span={3} />}
            </Section>
            <Section n={7} title={t("Références personnelles")}>
              <In label={t("Référence 1 — nom")} value={data.ref1Name} onChange={(v) => setD("ref1Name", v)} span={2} />
              <In label={t("Téléphone")} value={data.ref1Phone} onChange={(v) => setD("ref1Phone", v)} />
              <In label={t("Lien")} value={data.ref1Relation} onChange={(v) => setD("ref1Relation", v)} />
              <div className="hidden xl:block xl:col-span-2" />
              <In label={t("Référence 2 — nom")} value={data.ref2Name} onChange={(v) => setD("ref2Name", v)} span={2} />
              <In label={t("Téléphone")} value={data.ref2Phone} onChange={(v) => setD("ref2Phone", v)} />
              <In label={t("Lien")} value={data.ref2Relation} onChange={(v) => setD("ref2Relation", v)} />
            </Section>
            <section className="border border-[#cbd8e3] rounded-md overflow-hidden">
              <header className="px-3 py-1.5 bg-[#f4f7fa] border-b border-[#e3eaf1] text-[12px] font-bold uppercase tracking-wider text-[#00263d]">8. {t("Consentement et notes")}</header>
              <div className="p-3 space-y-2">
                <label className="flex items-start gap-2 text-[12.5px] text-[#1e3a50]">
                  <input type="checkbox" className="mt-0.5" checked={data.consent} onChange={(e) => setData((d) => ({ ...d, consent: e.target.checked, consentDate: e.target.checked ? new Date().toISOString().slice(0, 10) : "" }))} />
                  <span>
                    {t("Le client autorise le commerçant et ses prêteurs à obtenir son dossier de crédit (Equifax, TransUnion) et à vérifier les renseignements fournis aux fins de cette demande.")}
                    {data.consent && data.consentDate && <b className="ml-1">({data.consentDate})</b>}
                  </span>
                </label>
                <label className="block">
                  <span className={lbl}>{t("Notes internes")}</span>
                  <textarea className="fld !h-20 py-1 mt-0.5 !tracking-normal" value={data.notes} onChange={(e) => setD("notes", e.target.value)} />
                </label>
              </div>
            </section>
          </div>
        </div>
      )}
    </div>
  );
}

const DEC: Record<string, { fr: string; en: string; fg: string; bg: string }> = {
  approved: { fr: "APPROUVÉ", en: "APPROVED", fg: "#1e7b45", bg: "#e7f6ec" },
  conditional: { fr: "APPROBATION CONDITIONNELLE", en: "CONDITIONAL APPROVAL", fg: "#a0620a", bg: "#fff4e0" },
  declined: { fr: "REFUSÉ", en: "DECLINED", fg: "#b42318", bg: "#fdecec" },
};
const condLabel = (k: string, lang: "fr" | "en") => {
  const c = CONDITIONS.find((x) => x[0] === k);
  return c ? (lang === "fr" ? c[1] : c[2]) : k;
};

function AutoDecisionBanner({ auto, ready, appId, lang }: { auto: { bureau: CreditData["bureau"]; decision: CreditData["decision"] } | null; ready: boolean; appId: number; lang: "fr" | "en" }) {
  const T = (fr: string, en: string) => (lang === "fr" ? fr : en);
  const score = num(auto?.bureau.score);
  const dec = auto?.decision;
  if (!score || !dec?.status) {
    return (
      <div className="rounded-md border border-dashed border-[#9fb3c4] bg-[#f8fafc] px-4 py-3 text-[12.5px] text-[#3c5266]">
        <b className="text-[#00263d]">{T("Analyse de crédit automatique", "Automatic credit analysis")}</b> —{" "}
        {ready
          ? T("en cours… le rapport et la décision apparaîtront après la sauvegarde.", "running… the report and decision will appear after saving.")
          : T("se lance automatiquement dès que le nom, le revenu et le quotation (montant à financer) sont remplis.", "starts automatically once the name, income and quotation (amount to finance) are filled in.")}
      </div>
    );
  }
  const st = DEC[dec.status];
  const band = scoreBand(score);
  return (
    <div className="rounded-md border-2 overflow-hidden" style={{ borderColor: st.fg }}>
      <div className="flex flex-wrap items-center gap-3 px-4 py-2.5" style={{ background: st.bg }}>
        <div className="text-center px-3 py-1 rounded-md bg-white border" style={{ borderColor: band.color }}>
          <div className="text-[9px] font-bold text-[#5a7086] tracking-wider">EQUIFAX</div>
          <div className="text-[22px] font-extrabold leading-none" style={{ color: band.color }}>{score}</div>
          <div className="text-[9px] font-bold" style={{ color: band.color }}>{lang === "fr" ? band.fr : band.en}</div>
        </div>
        <div className="min-w-0">
          <div className="text-[17px] font-extrabold tracking-wide" style={{ color: st.fg }}>{lang === "fr" ? st.fr : st.en}</div>
          <div className="text-[11.5px] text-[#3c5266]">
            {dec.auto === false ? T("Décision du gestionnaire", "Manager decision") : T("Décision automatique", "Automatic decision")}
            {dec.decidedBy ? ` · ${dec.decidedBy}` : ""}
            {auto?.bureau.source === "simulated" ? ` · ${T("rapport simulé", "simulated report")}` : ""}
          </div>
          {dec.status !== "declined" && dec.approvedAmount && (
            <div className="text-[12px] text-[#00263d] font-semibold">
              {T("Montant approuvé", "Approved amount")} {fmtDesk(num(dec.approvedAmount))} $ · {dec.approvedRate} % · {dec.approvedTerm} {T("mois", "mo")}
            </div>
          )}
        </div>
        <Link className="btn btn-primary ml-auto" href={`/equifax?id=${appId}`}>{T("Voir le rapport Equifax", "View Equifax report")}</Link>
      </div>
      {dec.status === "conditional" && dec.conditions.length > 0 && (
        <div className="px-4 py-2 bg-white text-[12.5px]">
          <div className="font-bold text-[#a0620a] mb-0.5">{T("Conditions à remplir :", "Conditions to meet:")}</div>
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-x-4 list-disc pl-5 text-[#1e3a50]">
            {dec.conditions.map((k) => (
              <li key={k}>
                {condLabel(k, lang)}
                {k === "higher_down" && dec.requiredDown ? <b> : {fmtDesk(num(dec.requiredDown))} $</b> : null}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function DecisionToast({ status, conditions, requiredDown, lang, onClose, appId }: { status: string; conditions: string[]; requiredDown: string; lang: "fr" | "en"; onClose: () => void; appId: number | null }) {
  const T = (fr: string, en: string) => (lang === "fr" ? fr : en);
  const st = DEC[status];
  if (!st) return null;
  return (
    <div className="fixed top-16 right-4 z-[70] w-[380px] rounded-md shadow-2xl border-2 bg-white overflow-hidden" style={{ borderColor: st.fg }}>
      <div className="px-4 py-2 flex items-center" style={{ background: st.fg, color: "#fff" }}>
        <b className="text-[13px] tracking-wide">{T("Nouvelle décision de crédit", "New credit decision")}</b>
        <button className="ml-auto text-white/80 hover:text-white" onClick={onClose}>✕</button>
      </div>
      <div className="px-4 py-3">
        <div className="text-[16px] font-extrabold" style={{ color: st.fg }}>{lang === "fr" ? st.fr : st.en}</div>
        {status === "conditional" && (
          <ul className="list-disc pl-5 text-[12.5px] text-[#1e3a50] mt-1">
            {conditions.map((k) => (
              <li key={k}>
                {condLabel(k, lang)}
                {k === "higher_down" && requiredDown ? <b> : {fmtDesk(num(requiredDown))} $</b> : null}
              </li>
            ))}
          </ul>
        )}
        {appId && <Link className="btn btn-primary mt-2 inline-block" href={`/equifax?id=${appId}`}>{T("Ouvrir l'approbation", "Open approval")}</Link>}
      </div>
    </div>
  );
}
