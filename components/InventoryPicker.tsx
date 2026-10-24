"use client";

import { useT } from "@/lib/i18n";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { fmtDesk } from "@/lib/deal";
import type { InventoryVehicle } from "@/lib/inventory";

type Row = InventoryVehicle & { id: number; status: string };

export default function InventoryPicker({ onPick, onClose }: { onPick: (v: Row) => void; onClose: () => void }) {
  const t = useT();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [q, setQ] = useState("");

  useEffect(() => {
    fetch("/api/inventory").then(async (r) => setRows(await r.json()));
  }, []);

  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);

  const list = useMemo(() => {
    const s = q.toLowerCase();
    return (rows ?? []).filter(
      (r) => r.status !== "sold" && r.status !== "employee" && (!s || `${r.year} ${r.make} ${r.model} ${r.trim} ${r.stock} ${r.extColor}`.toLowerCase().includes(s)),
    );
  }, [rows, q]);

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center pt-16 px-4" onClick={onClose}>
      <div className="win w-full max-w-[1000px]" onClick={(e) => e.stopPropagation()}>
        <div className="win-title flex items-center h-9 px-3">
          <span>{t("Sélection de véhicule — Inventaire")}</span>
          <button className="ml-auto text-white/80 hover:text-white" onClick={onClose}>✕</button>
        </div>
        <div className="flex items-center gap-2 p-2 border-b border-[#bccbd8]">
          <span className="lbl">{t("Recherche")}</span>
          <input autoFocus className="fld" placeholder={t("# stock, marque, modèle, couleur…")} value={q} onChange={(e) => setQ(e.target.value)} />
          <Link href="/inventory" className="btn whitespace-nowrap" target="_blank">{t("+ Importer (Inventaire)")}</Link>
        </div>
        <div className="max-h-[60vh] overflow-auto">
          <table className="grid-table w-full text-left">
            <thead className="sticky top-0">
              <tr>
                <th>{t("# Stock")}</th>
                <th>{t("Année")}</th>
                <th>{t("Marque")}</th>
                <th>{t("Modèle")}</th>
                <th>{t("Version")}</th>
                <th className="text-right">{t("Km")}</th>
                <th>{t("Couleur")}</th>
                <th className="text-right">{t("Prix")}</th>
              </tr>
            </thead>
            <tbody>
              {rows === null && (
                <tr><td colSpan={8} className="text-center py-6 text-[#003a5d]">{t("Chargement…")}</td></tr>
              )}
              {rows !== null && list.length === 0 && (
                <tr><td colSpan={8} className="text-center py-6 text-[#003a5d]">{t("Aucun véhicule disponible.")}</td></tr>
              )}
              {list.map((r) => (
                <tr key={r.id} className="cursor-pointer hover:bg-[#0071bc] hover:text-white" onClick={() => onPick(r)}>
                  <td className="font-mono font-semibold">{r.stock || "—"}</td>
                  <td>{r.year}</td>
                  <td>{r.make}</td>
                  <td>{r.model}</td>
                  <td>{r.trim}</td>
                  <td className="text-right tabular-nums">{Math.round(r.kms).toLocaleString("en-CA")}</td>
                  <td>{r.extColor}</td>
                  <td className="text-right tabular-nums font-semibold">{fmtDesk(r.price)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
