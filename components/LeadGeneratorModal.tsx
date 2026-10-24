"use client";

import { useEffect, useState } from "react";
import { fmtDesk, FREQ_LABEL_FR, type DealType, type Frequency } from "@/lib/deal";
import { useLang } from "@/lib/i18n";
import { REGION_LABEL, type Region } from "@/lib/lead-generator";
import StaffSelect from "./StaffSelect";

export interface Lead {
  firstName: string;
  lastName: string;
  mobile: string;
  email: string;
  address: string;
  city: string;
  province: string;
  postal: string;
  stage: string;
  leadSource: string;
  interestVehicle: string;
  dealTypePref: DealType;
  budgetPrice: number;
  desiredPayment: number;
  paymentFrequency: Frequency;
  actualPayment: number;
  term: number | null;
  assignedTo: string;
  notes: string;
  region: Region;
}

const TYPE_LABEL: Record<string, string> = { cash: "Comptant", finance: "Financement", lease: "Location" };

export async function generateLeads(opts: { count: number; region?: string; dealType?: string; assignTo?: string; fictional?: boolean }) {
  const r = await fetch("/api/customers/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode: "preview", ...opts }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error ?? "Erreur");
  return j as { leads: Lead[]; engine: string };
}

export default function LeadGeneratorModal({ onClose, onSaved }: { onClose: () => void; onSaved: (n: number) => void }) {
  const { t, lang } = useLang();
  const loc = lang === "fr" ? "fr-CA" : "en-CA";
  const [count, setCount] = useState(5);
  const [region, setRegion] = useState<Region | "">("");
  const [dealType, setDealType] = useState<DealType | "">("");
  const [assignTo, setAssignTo] = useState("");
  const [fictional, setFictional] = useState(false);
  const [followUp, setFollowUp] = useState(true);
  const [leads, setLeads] = useState<Lead[] | null>(null);
  const [selected, setSelected] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [engine, setEngine] = useState("");

  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);

  async function gen() {
    setBusy(true);
    setErr("");
    try {
      const j = await generateLeads({ count, region, dealType, assignTo, fictional });
      setLeads(j.leads);
      setSelected(j.leads.map((_, i) => i));
      setEngine(j.engine);
    } catch (e) {
      setErr(t((e as Error).message));
    }
    setBusy(false);
  }

  async function save() {
    if (!leads) return;
    setBusy(true);
    const r = await fetch("/api/customers/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "save", followUp, leads: leads.filter((_, i) => selected.includes(i)) }),
    });
    const j = await r.json();
    setBusy(false);
    onSaved(j.saved ?? 0);
  }

  const edit = (i: number, k: keyof Lead, v: string | number) => setLeads((l) => (l ? l.map((x, j) => (j === i ? { ...x, [k]: v } : x)) : l));

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center pt-10 px-4" onClick={onClose}>
      <div className="win w-full max-w-[1250px] max-h-[88vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="win-title flex items-center h-9 px-3 shrink-0">
          <span>{t("Nouveaux clients par IA")}</span>
          {engine && <span className="ml-3 text-xs text-[#cfe3f2]">{engine === "ai" ? t("Notes rédigées par l'IA") : t("Générateur local")}</span>}
          <button className="ml-auto text-white/80 hover:text-white" onClick={onClose}>✕</button>
        </div>
        <div className="p-3 border-b border-[#bfcfdc] grid grid-cols-2 md:grid-cols-6 gap-2 items-end shrink-0">
          <label>
            <span className="lbl text-[12px]">{t("Nombre")}</span>
            <select className="fld" value={count} onChange={(e) => setCount(Number(e.target.value))}>
              {[1, 3, 5, 10, 15, 20].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
          <label>
            <span className="lbl text-[12px]">{t("Région")}</span>
            <select className="fld" value={region} onChange={(e) => setRegion(e.target.value as Region | "")}>
              <option value="">{t("Grand Montréal (mixte)")}</option>
              {(Object.keys(REGION_LABEL) as Region[]).map((k) => <option key={k} value={k}>{t(REGION_LABEL[k])}</option>)}
            </select>
          </label>
          <label>
            <span className="lbl text-[12px]">{t("Type de transaction")}</span>
            <select className="fld" value={dealType} onChange={(e) => setDealType(e.target.value as DealType | "")}>
              <option value="">{t("Aléatoire")}</option>
              <option value="lease">{t("Location")}</option>
              <option value="finance">{t("Financement")}</option>
              <option value="cash">{t("Comptant")}</option>
            </select>
          </label>
          <label className="md:col-span-2">
            <span className="lbl text-[12px]">{t("Assigné à")}</span>
            <StaffSelect value={assignTo} onChange={setAssignTo} placeholder={`— ${t("Rotation des vendeurs")} —`} />
          </label>
          <button className="btn btn-primary !py-2" onClick={gen} disabled={busy}>{busy ? t("Génération…") : `${t("Générer")}`}</button>
          <div className="col-span-2 md:col-span-6 flex flex-wrap gap-4 text-[12px] text-[#1e3a50]">
            <label className="flex items-center gap-1"><input type="checkbox" checked={followUp} onChange={(e) => setFollowUp(e.target.checked)} /> {t("Créer un suivi (appel) le prochain jour ouvrable")}</label>
            <label className="flex items-center gap-1"><input type="checkbox" checked={fictional} onChange={(e) => setFictional(e.target.checked)} /> {t("Numéros fictifs (555) — démonstration")}</label>
            <span className="text-[#5a7086]">{t("Le paiement désiré est calculé sur le vrai paiement du véhicule, 5 à 15 % plus bas (le client demande un rabais).")}</span>
          </div>
          {err && <div className="col-span-2 md:col-span-6 text-[13px] text-red-700">{err}</div>}
        </div>

        <div className="flex-1 overflow-auto">
          {leads && (
            <table className="grid-table w-full text-left text-[12px]">
              <thead className="sticky top-0">
                <tr>
                  <th className="w-[30px]" />
                  <th>{t("Client")}</th>
                  <th>{t("Cellulaire / Courriel")}</th>
                  <th>{t("Adresse")}</th>
                  <th>{t("Véhicule recherché")}</th>
                  <th>{t("Type")}</th>
                  <th className="text-right">{t("Paiement réel")}</th>
                  <th className="text-right">{t("Paiement désiré")}</th>
                  <th>{t("Source")}</th>
                  <th>{t("Assigné à")}</th>
                  <th>{t("Notes")}</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((l, i) => {
                  const on = selected.includes(i);
                  return (
                    <tr key={i} className={`align-top ${on ? "" : "opacity-50"}`}>
                      <td><input type="checkbox" checked={on} onChange={() => setSelected((s) => (on ? s.filter((x) => x !== i) : [...s, i]))} /></td>
                      <td className="min-w-[140px]">
                        <input className="fld !h-6 !text-[12px] mb-0.5" value={l.firstName} onChange={(e) => edit(i, "firstName", e.target.value)} />
                        <input className="fld !h-6 !text-[12px]" value={l.lastName} onChange={(e) => edit(i, "lastName", e.target.value)} />
                      </td>
                      <td className="whitespace-nowrap">
                        <div className="tabular-nums">{l.mobile}</div>
                        <div className="text-[#5a7086]">{l.email}</div>
                      </td>
                      <td className="min-w-[180px]">
                        <div>{l.address}</div>
                        <div className="text-[#5a7086]">{l.city}, {l.province} {l.postal}</div>
                      </td>
                      <td className="min-w-[150px]">{l.interestVehicle}</td>
                      <td>
                        {t(TYPE_LABEL[l.dealTypePref])}
                        {l.term && <div className="text-[#5a7086]">{l.term} {t("mois")}</div>}
                      </td>
                      <td className="text-right tabular-nums whitespace-nowrap">
                        {l.dealTypePref === "cash" ? <>{fmtDesk(l.actualPayment)} $</> : <>{fmtDesk(l.actualPayment)} $<div className="text-[#5a7086]">{t(FREQ_LABEL_FR[l.paymentFrequency])}</div></>}
                      </td>
                      <td className="text-right tabular-nums whitespace-nowrap font-semibold text-[#005a96]">
                        {l.dealTypePref === "cash" ? (
                          <>{fmtDesk(l.budgetPrice)} $<div className="text-[#5a7086] font-normal">{t("Budget")}</div></>
                        ) : (
                          <>{l.desiredPayment.toLocaleString(loc)} $<div className="text-[#5a7086] font-normal">{t(FREQ_LABEL_FR[l.paymentFrequency])}</div></>
                        )}
                      </td>
                      <td>{t(l.leadSource)}</td>
                      <td className="whitespace-nowrap">{l.assignedTo}</td>
                      <td className="min-w-[260px] max-w-[360px] text-[11px] leading-snug">{l.notes}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          {!leads && !busy && <div className="p-8 text-center text-[13px] text-[#003a5d]">{t("Choisissez les options puis cliquez « Générer ».")}</div>}
        </div>

        {leads && (
          <div className="p-3 border-t border-[#bfcfdc] flex items-center gap-2 shrink-0">
            <span className="text-[12px] text-[#5a7086]">{selected.length} / {leads.length} {t("sélectionné(s)")}</span>
            <button className="btn ml-auto" onClick={gen} disabled={busy}>↻ {t("Regénérer")}</button>
            <button className="btn btn-primary !px-5" onClick={save} disabled={busy || !selected.length}>{t("Ajouter au CRM")} ({selected.length})</button>
          </div>
        )}
      </div>
    </div>
  );
}
