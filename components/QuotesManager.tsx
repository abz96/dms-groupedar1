"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { fmtDesk, FREQ_LABEL_FR, type DealType, type Frequency } from "@/lib/deal";
import { useLang } from "@/lib/i18n";
import { useSessionUser } from "@/lib/session-context";
import { NumField } from "./fields";
import type { Client } from "./ClientsManager";

interface Result {
  vehicle: { id: number; year: string; make: string; model: string; trim: string; stock: string; kms: number; extColor: string };
  payment: number;
  frequency: Frequency;
  term: number | null;
  rate: number | null;
  lender: string | null;
  msrp: number;
  discount: number;
  discountPct: number;
  sellingPrice: number;
  products: { name: string; term?: number; price: number }[];
  accessoriesTotal: number;
  dueOnDelivery: number;
  gross: number;
  meetsTarget: boolean | null;
}
interface SavedQuote {
  id: number;
  quoteNumber: string;
  customerId: number | null;
  status: string;
  dealType: string;
  summary: string;
  request: string;
  createdBy: string;
  decidedBy: string;
  decisionNote: string;
  decidedAt: string | null;
  dealId: number | null;
  createdAt: string;
  firstName: string | null;
  lastName: string | null;
  result: Result | null;
}

const TYPE_LABEL: Record<string, string> = { cash: "Comptant", finance: "Financement", lease: "Location" };
const STATUS: Record<string, { label: string; color: string }> = {
  pending: { label: "En attente", color: "#e0a100" },
  approved: { label: "Approuvée", color: "#2e9a57" },
  declined: { label: "Refusée", color: "#c0392b" },
};

