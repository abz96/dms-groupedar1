"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useLang } from "@/lib/i18n";
import { useSessionUser } from "@/lib/session-context";
import type { Client } from "./ClientsManager";

interface Appt {
  id: number;
  customerId: number;
  dueAt: string;
  kind: string;
  notes: string;
  assignedTo: string;
  done: boolean;
  firstName?: string | null;
  lastName?: string | null;
  mobile?: string | null;
  email?: string | null;
  interestVehicle?: string | null;
}

const APPT_KINDS: Record<string, { label: string; color: string }> = {
  appointment: { label: "Rendez-vous", color: "#0071bc" },
  test_drive: { label: "Essai routier", color: "#6c4bd1" },
  delivery: { label: "Livraison", color: "#2e9a57" },
  call: { label: "Appel", color: "#e0a100" },
  sms: { label: "Texto", color: "#9a9a9a" },
  email: { label: "Courriel", color: "#5a7086" },
};
const DEFAULT_KINDS = ["appointment", "test_drive", "delivery"];

const startOfWeek = (d: Date) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const day = (x.getDay() + 6) % 7; // Monday = 0
  x.setDate(x.getDate() - day);
  return x;
};
const addDays = (d: Date, n: number) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};
const localInput = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);

export default function AppointmentsManager() {
  const { t, lang } = useLang();
  const me = useSessionUser();
  const loc = lang === "fr" ? "fr-CA" : "en-CA";
  const [week, setWeek] = useState(() => startOfWeek(new Date()));
  const [view, setView] = useState<"week" | "list">("week");
  const [items, setItems] = useState<Appt[]>([]);
  const [mine, setMine] = useState(false);
  const [showDone, setShowDone] = useState(false);
  const [kinds, setKinds] = useState<string[]>(DEFAULT_KINDS);
  const [clients, setClients] = useState<Client[]>([]);
  const [staff, setStaff] = useState<string[]>([]);
  const [editing, setEditing] = useState<Appt | null>(null);
  const [form, setForm] = useState(() => ({
    clientMode: "existing" as "existing" | "new",
    customerId: 0,
    firstName: "",
    lastName: "",
    mobile: "",
    email: "",
    dueAt: localInput(new Date(Math.ceil(Date.now() / 1800000) * 1800000 + 3600000)),
    kind: "appointment",
    notes: "",
    assignedTo: "",
  }));
  const [clientQ, setClientQ] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    const params = new URLSearchParams({ status: showDone ? "all" : "open", kinds: kinds.join(",") });
    if (mine) params.set("mine", "1");
    if (view === "week") {
      params.set("from", week.toISOString());
      params.set("to", addDays(week, 7).toISOString());
    }
    const r = await fetch(`/api/followups?${params}`);
    setItems(await r.json());
  }, [showDone, kinds, mine, view, week]);

  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    fetch("/api/customers").then(async (r) => setClients(await r.json()));
    fetch("/api/staff").then((r) => (r.ok ? r.json() : [])).then((l: { name: string }[]) => setStaff(l.map((x) => x.name))).catch(() => {});
  }, []);
  useEffect(() => {
    if (me?.name) setForm((f) => (f.assignedTo ? f : { ...f, assignedTo: me.name }));
  }, [me?.name]);

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(week, i)), [week]);
  const byDay = useMemo(() => {
    const m: Record<string, Appt[]> = {};
    for (const a of items) {
      const k = new Date(a.dueAt).toDateString();
      (m[k] ??= []).push(a);
    }
    return m;
  }, [items]);

  const clientList = useMemo(() => {
    const s = clientQ.toLowerCase().trim();
    return clients
      .filter((c) => !s || `${c.firstName} ${c.lastName} ${c.mobile} ${c.email}`.toLowerCase().includes(s))
      .slice(0, 50);
  }, [clients, clientQ]);

  function resetForm(date?: Date) {
    setEditing(null);
    setMsg(null);
    setForm((f) => ({
      ...f,
      clientMode: "existing",
      customerId: 0,
      firstName: "",
      lastName: "",
      mobile: "",
      email: "",
      notes: "",
      kind: "appointment",
      dueAt: localInput(date ?? new Date(Math.ceil(Date.now() / 1800000) * 1800000 + 3600000)),
    }));
  }

  function edit(a: Appt) {
    setEditing(a);
    setMsg(null);
    setForm((f) => ({
      ...f,
      clientMode: "existing",
      customerId: a.customerId,
      dueAt: localInput(new Date(a.dueAt)),
      kind: a.kind,
      notes: a.notes,
      assignedTo: a.assignedTo,
    }));
  }

  async function save() {
    setMsg(null);
    const dueAt = new Date(form.dueAt).toISOString();
    if (editing) {
      await fetch(`/api/followups/${editing.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dueAt, kind: form.kind, notes: form.notes, assignedTo: form.assignedTo }),
      });
      setMsg({ ok: true, text: `✓ ${t("Rendez-vous modifié")}` });
    } else {
      if (form.clientMode === "existing" && !form.customerId) {
        setMsg({ ok: false, text: t("Choisissez un client ou créez-en un nouveau.") });
        return;
      }
      if (form.clientMode === "new" && !form.firstName.trim() && !form.lastName.trim()) {
        setMsg({ ok: false, text: t("Entrez le nom du nouveau client.") });
        return;
      }
      const r = await fetch("/api/followups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: form.clientMode === "existing" ? form.customerId : 0,
          newCustomer: form.clientMode === "new" ? { firstName: form.firstName, lastName: form.lastName, mobile: form.mobile, email: form.email } : undefined,
          dueAt,
          kind: form.kind,
          notes: form.notes,
          assignedTo: form.assignedTo,
        }),
      });
      if (!r.ok) {
        setMsg({ ok: false, text: t((await r.json()).error ?? "Erreur") });
        return;
      }
      setMsg({ ok: true, text: `✓ ${t("Rendez-vous créé")}` });
      if (form.clientMode === "new") fetch("/api/customers").then(async (x) => setClients(await x.json()));
      // jump calendar to the appointment's week
      setWeek(startOfWeek(new Date(form.dueAt)));
      resetForm(new Date(form.dueAt));
      setMsg({ ok: true, text: `✓ ${t("Rendez-vous créé")}` });
    }
    await load();
  }

  async function toggleDone(a: Appt) {
    await fetch(`/api/followups/${a.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ done: !a.done }) });
    await load();
  }
  async function remove(a: Appt) {
    if (!confirm(t("Supprimer ce rendez-vous ?"))) return;
    await fetch(`/api/followups/${a.id}`, { method: "DELETE" });
    if (editing?.id === a.id) resetForm();
    await load();
  }

  const name = (a: Appt) => `${a.firstName ?? ""} ${a.lastName ?? ""}`.trim() || "—";
  const time = (d: string) => new Date(d).toLocaleTimeString(loc, { hour: "2-digit", minute: "2-digit" });
  const now = Date.now();
  const todayKey = new Date().toDateString();
  const upcomingToday = items.filter((a) => new Date(a.dueAt).toDateString() === todayKey && !a.done).length;

  const Card = ({ a, compact }: { a: Appt; compact?: boolean }) => {
    const k = APPT_KINDS[a.kind] ?? APPT_KINDS.appointment;
    const late = !a.done && new Date(a.dueAt).getTime() < now;
    return (
      <div
        className={`border-l-4 bg-white border border-[#d5e0e9] px-2 py-1 text-[12px] cursor-pointer hover:shadow ${a.done ? "opacity-50" : ""} ${editing?.id === a.id ? "ring-2 ring-[#0071bc]" : ""}`}
        style={{ borderLeftColor: k.color }}
        onClick={() => edit(a)}
      >
        <div className="flex items-center gap-1">
          <b className={late ? "text-red-700" : "text-[#00263d]"}>{time(a.dueAt)}</b>
          <span className="text-[10px] px-1 text-white rounded-sm" style={{ background: k.color }}>{t(k.label)}</span>
          <input
            type="checkbox"
            className="ml-auto"
            checked={a.done}
            title={t("Terminé")}
            onClick={(e) => e.stopPropagation()}
            onChange={() => toggleDone(a)}
          />
        </div>
        <div className={`font-semibold truncate ${a.done ? "line-through" : ""}`}>{name(a)}</div>
        {!compact && a.mobile && <div className="text-[#5a7086]">{a.mobile}</div>}
        {a.notes && <div className="text-[#1e3a50] truncate" title={a.notes}>{a.notes}</div>}
        {!compact && a.assignedTo && <div className="text-[10px] text-[#5a7086]">{a.assignedTo}</div>}
      </div>
    );
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_380px] gap-4 items-start">
      <div className="win">
        <div className="win-title flex items-center px-3 h-9 gap-2">
          <span>{t("Tous les rendez-vous")}</span>
          <span className="ml-auto text-xs text-[#cfe3f2]">{t("Aujourd'hui")} : {upcomingToday}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2 p-2 border-b border-[#bfcfdc]">
          <div className="flex">
            <button className={`tabbtn !border-b ${view === "week" ? "active" : ""}`} onClick={() => setView("week")}>{t("Semaine")}</button>
            <button className={`tabbtn !border-b ${view === "list" ? "active" : ""}`} onClick={() => setView("list")}>{t("Liste (à venir)")}</button>
          </div>
          {view === "week" && (
            <>
              <button className="btn" onClick={() => setWeek((w) => addDays(w, -7))}>‹</button>
              <button className="btn" onClick={() => setWeek(startOfWeek(new Date()))}>{t("Cette semaine")}</button>
              <button className="btn" onClick={() => setWeek((w) => addDays(w, 7))}>›</button>
              <span className="text-[13px] font-semibold text-[#00263d]">
                {week.toLocaleDateString(loc, { day: "numeric", month: "short" })} – {addDays(week, 6).toLocaleDateString(loc, { day: "numeric", month: "short", year: "numeric" })}
              </span>
            </>
          )}
          <div className="ml-auto flex flex-wrap items-center gap-3 text-[12px] text-[#1e3a50]">
            {Object.entries(APPT_KINDS).map(([k, v]) => (
              <label key={k} className="flex items-center gap-1">
                <input type="checkbox" checked={kinds.includes(k)} onChange={(e) => setKinds((l) => (e.target.checked ? [...l, k] : l.filter((x) => x !== k)))} />
                <span className="inline-block w-2.5 h-2.5" style={{ background: v.color }} />
                {t(v.label)}
              </label>
            ))}
            <label className="flex items-center gap-1"><input type="checkbox" checked={mine} onChange={(e) => setMine(e.target.checked)} /> {t("Mes rendez-vous")}</label>
            <label className="flex items-center gap-1"><input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} /> {t("Afficher terminés")}</label>
          </div>
        </div>

        {view === "week" ? (
          <div className="grid grid-cols-1 md:grid-cols-7 gap-px bg-[#c7d5e1]">
            {days.map((d) => {
              const k = d.toDateString();
              const list = byDay[k] ?? [];
              const isToday = k === todayKey;
              return (
                <div key={k} className={`min-h-[420px] p-1.5 ${isToday ? "bg-[#e8f3fb]" : "bg-[#f6f9fc]"}`}>
                  <div className="flex items-center justify-between mb-1">
                    <div className={`text-[12px] font-semibold capitalize ${isToday ? "text-[#0071bc]" : "text-[#00263d]"}`}>
                      {d.toLocaleDateString(loc, { weekday: "short" })} <span className="text-[16px]">{d.getDate()}</span>
                    </div>
                    <button
                      className="text-[#0071bc] text-[16px] leading-none hover:scale-110"
                      title={t("Nouveau rendez-vous")}
                      onClick={() => {
                        const x = new Date(d);
                        x.setHours(10, 0, 0, 0);
                        resetForm(x);
                      }}
                    >
                      +
                    </button>
                  </div>
                  <div className="space-y-1">
                    {list.map((a) => <Card key={a.id} a={a} compact />)}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <table className="grid-table w-full text-left">
            <thead>
              <tr>
                <th className="w-[36px]" />
                <th>{t("Date")}</th>
                <th>{t("Type")}</th>
                <th>{t("Client")}</th>
                <th>{t("Cellulaire")}</th>
                <th>{t("Véhicule recherché")}</th>
                <th>{t("Notes")}</th>
                <th>{t("Assigné à")}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && <tr><td colSpan={9} className="text-center py-8 text-[#003a5d]">{t("Aucun rendez-vous.")}</td></tr>}
              {items.map((a) => {
                const k = APPT_KINDS[a.kind] ?? APPT_KINDS.appointment;
                const late = !a.done && new Date(a.dueAt).getTime() < now;
                return (
                  <tr key={a.id} className={`hover:bg-white cursor-pointer ${a.done ? "opacity-50" : ""}`} onClick={() => edit(a)}>
                    <td className="text-center" onClick={(e) => e.stopPropagation()}><input type="checkbox" checked={a.done} onChange={() => toggleDone(a)} /></td>
                    <td className={late ? "text-red-700 font-semibold" : ""}>{new Date(a.dueAt).toLocaleString(loc, { weekday: "short", dateStyle: undefined, day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</td>
                    <td><span className="text-[11px] px-1.5 py-0.5 text-white" style={{ background: k.color }}>{t(k.label)}</span></td>
                    <td className="font-semibold">{name(a)}</td>
                    <td>{a.mobile || "—"}</td>
                    <td className="max-w-[180px] truncate">{a.interestVehicle || "—"}</td>
                    <td className="max-w-[240px] truncate">{a.notes}</td>
                    <td>{a.assignedTo}</td>
                    <td onClick={(e) => e.stopPropagation()}><button className="text-red-700" onClick={() => remove(a)}>✕</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* create / edit */}
      <div className="win xl:sticky xl:top-[72px]">
        <div className="win-title flex items-center px-3 h-9">
          <span>{editing ? t("Modifier le rendez-vous") : t("Nouveau rendez-vous")}</span>
          {editing && <button className="ml-auto text-xs text-[#cfe3f2] underline" onClick={() => resetForm()}>+ {t("Nouveau")}</button>}
        </div>
        <div className="p-3 space-y-2">
          {editing ? (
            <div className="border border-[#c7d5e1] bg-white p-2 text-[13px]">
              <div className="font-semibold text-[#00263d]">{name(editing)}</div>
              {editing.mobile && <div className="text-[#5a7086]">{editing.mobile}</div>}
              {editing.interestVehicle && <div className="text-[#5a7086]">{editing.interestVehicle}</div>}
              <Link className="text-[12px] text-[#0071bc] underline" href="/crm">{t("Ouvrir dans le CRM")}</Link>
            </div>
          ) : (
            <>
              <div className="flex">
                <button className={`tabbtn !border-b flex-1 ${form.clientMode === "existing" ? "active" : ""}`} onClick={() => setForm((f) => ({ ...f, clientMode: "existing" }))}>{t("Client existant")}</button>
                <button className={`tabbtn !border-b flex-1 ${form.clientMode === "new" ? "active" : ""}`} onClick={() => setForm((f) => ({ ...f, clientMode: "new" }))}>{t("Nouveau client")}</button>
              </div>
              {form.clientMode === "existing" ? (
                <div className="space-y-1">
                  <input className="fld" placeholder={t("Nom, téléphone, courriel, ville…")} value={clientQ} onChange={(e) => setClientQ(e.target.value)} />
                  <select className="fld !h-auto py-1" size={5} value={form.customerId || ""} onChange={(e) => setForm((f) => ({ ...f, customerId: Number(e.target.value) }))}>
                    {clientList.map((c) => (
                      <option key={c.id} value={c.id}>{`${c.firstName} ${c.lastName}`.trim()}{c.mobile ? ` — ${c.mobile}` : ""}</option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <label><span className="lbl text-[12px]">{t("Prénom")}</span><input className="fld" value={form.firstName} onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))} /></label>
                  <label><span className="lbl text-[12px]">{t("Nom")}</span><input className="fld" value={form.lastName} onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))} /></label>
                  <label><span className="lbl text-[12px]">{t("Cellulaire")}</span><input className="fld" value={form.mobile} onChange={(e) => setForm((f) => ({ ...f, mobile: e.target.value }))} /></label>
                  <label><span className="lbl text-[12px]">{t("Courriel")}</span><input className="fld" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} /></label>
                </div>
              )}
            </>
          )}
          <div className="grid grid-cols-2 gap-2">
            <label className="col-span-2"><span className="lbl text-[12px]">{t("Date et heure")}</span><input className="fld" type="datetime-local" value={form.dueAt} onChange={(e) => setForm((f) => ({ ...f, dueAt: e.target.value }))} /></label>
            <label>
              <span className="lbl text-[12px]">{t("Type")}</span>
              <select className="fld" value={form.kind} onChange={(e) => setForm((f) => ({ ...f, kind: e.target.value }))}>
                {Object.entries(APPT_KINDS).map(([k, v]) => <option key={k} value={k}>{t(v.label)}</option>)}
              </select>
            </label>
            <label>
              <span className="lbl text-[12px]">{t("Assigné à")}</span>
              <input className="fld" list="appt-staff" value={form.assignedTo} onChange={(e) => setForm((f) => ({ ...f, assignedTo: e.target.value }))} />
              <datalist id="appt-staff">{[...(me?.name ? [me.name] : []), ...staff].filter((v, i, a) => a.indexOf(v) === i).map((n) => <option key={n} value={n} />)}</datalist>
            </label>
            <label className="col-span-2"><span className="lbl text-[12px]">{t("Notes")}</span><textarea className="fld !h-20 py-1" placeholder={t("ex. Essai routier Audi Q5, apporter permis")} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} /></label>
          </div>
          {msg && <div className={`text-[13px] px-2 py-1 border ${msg.ok ? "text-green-800 bg-green-50 border-green-200" : "text-red-700 bg-red-50 border-red-200"}`}>{msg.text}</div>}
          <div className="flex gap-2">
            <button className="btn btn-primary !px-5" onClick={save}>{editing ? t("Enregistrer") : t("Créer le rendez-vous")}</button>
            {editing && (
              <>
                <button className="btn" onClick={() => toggleDone(editing)}>{editing.done ? t("Rouvrir") : `✓ ${t("Terminé")}`}</button>
                <button className="btn btn-danger ml-auto" onClick={() => remove(editing)}>{t("Supprimer")}</button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
