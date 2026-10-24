"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { fmtDesk, FREQ_LABEL_FR, PROVINCES, type Frequency } from "@/lib/deal";
import { useLang } from "@/lib/i18n";
import LeadGeneratorModal, { generateLeads } from "./LeadGeneratorModal";

export interface Client {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  homePhone: string;
  mobile: string;
  address: string;
  city: string;
  province: string;
  postal: string;
  notes: string;
  stage?: string;
  leadSource?: string;
  interestVehicle?: string;
  budgetPrice?: string;
  desiredPayment?: string;
  paymentFrequency?: string;
  dealTypePref?: string;
  assignedTo?: string;
  createdAt: string;
  updatedAt: string;
  dealCount?: number;
  lastDealAt?: string | null;
  nextFollowUp?: string | null;
  openFollowUps?: number;
}

interface FollowUp {
  id: number;
  customerId: number;
  dueAt: string;
  kind: string;
  notes: string;
  assignedTo: string;
  done: boolean;
  firstName?: string;
  lastName?: string;
  mobile?: string;
  interestVehicle?: string;
}
interface ClientDeal { id: number; dealNumber: string; vehicleLabel: string; dealType: string; status: string; updatedAt: string }
interface ClientQuote { id: number; quoteNumber?: string; status: string; dealType: string; summary: string; createdAt: string }

export const STAGES: Record<string, { label: string; color: string }> = {
  new: { label: "Nouveau prospect", color: "#0071bc" },
  contacted: { label: "Contacté", color: "#0b9bb5" },
  appointment: { label: "Rendez-vous", color: "#6c4bd1" },
  negotiation: { label: "Négociation", color: "#e0a100" },
  sold: { label: "Vendu", color: "#2e9a57" },
  lost: { label: "Perdu", color: "#c0392b" },
};
const KINDS: Record<string, string> = { call: "Appel", sms: "Texto", email: "Courriel", appointment: "Rendez-vous", test_drive: "Essai routier", delivery: "Livraison" };
const TYPE_LABEL: Record<string, string> = { cash: "Comptant", finance: "Financement", lease: "Location" };
const STATUS_LABEL: Record<string, string> = { open: "Ouvert", pending: "En attente", sold: "Vendu", lost: "Perdu", approved: "Approuvée", declined: "Refusée" };

const EMPTY = {
  firstName: "", lastName: "", email: "", homePhone: "", mobile: "", address: "", city: "", province: "QC", postal: "", notes: "",
  stage: "new", leadSource: "", interestVehicle: "", budgetPrice: "0", desiredPayment: "0", paymentFrequency: "monthly", dealTypePref: "", assignedTo: "",
};
type Form = typeof EMPTY;

const localInput = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);

