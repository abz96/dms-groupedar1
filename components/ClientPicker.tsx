"use client";

import { useEffect, useMemo, useState } from "react";
import { useT } from "@/lib/i18n";
import type { Client } from "./ClientsManager";

export default function ClientPicker({ onPick, onClose }: { onPick: (c: Client) => void; onClose: () => void }) {
  const t = useT();
  const [rows, setRows] = useState<Client[] | null>(null);
  const [q, setQ] = useState("");

  useEffect(() => {
    fetch("/api/customers").then(async (r) => setRows(await r.json()));
  }, []);
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);

  const list = useMemo(() => {
    const s = q.toLowerCase().trim();
    const digits = s.replace(/\D/g, "");
    return (rows ?? []).filter(
      (c) =>
        !s ||
        `${c.firstName} ${c.lastName} ${c.email} ${c.city}`.toLowerCase().includes(s) ||
        (digits.length >= 3 && `${c.mobile} ${c.homePhone}`.replace(/\D/g, "").includes(digits)),
    );
  }, [rows, q]);

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center pt-16 px-4" onClick={onClose}>
      <div className="win w-full max-w-[860px]" onClick={(e) => e.stopPropagation()}>
        <div className="win-title flex items-center h-9 px-3">
          <span>{t("Choisir un client existant")}</span>
          <button className="ml-auto text-white/80 hover:text-white" onClick={onClose}>✕</button>
        </div>
        <div className="flex items-center gap-2 p-2 border-b border-[#bccbd8]">
          <span className="lbl">{t("Recherche")}</span>
          <input autoFocus className="fld" placeholder={t("Nom, téléphone, courriel, ville…")} value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="max-h-[60vh] overflow-auto">
          <table className="grid-table w-full text-left">
            <thead className="sticky top-0">
              <tr>
                <th>{t("Nom")}</th>
                <th>{t("Cellulaire")}</th>
                <th>{t("Courriel")}</th>
                <th>{t("Ville")}</th>
              </tr>
            </thead>
            <tbody>
              {rows === null && <tr><td colSpan={4} className="text-center py-6 text-[#003a5d]">{t("Chargement…")}</td></tr>}
              {rows !== null && list.length === 0 && <tr><td colSpan={4} className="text-center py-6 text-[#003a5d]">{t("Aucun client.")}</td></tr>}
              {list.map((c) => (
                <tr key={c.id} className="cursor-pointer hover:bg-[#0071bc] hover:text-white" onClick={() => onPick(c)}>
                  <td className="font-semibold">{`${c.firstName} ${c.lastName}`.trim()}</td>
                  <td>{c.mobile || c.homePhone || "—"}</td>
                  <td>{c.email || "—"}</td>
                  <td>{c.city || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