export default function QuotesManager({ initialCustomerId, aiEnabled }: { initialCustomerId: number | null; aiEnabled: boolean }) {
  const { t, lang } = useLang();
  const me = useSessionUser();
  const isManager = me?.role === "admin";
  const loc = lang === "fr" ? "fr-CA" : "en-CA";
  const [clients, setClients] = useState<Client[]>([]);
  const [customerId, setCustomerId] = useState<number | null>(initialCustomerId);
  const [request, setRequest] = useState("");
  const [dealType, setDealType] = useState<DealType>("finance");
  const [frequency, setFrequency] = useState<Frequency>("monthly");
  const [term, setTerm] = useState(0);
  const [target, setTarget] = useState(0);
  const [maxPrice, setMaxPrice] = useState(0);
  const [vehicleQuery, setVehicleQuery] = useState("");
  const [cashDown, setCashDown] = useState(0);
  const [warrantyYears, setWarrantyYears] = useState(0);
  const [tireRimYears, setTireRimYears] = useState(0);
  const [accessories, setAccessories] = useState<{ name: string; price: number }[]>([]);
  const [results, setResults] = useState<Result[] | null>(null);
  const [selected, setSelected] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [list, setList] = useState<SavedQuote[]>([]);
  const [statusF, setStatusF] = useState("pending");
  const [notes, setNotes] = useState<Record<number, string>>({});

  const reload = useCallback(async () => {
    const r = await fetch(`/api/quotes?status=${statusF}`);
    setList(await r.json());
  }, [statusF]);
  useEffect(() => {
    void reload();
  }, [reload]);
  useEffect(() => {
    fetch("/api/customers").then(async (r) => setClients(await r.json()));
  }, []);
  // prefill from CRM profile
  useEffect(() => {
    const c = clients.find((x) => x.id === customerId);
    if (!c) return;
    if (c.dealTypePref) setDealType(c.dealTypePref as DealType);
    if (c.paymentFrequency) setFrequency(c.paymentFrequency as Frequency);
    if (Number(c.desiredPayment)) setTarget(Number(c.desiredPayment));
    if (Number(c.budgetPrice)) setMaxPrice(Number(c.budgetPrice));
    if (c.interestVehicle) setRequest((r) => r || c.interestVehicle || "");
  }, [customerId, clients]);

  const params = () => ({
    dealType, frequency, term: term || undefined, targetPayment: target || undefined, maxPrice: maxPrice || undefined,
    vehicleQuery: vehicleQuery || undefined, cashDown: cashDown || undefined, warrantyYears: warrantyYears || undefined,
    tireRimYears: tireRimYears || undefined, accessories: accessories.filter((a) => a.name && a.price), count: 3,
  });

  async function generate() {
    setBusy(true);
    setMsg("");
    const r = await fetch("/api/quotes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "preview", request, params: params(), customerId }),
    });
    const j = (await r.json()) as { results: Result[]; params: Record<string, unknown> };
    setResults(j.results);
    setSelected(j.results.map((_, i) => i));
    // reflect what the AI understood
    const p = j.params as { dealType?: DealType; frequency?: Frequency; term?: number; targetPayment?: number; vehicleQuery?: string; warrantyYears?: number; tireRimYears?: number; cashDown?: number; maxPrice?: number };
    if (p.dealType) setDealType(p.dealType);
    if (p.frequency) setFrequency(p.frequency);
    if (p.term) setTerm(p.term);
    if (p.targetPayment) setTarget(p.targetPayment);
    if (p.vehicleQuery) setVehicleQuery(p.vehicleQuery);
    if (p.warrantyYears) setWarrantyYears(p.warrantyYears);
    if (p.tireRimYears) setTireRimYears(p.tireRimYears);
    if (p.cashDown) setCashDown(p.cashDown);
    if (p.maxPrice) setMaxPrice(p.maxPrice);
    if (!j.results.length) setMsg(t("Aucun véhicule de l'inventaire ne correspond. Élargissez la recherche."));
    setBusy(false);
  }

  async function submit() {
    setBusy(true);
    const r = await fetch("/api/quotes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "save", request, params: params(), customerId, selected }),
    });
    const j = (await r.json()) as { saved?: { id: number; quoteNumber: string }[] };
    setMsg(`✓ ${(j.saved ?? []).map((x) => x.quoteNumber).join(", ")} — ${t("offre(s) soumise(s) pour approbation du gestionnaire.")}`);
    setResults(null);
    setBusy(false);
    setStatusF("pending");
    await reload();
  }

  async function decide(id: number, action: "approve" | "decline") {
    const r = await fetch(`/api/quotes/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, note: notes[id] ?? "" }) });
    const j = await r.json();
    if (!r.ok) alert(t(j.error ?? "Erreur"));
    else if (action === "approve" && j.dealId) {
      if (confirm(`✓ ${j.quoteNumber} → ${t("Dossier")} #${j.dealNumber} ${t("créé dans le Gestionnaire de dossiers.")}\n\n${t("Ouvrir le dossier maintenant ?")}`)) {
        window.location.href = `/deals/${j.dealId}`;
        return;
      }
    }
    await reload();
  }

  const freqLbl = (f: Frequency) => t(FREQ_LABEL_FR[f]);

  return (
    <div className="space-y-4">
      <div className="win">
        <div className="win-title flex items-center px-3 h-9">
          <span>{t("Générateur d'offres AI")}</span>
          <span className="ml-auto text-xs text-[#cfe3f2]">{aiEnabled ? t("IA (OpenAI) + inventaire réel") : t("Analyse intelligente locale + inventaire réel")} · {t("Rabais max 3 %")}</span>
        </div>
        <div className="p-3 grid grid-cols-1 xl:grid-cols-[1fr_1fr] gap-3">
          <div className="space-y-2">
            <label className="block">
              <span className="lbl text-[12px]">{t("Client (CRM)")}</span>
              <select className="fld" value={customerId ?? ""} onChange={(e) => setCustomerId(e.target.value ? Number(e.target.value) : null)}>
                <option value="">— {t("Aucun")} —</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{`${c.firstName} ${c.lastName}`.trim()}{c.interestVehicle ? ` — ${c.interestVehicle}` : ""}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="lbl text-[12px]">{t("Demande du client (texte libre)")}</span>
              <textarea
                className="fld !h-24 py-1 !tracking-normal"
                placeholder={t("ex. Client veut un SUV Audi en location 48 mois, environ 650 $ par mois, avec garantie 3 ans et pneus & jantes")}
                value={request}
                onChange={(e) => setRequest(e.target.value)}
              />
            </label>
            <div className="text-[11px] text-[#5a7086]">{t("L'IA lit la demande, choisit les véhicules réels de l'inventaire et calcule les paiements. Les champs à droite ont priorité.")}</div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 content-start">
            <label>
              <span className="lbl text-[12px]">{t("Type")}</span>
              <select className="fld" value={dealType} onChange={(e) => setDealType(e.target.value as DealType)}>
                <option value="finance">{t("Financement")}</option>
                <option value="lease">{t("Location")}</option>
                <option value="cash">{t("Comptant")}</option>
              </select>
            </label>
            <label>
              <span className="lbl text-[12px]">{t("Fréquence")}</span>
              <select className="fld" value={frequency} onChange={(e) => setFrequency(e.target.value as Frequency)} disabled={dealType === "cash"}>
                {(Object.keys(FREQ_LABEL_FR) as Frequency[]).map((k) => <option key={k} value={k}>{freqLbl(k)}</option>)}
              </select>
            </label>
            <label><span className="lbl text-[12px]">{t("Terme (mois)")}</span><NumField value={term} decimals={0} blankZero onChange={setTerm} /></label>
            <label><span className="lbl text-[12px]">{dealType === "cash" ? t("Prix cible") : t("Paiement cible (taxes incl.)")}</span><NumField value={target} blankZero onChange={setTarget} className="!bg-[#fffbe0]" /></label>
            <label><span className="lbl text-[12px]">{t("Prix max. du véhicule")}</span><NumField value={maxPrice} blankZero onChange={setMaxPrice} /></label>
            <label><span className="lbl text-[12px]">{t("Comptant")}</span><NumField value={cashDown} blankZero onChange={setCashDown} /></label>
            <label className="col-span-2 md:col-span-3"><span className="lbl text-[12px]">{t("Véhicule (marque, modèle, année)")}</span><input className="fld" value={vehicleQuery} onChange={(e) => setVehicleQuery(e.target.value)} placeholder="ex. Audi Q5" /></label>
            <label>
              <span className="lbl text-[12px]">{t("Garantie prolongée")}</span>
              <select className="fld" value={warrantyYears} onChange={(e) => setWarrantyYears(Number(e.target.value))}>
                <option value={0}>{t("Aucune")}</option>
                {[1, 2, 3, 4, 5, 6].map((y) => <option key={y} value={y}>{y} {y > 1 ? t("ans") : t("an")}</option>)}
              </select>
            </label>
            <label>
              <span className="lbl text-[12px]">{t("Pneus & jantes")}</span>
              <select className="fld" value={tireRimYears} onChange={(e) => setTireRimYears(Number(e.target.value))}>
                <option value={0}>{t("Aucune")}</option>
                {[1, 2, 3, 4, 5, 6].map((y) => <option key={y} value={y}>{y} {y > 1 ? t("ans") : t("an")}</option>)}
              </select>
            </label>
            <div className="col-span-2 md:col-span-3">
              <span className="lbl text-[12px]">{t("Accessoires")}</span>
              {accessories.map((a, i) => (
                <div key={i} className="flex gap-1 mb-1">
                  <input className="fld" value={a.name} placeholder={t("Nom de l'accessoire")} onChange={(e) => setAccessories((l) => l.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
                  <div className="w-32 shrink-0"><NumField value={a.price} onChange={(n) => setAccessories((l) => l.map((x, j) => (j === i ? { ...x, price: n } : x)))} /></div>
                  <button className="dots" onClick={() => setAccessories((l) => l.filter((_, j) => j !== i))}>✕</button>
                </div>
              ))}
              <button className="btn !py-0.5" onClick={() => setAccessories((l) => [...l, { name: "", price: 0 }])}>+ {t("Accessoire")}</button>
            </div>
          </div>
          <div className="xl:col-span-2 flex items-center gap-2">
            <button className="btn btn-primary !py-2 !px-5" onClick={generate} disabled={busy}>{busy ? t("Analyse…") : `${t("Générer les offres")}`}</button>
            {msg && <span className="text-[13px] text-[#005a96] font-semibold">{msg}</span>}
          </div>
        </div>

        {results && results.length > 0 && (
          <div className="border-t border-[#bccbd8] p-3">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
              {results.map((r, i) => {
                const on = selected.includes(i);
                return (
                  <div key={i} className={`border-2 bg-white p-3 cursor-pointer ${on ? "border-[#0071bc]" : "border-[#ccd8e3] opacity-70"}`} onClick={() => setSelected((s) => (on ? s.filter((x) => x !== i) : [...s, i]))}>
                    <div className="flex items-start gap-2">
                      <input type="checkbox" readOnly checked={on} className="mt-1" />
                      <div className="flex-1">
                        <div className="font-bold text-[#00263d]">{r.vehicle.year} {r.vehicle.make} {r.vehicle.model} {r.vehicle.trim}</div>
                        <div className="text-[11px] text-[#5a7086]">#{r.vehicle.stock} · {Math.round(r.vehicle.kms).toLocaleString(loc)} km · {r.vehicle.extColor}</div>
                      </div>
                      {r.meetsTarget !== null && (
                        <span className={`text-[10px] px-1.5 py-0.5 text-white ${r.meetsTarget ? "bg-green-700" : "bg-amber-600"}`}>{r.meetsTarget ? t("Cible atteinte") : t("Au-dessus de la cible")}</span>
                      )}
                    </div>
                    <div className="mt-2 text-[24px] font-bold text-[#0071bc] tabular-nums">
                      {fmtDesk(r.payment)} $
                      <span className="text-[12px] font-normal text-[#5a7086]"> {dealType === "cash" ? t("total") : `/ ${freqLbl(r.frequency)}`}</span>
                    </div>
                    <div className="text-[12px] text-[#1e3a50] space-y-0.5 mt-1">
                      {r.term && <div>{t(TYPE_LABEL[dealType])} · {r.term} {t("mois")} · {r.rate}% · {r.lender}</div>}
                      <div>{t("PDSF")} {fmtDesk(r.msrp)} $ → <b>{fmtDesk(r.sellingPrice)} $</b></div>
                      <div>{t("Rabais")} : <b>{fmtDesk(r.discount)} $</b> ({r.discountPct.toFixed(2)} %)</div>
                      {r.products.map((p) => <div key={p.name}>+ {t(p.name)}{p.term ? ` (${p.term} ${p.term > 1 ? t("ans") : t("an")})` : ""} : {fmtDesk(p.price)} $</div>)}
                      {r.accessoriesTotal > 0 && <div>+ {t("Accessoires")} : {fmtDesk(r.accessoriesTotal)} $</div>}
                      <div>{t("Dû à la livraison")} : {fmtDesk(r.dueOnDelivery)} $</div>
                      {isManager && <div className="text-green-800">{t("Profit brut")} : {fmtDesk(r.gross)} $</div>}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex mt-3">
              <button className="btn btn-primary !py-2 !px-5 ml-auto" disabled={busy || !selected.length} onClick={submit}>
                {t("Soumettre pour approbation")} ({selected.length})
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="win">
        <div className="win-title flex items-center px-3 h-9">
          <span>{t("Offres — Approbation du gestionnaire")}</span>
        </div>
        <div className="flex gap-1 p-2 border-b border-[#bccbd8]">
          {["pending", "approved", "declined", "all"].map((s) => (
            <button key={s} className={`tabbtn !border-b ${statusF === s ? "active" : ""}`} onClick={() => setStatusF(s)}>
              {s === "all" ? t("Toutes") : t(STATUS[s].label)}
            </button>
          ))}
          {!isManager && <span className="ml-auto text-[12px] text-[#5a7086] self-center">{t("Seul un gestionnaire peut approuver ou refuser.")}</span>}
        </div>
        <div className="overflow-x-auto">
          <table className="grid-table w-full text-left">
            <thead>
              <tr>
                <th>{t("# Offre")}</th>
                <th>{t("Client")}</th>
                <th>{t("Véhicule")}</th>
                <th>{t("Type")}</th>
                <th className="text-right">{t("Paiement")}</th>
                <th className="text-right">{t("Rabais")}</th>
                <th>{t("Produits")}</th>
                <th>{t("Créée par")}</th>
                <th>{t("Statut")}</th>
                <th className="text-right">{t("Actions")}</th>
              </tr>
            </thead>
            <tbody>
              {list.length === 0 && <tr><td colSpan={10} className="text-center py-6 text-[#003a5d]">{t("Aucune offre.")}</td></tr>}
              {list.map((q) => {
                const r = q.result;
                const st = STATUS[q.status] ?? STATUS.pending;
                return (
                  <tr key={q.id} className="align-top">
                    <td className="font-mono font-semibold whitespace-nowrap">{q.quoteNumber || `#${q.id}`}</td>
                    <td>{q.firstName || q.lastName ? `${q.firstName ?? ""} ${q.lastName ?? ""}`.trim() : "—"}</td>
                    <td className="max-w-[220px]">
                      {r ? `${r.vehicle.year} ${r.vehicle.make} ${r.vehicle.model} ${r.vehicle.trim}` : q.summary}
                      {r && <div className="text-[11px] text-[#5a7086]">#{r.vehicle.stock}</div>}
                    </td>
                    <td>{t(TYPE_LABEL[q.dealType] ?? q.dealType)}</td>
                    <td className="text-right tabular-nums whitespace-nowrap">
                      {r ? <><b>{fmtDesk(r.payment)} $</b><div className="text-[11px] text-[#5a7086]">{q.dealType === "cash" ? t("total") : `${freqLbl(r.frequency)} · ${r.term} ${t("mois")}`}</div></> : "—"}
                    </td>
                    <td className="text-right tabular-nums whitespace-nowrap">{r ? <>{fmtDesk(r.discount)} $<div className="text-[11px] text-[#5a7086]">{r.discountPct.toFixed(2)} %</div></> : "—"}</td>
                    <td className="text-[11px] max-w-[180px]">{r?.products.map((p) => `${t(p.name)}${p.term ? ` ${p.term}a` : ""}`).join(", ") || "—"}{r && r.accessoriesTotal > 0 ? ` · ${t("Accessoires")}` : ""}</td>
                    <td className="text-[12px]">{q.createdBy || "—"}<div className="text-[11px] text-[#5a7086]">{new Date(q.createdAt).toLocaleString(loc, { dateStyle: "short", timeStyle: "short" })}</div></td>
                    <td>
                      <span className="text-[11px] px-1.5 py-0.5 text-white" style={{ background: st.color }}>{t(st.label)}</span>
                      {q.decidedBy && <div className="text-[11px] text-[#5a7086] mt-0.5">{q.decidedBy}{q.decisionNote ? ` — ${q.decisionNote}` : ""}</div>}
                    </td>
                    <td className="text-right whitespace-nowrap">
                      {q.status === "pending" && isManager && (
                        <div className="flex flex-col gap-1 items-end">
                          <input className="fld !h-7 !w-44" placeholder={t("Note (optionnel)")} value={notes[q.id] ?? ""} onChange={(e) => setNotes((n) => ({ ...n, [q.id]: e.target.value }))} />
                          <div className="flex gap-1">
                            <button className="btn !bg-green-700 !text-white !border-green-800" onClick={() => decide(q.id, "approve")} title={t("Approuver et convertir en dossier")}>✓ {t("Approuver → Dossier")}</button>
                            <button className="btn btn-danger" onClick={() => decide(q.id, "decline")}>✕ {t("Refuser")}</button>
                          </div>
                        </div>
                      )}
                      {q.dealId && (
                        <div className="flex flex-col items-end gap-1">
                          <Link className="btn btn-primary" href={`/deals/${q.dealId}`}>{t("Ouvrir le dossier")}</Link>
                          <Link className="text-[11px] text-[#005a96] underline" href="/deals">{t("Voir dans le Gestionnaire de dossiers")}</Link>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