export default function ClientsManager() {
  const { t, lang } = useLang();
  const router = useRouter();
  const loc = lang === "fr" ? "fr-CA" : "en-CA";
  const [tab, setTab] = useState<"clients" | "agenda">("clients");
  const [list, setList] = useState<Client[] | null>(null);
  const [q, setQ] = useState("");
  const [stageF, setStageF] = useState("");
  const [sel, setSel] = useState<number | "new" | null>(null);
  const [form, setForm] = useState<Form>(EMPTY);
  const [deals, setDeals] = useState<ClientDeal[]>([]);
  const [quotes, setQuotes] = useState<ClientQuote[]>([]);
  const [fus, setFus] = useState<FollowUp[]>([]);
  const [agenda, setAgenda] = useState<FollowUp[]>([]);
  const [saved, setSaved] = useState("");
  const [busy, setBusy] = useState(false);
  const [staff, setStaff] = useState<string[]>([]);
  const [aiModal, setAiModal] = useState(false);
  const [aiFilling, setAiFilling] = useState(false);
  const [nf, setNf] = useState({ dueAt: localInput(new Date(Date.now() + 86400000)), kind: "call", notes: "", assignedTo: "" });

  const reload = useCallback(async () => {
    const r = await fetch("/api/customers");
    setList(await r.json());
  }, []);
  const reloadAgenda = useCallback(async () => {
    const r = await fetch("/api/followups?status=open");
    setAgenda(await r.json());
  }, []);
  useEffect(() => {
    void reload();
    void reloadAgenda();
    fetch("/api/staff").then((r) => (r.ok ? r.json() : [])).then((l: { name: string }[]) => setStaff(l.map((x) => x.name))).catch(() => {});
  }, [reload, reloadAgenda]);

  async function open(id: number) {
    setSel(id);
    setSaved("");
    const r = await fetch(`/api/customers/${id}`);
    const j = (await r.json()) as Client & { deals: ClientDeal[]; followups: FollowUp[]; quotes: ClientQuote[] };
    setForm({
      firstName: j.firstName, lastName: j.lastName, email: j.email, homePhone: j.homePhone, mobile: j.mobile, address: j.address,
      city: j.city, province: j.province || "QC", postal: j.postal, notes: j.notes, stage: j.stage || "new", leadSource: j.leadSource ?? "",
      interestVehicle: j.interestVehicle ?? "", budgetPrice: j.budgetPrice ?? "0", desiredPayment: j.desiredPayment ?? "0",
      paymentFrequency: j.paymentFrequency || "monthly", dealTypePref: j.dealTypePref ?? "", assignedTo: j.assignedTo ?? "",
    });
    setDeals(j.deals);
    setFus(j.followups);
    setQuotes(j.quotes);
  }

  async function save() {
    if (!form.firstName.trim() && !form.lastName.trim()) return;
    setBusy(true);
    if (sel === "new") {
      const r = await fetch("/api/customers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const j = (await r.json()) as Client;
      await reload();
      await open(j.id);
    } else if (typeof sel === "number") {
      await fetch(`/api/customers/${sel}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      await reload();
    }
    setSaved(`✓ ${t("Sauvegardé")}`);
    setBusy(false);
  }

  async function remove() {
    if (typeof sel !== "number" || !confirm(t("Supprimer ce client ? Ses dossiers seront conservés."))) return;
    await fetch(`/api/customers/${sel}`, { method: "DELETE" });
    setSel(null);
    await reload();
    await reloadAgenda();
  }

  async function addFollowUp() {
    if (typeof sel !== "number") return;
    await fetch("/api/followups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...nf, customerId: sel, dueAt: new Date(nf.dueAt).toISOString() }),
    });
    setNf((x) => ({ ...x, notes: "" }));
    await open(sel);
    await reload();
    await reloadAgenda();
  }

  async function toggleDone(f: FollowUp) {
    await fetch(`/api/followups/${f.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ done: !f.done }) });
    if (typeof sel === "number") await open(sel);
    await reload();
    await reloadAgenda();
  }

  async function delFollowUp(f: FollowUp) {
    await fetch(`/api/followups/${f.id}`, { method: "DELETE" });
    if (typeof sel === "number") await open(sel);
    await reload();
    await reloadAgenda();
  }

  async function newDeal() {
    if (typeof sel !== "number") return;
    const r = await fetch("/api/deals", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ customerId: sel }) });
    const j = await r.json();
    router.push(`/deals/${j.id}`);
  }

  const filtered = useMemo(() => {
    const s = q.toLowerCase().trim();
    const digits = s.replace(/\D/g, "");
    return (list ?? []).filter(
      (c) =>
        (!stageF || (c.stage || "new") === stageF) &&
        (!s ||
          `${c.firstName} ${c.lastName} ${c.email} ${c.city} ${c.interestVehicle ?? ""}`.toLowerCase().includes(s) ||
          (digits.length >= 3 && `${c.mobile} ${c.homePhone}`.replace(/\D/g, "").includes(digits))),
    );
  }, [list, q, stageF]);

  const f = (k: keyof Form) => ({
    value: form[k],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setForm((x) => ({ ...x, [k]: e.target.value })),
  });
  const now = Date.now();
  const due = (d: string) => {
    const ms = new Date(d).getTime();
    return ms < now ? "text-red-700 font-semibold" : ms < now + 86400000 ? "text-amber-700 font-semibold" : "text-[#1e3a50]";
  };
  const fmtDT = (d: string) => new Date(d).toLocaleString(loc, { dateStyle: "medium", timeStyle: "short" });
  const overdue = agenda.filter((a) => new Date(a.dueAt).getTime() < now).length;
  const today = agenda.filter((a) => {
    const x = new Date(a.dueAt);
    const n = new Date();
    return x.toDateString() === n.toDateString();
  }).length;

  return (
    <div className="space-y-3">
      {aiModal && (
        <LeadGeneratorModal
          onClose={() => setAiModal(false)}
          onSaved={async (n) => {
            setAiModal(false);
            await reload();
            await reloadAgenda();
            setSaved(`✓ ${n} ${t("client(s) ajouté(s)")}`);
            setTab("clients");
          }}
        />
      )}
      <div className="flex items-center gap-1">
        <button className={`tabbtn ${tab === "clients" ? "active" : ""}`} onClick={() => setTab("clients")}>{t("Clients")}</button>
        <button className={`tabbtn ${tab === "agenda" ? "active" : ""}`} onClick={() => setTab("agenda")}>
          {t("Suivis & rendez-vous")} {agenda.length > 0 && <span className="ml-1 text-[11px] px-1.5 bg-[#0071bc] text-white rounded-sm">{agenda.length}</span>}
          {overdue > 0 && <span className="ml-1 text-[11px] px-1.5 bg-red-600 text-white rounded-sm">{overdue} {t("en retard")}</span>}
        </button>
        <span className="ml-auto text-[12px] text-[#1e3a50]">{t("Aujourd'hui")} : <b>{today}</b> · {t("En retard")} : <b className="text-red-700">{overdue}</b></span>
      </div>

      {tab === "agenda" ? (
        <div className="win">
          <div className="win-title flex items-center px-3 h-9"><span>{t("Suivis & rendez-vous")}</span></div>
          <table className="grid-table w-full text-left">
            <thead>
              <tr>
                <th className="w-[40px]" />
                <th>{t("Date")}</th>
                <th>{t("Type")}</th>
                <th>{t("Client")}</th>
                <th>{t("Cellulaire")}</th>
                <th>{t("Recherche")}</th>
                <th>{t("Notes")}</th>
                <th>{t("Assigné à")}</th>
              </tr>
            </thead>
            <tbody>
              {agenda.length === 0 && <tr><td colSpan={8} className="text-center py-8 text-[#003a5d]">{t("Aucun suivi ouvert.")}</td></tr>}
              {agenda.map((a) => (
                <tr key={a.id} className="hover:bg-white">
                  <td className="text-center"><input type="checkbox" checked={a.done} onChange={() => toggleDone(a)} title={t("Terminé")} /></td>
                  <td className={due(a.dueAt)}>{fmtDT(a.dueAt)}</td>
                  <td>{t(KINDS[a.kind] ?? a.kind)}</td>
                  <td>
                    <button className="text-[#0071bc] underline font-semibold" onClick={() => { setTab("clients"); void open(a.customerId); }}>
                      {`${a.firstName ?? ""} ${a.lastName ?? ""}`.trim()}
                    </button>
                  </td>
                  <td>{a.mobile || "—"}</td>
                  <td className="max-w-[180px] truncate">{a.interestVehicle || "—"}</td>
                  <td className="max-w-[260px] truncate">{a.notes}</td>
                  <td>{a.assignedTo}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_540px] gap-4 items-start">
          <div className="win">
            <div className="win-title flex items-center px-3 h-9">
              <span>{t("CRM — Base de clients")}</span>
              <span className="ml-auto text-xs text-[#cfe3f2]">{sel === null && saved ? `${saved} · ` : ""}{list?.length ?? 0} {t("client(s)")}</span>
            </div>
            <div className="flex flex-wrap items-center gap-2 p-3 border-b border-[#bccbd8]">
              <button className="btn btn-primary" onClick={() => { setSel("new"); setForm(EMPTY); setDeals([]); setFus([]); setQuotes([]); setSaved(""); }}>
                + {t("Nouveau client")}
              </button>
              <button className="btn btn-primary" onClick={() => setAiModal(true)}>{t("Nouveau client par IA")}</button>
              <input className="fld max-w-xs" placeholder={t("Nom, téléphone, courriel, ville…")} value={q} onChange={(e) => setQ(e.target.value)} />
              <select className="fld !w-44" value={stageF} onChange={(e) => setStageF(e.target.value)}>
                <option value="">{t("Toutes les étapes")}</option>
                {Object.entries(STAGES).map(([k, v]) => <option key={k} value={k}>{t(v.label)}</option>)}
              </select>
            </div>
            <div className="overflow-x-auto">
              <table className="grid-table w-full text-left">
                <thead>
                  <tr>
                    <th>{t("Nom")}</th>
                    <th>{t("Étape")}</th>
                    <th>{t("Recherche")}</th>
                    <th className="text-right">{t("Budget / Paiement")}</th>
                    <th>{t("Prochain suivi")}</th>
                    <th>{t("Cellulaire")}</th>
                  </tr>
                </thead>
                <tbody>
                  {list === null && <tr><td colSpan={6} className="text-center py-8 text-[#003a5d]">{t("Chargement…")}</td></tr>}
                  {list !== null && filtered.length === 0 && <tr><td colSpan={6} className="text-center py-8 text-[#003a5d]">{t("Aucun client.")}</td></tr>}
                  {filtered.map((c) => {
                    const st = STAGES[c.stage || "new"] ?? STAGES.new;
                    const pay = Number(c.desiredPayment) || 0;
                    const bud = Number(c.budgetPrice) || 0;
                    return (
                      <tr key={c.id} className={`cursor-pointer ${sel === c.id ? "bg-[#d4e8f7]" : "hover:bg-white"}`} onClick={() => void open(c.id)}>
                        <td className="font-semibold">{`${c.firstName} ${c.lastName}`.trim()}</td>
                        <td><span className="text-[11px] px-1.5 py-0.5 text-white whitespace-nowrap" style={{ background: st.color }}>{t(st.label)}</span></td>
                        <td className="max-w-[200px]">
                          <div className="truncate">{c.interestVehicle || "—"}</div>
                          {c.dealTypePref && <div className="text-[11px] text-[#5a7086]">{t(TYPE_LABEL[c.dealTypePref])}</div>}
                        </td>
                        <td className="text-right tabular-nums whitespace-nowrap">
                          {pay > 0 && <div>{fmtDesk(pay)} $ <span className="text-[11px] text-[#5a7086]">/ {t(FREQ_LABEL_FR[(c.paymentFrequency as Frequency) || "monthly"])}</span></div>}
                          {bud > 0 && <div className="text-[11px] text-[#5a7086]">{t("Budget")} {fmtDesk(bud)} $</div>}
                          {!pay && !bud && "—"}
                        </td>
                        <td className={`text-[12px] ${c.nextFollowUp ? due(c.nextFollowUp) : ""}`}>{c.nextFollowUp ? fmtDT(c.nextFollowUp) : "—"}</td>
                        <td className="tabular-nums">{c.mobile || c.homePhone || "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="win xl:sticky xl:top-[72px] max-h-[calc(100vh-90px)] overflow-y-auto">
            <div className="win-title flex items-center px-3 h-9 sticky top-0 z-10">
              <span>{sel === "new" ? t("Nouveau client") : sel ? `${form.firstName} ${form.lastName}`.trim() || t("Client") : t("Fiche client")}</span>
              <span className="ml-auto text-xs text-[#cfe3f2]">{saved}</span>
            </div>
            {sel === null ? (
              <div className="p-6 text-center text-[13px] text-[#003a5d]">{t("Sélectionnez un client ou créez-en un nouveau.")}</div>
            ) : (
              <div className="p-3 space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <label><span className="lbl text-[12px]">{t("Prénom")}</span><input className="fld" {...f("firstName")} /></label>
                  <label><span className="lbl text-[12px]">{t("Nom")}</span><input className="fld" {...f("lastName")} /></label>
                  <label><span className="lbl text-[12px]">{t("Cellulaire")}</span><input className="fld" {...f("mobile")} /></label>
                  <label><span className="lbl text-[12px]">{t("Courriel")}</span><input className="fld" type="email" {...f("email")} /></label>
                  <label className="col-span-2"><span className="lbl text-[12px]">{t("Adresse")}</span><input className="fld" {...f("address")} /></label>
                  <label><span className="lbl text-[12px]">{t("Ville")}</span><input className="fld" {...f("city")} /></label>
                  <label>
                    <span className="lbl text-[12px]">{t("Province")}</span>
                    <select className="fld" {...f("province")}>{PROVINCES.map((p) => <option key={p.code} value={p.code}>{p.code} – {p.name}</option>)}</select>
                  </label>
                </div>

                <div className="border border-[#a9bccb] bg-[#f2f6f9] p-2">
                  <div className="lbl font-semibold text-[13px] mb-1">{t("Ce que le client recherche")}</div>
                  <div className="grid grid-cols-2 gap-2">
                    <label>
                      <span className="lbl text-[12px]">{t("Étape")}</span>
                      <select className="fld" {...f("stage")}>{Object.entries(STAGES).map(([k, v]) => <option key={k} value={k}>{t(v.label)}</option>)}</select>
                    </label>
                    <label>
                      <span className="lbl text-[12px]">{t("Source")}</span>
                      <input className="fld" list="lead-sources" {...f("leadSource")} />
                      <datalist id="lead-sources">
                        {["Walk-in", "Site Web", "Téléphone", "Facebook", "Marketplace", "AutoTrader", "Kijiji", "Référence", "Client existant"].map((x) => <option key={x} value={x} />)}
                      </datalist>
                    </label>
                    <label className="col-span-2"><span className="lbl text-[12px]">{t("Véhicule recherché")}</span><input className="fld" placeholder="ex. 2024 Audi Q5, SUV AWD…" {...f("interestVehicle")} /></label>
                    <label>
                      <span className="lbl text-[12px]">{t("Type de transaction")}</span>
                      <select className="fld" {...f("dealTypePref")}>
                        <option value="">—</option>
                        <option value="finance">{t("Financement")}</option>
                        <option value="lease">{t("Location")}</option>
                        <option value="cash">{t("Comptant")}</option>
                      </select>
                    </label>
                    <label><span className="lbl text-[12px]">{t("Budget prix du véhicule")}</span><input className="fld num" inputMode="decimal" {...f("budgetPrice")} /></label>
                    <label><span className="lbl text-[12px]">{t("Paiement désiré")}</span><input className="fld num" inputMode="decimal" {...f("desiredPayment")} /></label>
                    <label>
                      <span className="lbl text-[12px]">{t("Fréquence")}</span>
                      <select className="fld" {...f("paymentFrequency")}>
                        {(Object.keys(FREQ_LABEL_FR) as Frequency[]).map((k) => <option key={k} value={k}>{t(FREQ_LABEL_FR[k])}</option>)}
                      </select>
                    </label>
                    <label className="col-span-2">
                      <span className="lbl text-[12px]">{t("Assigné à")}</span>
                      <input className="fld" list="crm-staff" {...f("assignedTo")} />
                      <datalist id="crm-staff">{staff.map((n) => <option key={n} value={n} />)}</datalist>
                    </label>
                    <label className="col-span-2"><span className="lbl text-[12px]">{t("Notes")}</span><textarea className="fld !h-16 py-1" {...f("notes")} /></label>
                  </div>
                </div>

                {sel === "new" && (
                  <button
                    className="btn w-full !py-1.5"
                    disabled={aiFilling}
                    onClick={async () => {
                      setAiFilling(true);
                      try {
                        const { leads } = await generateLeads({ count: 1 });
                        const l = leads[0];
                        setForm({
                          firstName: l.firstName, lastName: l.lastName, email: l.email, homePhone: "", mobile: l.mobile, address: l.address,
                          city: l.city, province: l.province, postal: l.postal, notes: l.notes, stage: "new", leadSource: l.leadSource,
                          interestVehicle: l.interestVehicle, budgetPrice: String(l.budgetPrice), desiredPayment: String(l.desiredPayment),
                          paymentFrequency: l.paymentFrequency, dealTypePref: l.dealTypePref, assignedTo: l.assignedTo,
                        });
                      } catch (e) {
                        alert(t((e as Error).message));
                      }
                      setAiFilling(false);
                    }}
                  >
                    {aiFilling ? t("Génération…") : `${t("Remplir par IA")}`}
                  </button>
                )}
                <div className="flex flex-wrap gap-2">
                  <button className="btn btn-primary" onClick={save} disabled={busy || (!form.firstName.trim() && !form.lastName.trim())}>{t("Enregistrer")}</button>
                  {typeof sel === "number" && (
                    <>
                      <button className="btn btn-primary" onClick={newDeal}>+ {t("Nouveau dossier")}</button>
                      <Link className="btn" href={`/quotes?customerId=${sel}`}>{t("Offre AI")}</Link>
                      <Link className="btn" href={`/credit?customerId=${sel}`}>{t("Demande de crédit")}</Link>
                      <button className="btn btn-danger ml-auto" onClick={remove}>{t("Supprimer")}</button>
                    </>
                  )}
                </div>

                {typeof sel === "number" && (
                  <>
                    <div>
                      <div className="lbl font-semibold text-[13px] mb-1">{t("Suivis")} ({fus.filter((x) => !x.done).length})</div>
                      <div className="grid grid-cols-[1fr_120px] gap-1 mb-1">
                        <input className="fld" type="datetime-local" value={nf.dueAt} onChange={(e) => setNf((x) => ({ ...x, dueAt: e.target.value }))} />
                        <select className="fld" value={nf.kind} onChange={(e) => setNf((x) => ({ ...x, kind: e.target.value }))}>
                          {Object.entries(KINDS).map(([k, v]) => <option key={k} value={k}>{t(v)}</option>)}
                        </select>
                        <input className="fld col-span-2" placeholder={t("Note (ex. rappeler pour l'essai routier)")} value={nf.notes} onChange={(e) => setNf((x) => ({ ...x, notes: e.target.value }))} />
                        <input className="fld" list="crm-staff" placeholder={t("Assigné à")} value={nf.assignedTo} onChange={(e) => setNf((x) => ({ ...x, assignedTo: e.target.value }))} />
                        <button className="btn btn-primary" onClick={addFollowUp}>+ {t("Suivi")}</button>
                      </div>
                      {fus.length === 0 ? (
                        <div className="text-[12px] text-[#003a5d]">{t("Aucun suivi.")}</div>
                      ) : (
                        <div className="space-y-1">
                          {fus.map((x) => (
                            <div key={x.id} className={`flex items-start gap-2 border border-[#ccd8e3] bg-white px-2 py-1 text-[12px] ${x.done ? "opacity-50" : ""}`}>
                              <input type="checkbox" className="mt-0.5" checked={x.done} onChange={() => toggleDone(x)} />
                              <div className="flex-1 min-w-0">
                                <div className={x.done ? "line-through" : due(x.dueAt)}>{fmtDT(x.dueAt)} · {t(KINDS[x.kind] ?? x.kind)}{x.assignedTo ? ` · ${x.assignedTo}` : ""}</div>
                                {x.notes && <div className="text-[#1e3a50]">{x.notes}</div>}
                              </div>
                              <button className="text-red-700" title={t("Retirer")} onClick={() => delFollowUp(x)}>✕</button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div>
                      <div className="lbl font-semibold text-[13px] mb-1">{t("Dossiers du client")} ({deals.length})</div>
                      {deals.length === 0 ? <div className="text-[12px] text-[#003a5d]">{t("Aucun dossier pour ce client.")}</div> : (
                        <table className="grid-table w-full text-left">
                          <tbody>
                            {deals.map((d) => (
                              <tr key={d.id} className="hover:bg-white">
                                <td><Link className="text-[#0071bc] underline font-mono text-[12px]" href={`/deals/${d.id}`}>{d.dealNumber}</Link></td>
                                <td className="max-w-[180px] truncate">{d.vehicleLabel || "—"}</td>
                                <td>{t(TYPE_LABEL[d.dealType] ?? d.dealType)}</td>
                                <td>{t(STATUS_LABEL[d.status] ?? d.status)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                    {quotes.length > 0 && (
                      <div>
                        <div className="lbl font-semibold text-[13px] mb-1">{t("Offres AI")} ({quotes.length})</div>
                        {quotes.map((x) => (
                          <div key={x.id} className="text-[12px] flex gap-2"><span className="font-mono">{x.quoteNumber || `#${x.id}`}</span><span className="flex-1 truncate">{x.summary}</span><b>{t(STATUS_LABEL[x.status] ?? x.status)}</b></div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
