"use client";

import { useCallback, useEffect, useState } from "react";
import { useLang } from "@/lib/i18n";
import { useSessionUser } from "@/lib/session-context";
import { fmtDesk } from "@/lib/deal";
import { DEPARTMENTS, ROLES } from "@/lib/staff-roles";

interface Staff {
  id: number;
  name: string;
  username: string;
  position: string;
  department: string;
  role: string;
  stats?: { deals: number; quotes: number; appointments: number; gross: number };
  email: string;
  phone: string;
  active: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

const POSITIONS = [
  "Conseiller en location",
  "Directrice financière",
  "Évaluateur",
  "Directeur du service",
  "Conseillère technique",
  "Directeur de l'inventaire",
  "Technicien",
  "Carrossier",
  "Esthéticien",
  "Secrétaire",
  "Directeur général",
  "Directeur des ventes",
  "Directeur commercial",
  "Directeur F&A",
  "Conseiller aux ventes",
  "Directeur des opérations",
  "Réceptionniste",
  "Comptabilité",
  "Administrateur",
];

const EMPTY = { name: "", username: "", password: "", position: "Conseiller aux ventes", department: "Ventes", role: "sales", email: "", phone: "", active: true };
const initials = (n: string) => n.split(/[\s-]+/).filter(Boolean).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
const DEPT_COLOR: Record<string, string> = {
  Direction: "#0071bc", Ventes: "#2f7fd1", Finance: "#2e9a57", Service: "#5a7086", Inventaire: "#8e44ad",
  Carrosserie: "#a0522d", Esthétique: "#16a085", Administration: "#c0392b",
};
type Form = typeof EMPTY;

export default function StaffManager() {
  const { t, lang } = useLang();
  const me = useSessionUser();
  const [list, setList] = useState<Staff[] | null>(null);
  const [sel, setSel] = useState<number | "new" | null>(null);
  const [form, setForm] = useState<Form>(EMPTY);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const loc = lang === "fr" ? "fr-CA" : "en-CA";

  const reload = useCallback(async () => {
    const r = await fetch("/api/staff");
    if (r.ok) setList(await r.json());
  }, []);
  useEffect(() => {
    void reload();
  }, [reload]);

  function open(s: Staff) {
    setSel(s.id);
    setMsg(null);
    setForm({ name: s.name, username: s.username, password: "", position: s.position, department: s.department ?? "", role: s.role, email: s.email, phone: s.phone, active: s.active });
  }
  function newStaff() {
    setSel("new");
    setMsg(null);
    setForm(EMPTY);
  }

  async function save() {
    setBusy(true);
    setMsg(null);
    const isNew = sel === "new";
    const r = await fetch(isNew ? "/api/staff" : `/api/staff/${sel}`, {
      method: isNew ? "POST" : "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const j = await r.json();
    setBusy(false);
    if (!r.ok) {
      setMsg({ ok: false, text: t(j.error ?? "Erreur") });
      return;
    }
    await reload();
    setSel(j.id);
    setForm((f) => ({ ...f, password: "" }));
    setMsg({ ok: true, text: isNew ? t("Employé créé — il peut maintenant se connecter.") : `✓ ${t("Sauvegardé")}` });
  }

  async function remove() {
    if (typeof sel !== "number" || !confirm(t("Supprimer cet employé et son accès ?"))) return;
    const r = await fetch(`/api/staff/${sel}`, { method: "DELETE" });
    if (!r.ok) {
      setMsg({ ok: false, text: t((await r.json()).error ?? "Erreur") });
      return;
    }
    setSel(null);
    await reload();
  }

  const f = <K extends keyof Form>(k: K) => ({
    value: form[k] as string,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm((x) => ({ ...x, [k]: e.target.value })),
  });

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_440px] gap-4 items-start">
      <div className="win">
        <div className="win-title flex items-center px-3 h-9">
          <span>{t("Personnel")}</span>
          <span className="ml-auto text-xs text-[#cfe3f2]">{list?.length ?? 0} {t("employé(s)")}</span>
        </div>
        <div className="flex flex-wrap items-center gap-3 p-3 border-b border-[#bccbd8]">
          <button className="btn btn-primary" onClick={newStaff}>+ {t("Nouvel employé")}</button>
          <span className="text-[11px] text-[#003a5d] ml-auto">
            {t("Mot de passe initial des employés")} : <b className="font-mono">9296</b> — {t("à changer pour chaque employé")}
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="grid-table w-full text-left">
            <thead>
              <tr>
                <th>{t("Employé")}</th>
                <th>{t("Poste")}</th>
                <th>{t("Département")}</th>
                <th>{t("Rôle / Permissions")}</th>
                <th className="text-right">{t("Dossiers")}</th>
                <th className="text-right">{t("Offres")}</th>
                <th className="text-right">{t("Rendez-vous")}</th>
                <th className="text-right">{t("Profit brut total")}</th>
              </tr>
            </thead>
            <tbody>
              {list === null && (
                <tr><td colSpan={8} className="text-center py-8 text-[#003a5d]">{t("Chargement…")}</td></tr>
              )}
              {list !== null && list.length === 0 && (
                <tr><td colSpan={8} className="text-center py-8 text-[#003a5d]">{t("Aucun employé. Cliquez « + Nouvel employé » pour créer un accès.")}</td></tr>
              )}
              {list?.map((s) => (
                <tr key={s.id} className={`cursor-pointer ${sel === s.id ? "bg-[#d4e8f7]" : "hover:bg-white"} ${s.active ? "" : "opacity-60"}`} onClick={() => open(s)}>
                  <td>
                    <div className="flex items-center gap-2">
                      <span
                        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white text-[12px] font-bold"
                        style={{ background: DEPT_COLOR[s.department] ?? "#555" }}
                      >
                        {initials(s.name)}
                      </span>
                      <div className="min-w-0">
                        <div className="font-semibold truncate">{s.name}</div>
                        <div className="text-[11px] text-[#5a7086] font-mono">{s.username}{!s.active ? ` · ${t("Inactif")}` : ""}</div>
                      </div>
                    </div>
                  </td>
                  <td>{t(s.position) || "—"}</td>
                  <td>
                    <span className="inline-flex items-center gap-1">
                      <span className="inline-block w-2 h-2 rounded-full" style={{ background: DEPT_COLOR[s.department] ?? "#999" }} />
                      {t(s.department) || "—"}
                    </span>
                  </td>
                  <td>
                    <div className="text-[12px]">{t(ROLES[s.role]?.label ?? s.role)}</div>
                    {ROLES[s.role]?.full && <span className="text-[10px] font-bold px-1.5 py-0.5 bg-[#0071bc] text-white rounded-sm">{t("ACCÈS COMPLET")}</span>}
                  </td>
                  <td className="text-right tabular-nums">{s.stats?.deals ?? 0}</td>
                  <td className="text-right tabular-nums">{s.stats?.quotes ?? 0}</td>
                  <td className="text-right tabular-nums">{s.stats?.appointments ?? 0}</td>
                  <td className="text-right tabular-nums font-semibold">{fmtDesk(s.stats?.gross ?? 0)} $</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="win xl:sticky xl:top-[72px]">
        <div className="win-title flex items-center px-3 h-9">
          <span>{sel === "new" ? t("Nouvel employé") : sel ? form.name || t("Employé") : t("Fiche employé")}</span>
        </div>
        {sel === null ? (
          <div className="p-6 text-center text-[13px] text-[#003a5d]">{t("Sélectionnez un employé ou créez-en un nouveau.")}</div>
        ) : (
          <div className="p-3 space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <label className="col-span-2"><span className="lbl text-[12px]">{t("Nom complet")}</span><input className="fld" {...f("name")} /></label>
              <label className="col-span-2">
                <span className="lbl text-[12px]">{t("Poste")}</span>
                <input className="fld" list="positions" {...f("position")} />
                <datalist id="positions">
                  {POSITIONS.map((p) => <option key={p} value={p}>{t(p)}</option>)}
                </datalist>
              </label>
              <label className="col-span-2">
                <span className="lbl text-[12px]">{t("Département")}</span>
                <select className="fld" {...f("department")}>
                  <option value="">—</option>
                  {DEPARTMENTS.map((d) => <option key={d} value={d}>{t(d)}</option>)}
                </select>
              </label>
              <label><span className="lbl text-[12px]">{t("Courriel")}</span><input className="fld" type="email" {...f("email")} /></label>
              <label><span className="lbl text-[12px]">{t("Téléphone")}</span><input className="fld" {...f("phone")} /></label>
            </div>

            <div className="border border-[#a9bccb] bg-[#f2f6f9] p-2 space-y-2">
              <div className="lbl font-semibold text-[13px]">{t("Accès / Connexion")}</div>
              <div className="grid grid-cols-2 gap-2">
                <label>
                  <span className="lbl text-[12px]">{t("Nom d'utilisateur")}</span>
                  <input className="fld font-mono" autoComplete="off" value={form.username} onChange={(e) => setForm((x) => ({ ...x, username: e.target.value.toLowerCase().replace(/\s/g, "") }))} />
                </label>
                <label>
                  <span className="lbl text-[12px]">{sel === "new" ? t("Mot de passe") : t("Nouveau mot de passe")}</span>
                  <div className="flex gap-1">
                    <input
                      className="fld"
                      type={showPw ? "text" : "password"}
                      autoComplete="new-password"
                      placeholder={sel === "new" ? "" : t("(inchangé)")}
                      {...f("password")}
                    />
                    <button type="button" className="dots" title={t("Afficher")} onClick={() => setShowPw((v) => !v)}>•••</button>
                  </div>
                </label>
                <label>
                  <span className="lbl text-[12px]">{t("Rôle / Permissions")}</span>
                  <select className="fld" {...f("role")}>
                    {Object.entries(ROLES).map(([k, v]) => (
                      <option key={k} value={k}>{t(v.label)}{v.full ? ` — ${t("ACCÈS COMPLET")}` : ""}</option>
                    ))}
                  </select>
                </label>
                <label className="flex items-end gap-2 pb-1 text-[13px] text-[#1e3a50]">
                  <input type="checkbox" checked={form.active} onChange={(e) => setForm((x) => ({ ...x, active: e.target.checked }))} />
                  {t("Compte actif (peut se connecter)")}
                </label>
              </div>
              <div className="text-[11px] text-[#5a7086]">{t("Super Admin / Propriétaire, Administrateur et Directeur des ventes ont l'accès complet (personnel, approbation des offres). Les autres rôles ont accès aux dossiers, CRM, rendez-vous, inventaire et prêteurs.")}</div>
            </div>

            {msg && <div className={`text-[13px] px-2 py-1 border ${msg.ok ? "text-green-800 bg-green-50 border-green-200" : "text-red-700 bg-red-50 border-red-200"}`}>{msg.text}</div>}

            <div className="flex gap-2">
              <button
                className="btn btn-primary"
                onClick={save}
                disabled={busy || !form.name.trim() || !form.username.trim() || (sel === "new" && form.password.length < 4)}
              >
                {sel === "new" ? t("Créer l'accès") : t("Enregistrer")}
              </button>
              {typeof sel === "number" && <button className="btn btn-danger ml-auto" onClick={remove}>{t("Supprimer")}</button>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
