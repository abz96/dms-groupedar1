"use client";

import { useT } from "@/lib/i18n";
import type { DeskProps } from "./DealDesk";
import { F, SecHead, TextField } from "./fields";
import StaffSelect from "./StaffSelect";
import type { DealData } from "@/lib/deal";
import { fmtDesk, PROVINCES, purchasedItems } from "@/lib/deal";

export default function ClientTab({ data, upd }: DeskProps) {
  const t = useT();
  const c = (k: Exclude<keyof DealData["customer"], "id">) => (v: string) => upd((d) => void (d.customer[k] = v));
  const purchased = purchasedItems(data);
  const v = (k: keyof DealData["vehicle"]) => (s: string) => upd((d) => void (d.vehicle[k] = s));

  return (
    <div className="win">
      <div className="win-title h-7 text-right pr-4 text-[15px] leading-7">{t("Client / Véhicule")}</div>
      <SecHead title={t("Client")} />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 p-3">
        <F label={t("Prénom")}><TextField value={data.customer.firstName} onChange={c("firstName")} /></F>
        <F label={t("Nom")}><TextField value={data.customer.lastName} onChange={c("lastName")} /></F>
        <F label={t("Adresse")} wide><TextField value={data.customer.address} onChange={c("address")} /></F>
        <F label={t("Ville")}><TextField value={data.customer.city} onChange={c("city")} /></F>
        <F label={t("Province")}>
          <select className="fld" value={data.customer.province} onChange={(e) => c("province")(e.target.value)}>
            {PROVINCES.map((p) => <option key={p.code} value={p.code}>{p.code} – {p.name}</option>)}
          </select>
        </F>
        <F label={t("Code postal")}><TextField value={data.customer.postal} onChange={(s) => c("postal")(s.toUpperCase())} /></F>
        <F label={t("Courriel")}><TextField value={data.customer.email} onChange={c("email")} /></F>
        <F label={t("Tél. maison")}><TextField value={data.customer.homePhone} onChange={c("homePhone")} /></F>
        <F label={t("Cellulaire")}><TextField value={data.customer.mobile} onChange={c("mobile")} /></F>
        <F label={t("Co-acheteur")}><TextField value={data.customer.coBuyer} onChange={c("coBuyer")} /></F>
        <F label={t("Vendeur")}><StaffSelect value={data.salesperson} onChange={(v) => upd((d) => void (d.salesperson = v))} /></F>
        <F label={t("Directeur F&A")}><StaffSelect value={data.fiManager} prefer={["Finance", "Direction"]} onChange={(v) => upd((d) => void (d.fiManager = v))} /></F>
      </div>

      <SecHead title={t("Véhicule")} />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 p-3">
        <F label={t("Année")}><TextField value={data.vehicle.year} onChange={v("year")} /></F>
        <F label={t("Marque")}><TextField value={data.vehicle.make} onChange={v("make")} /></F>
        <F label={t("Modèle")}><TextField value={data.vehicle.model} onChange={v("model")} /></F>
        <F label={t("Version / Couleur")}><TextField value={data.vehicle.trim} onChange={v("trim")} /></F>
        <F label={t("# Stock")}><TextField value={data.vehicle.stock} onChange={v("stock")} /></F>
        <F label={t("NIV / VIN")}><TextField value={data.vehicle.vin} onChange={(s) => v("vin")(s.toUpperCase())} /></F>
        <F label={t("Couleur ext.")}><TextField value={data.vehicle.extColor} onChange={v("extColor")} /></F>
        <F label={t("Couleur int.")}><TextField value={data.vehicle.intColor} onChange={v("intColor")} /></F>
        <F label={t("Kilométrage")}><TextField value={data.vehicle.kms} onChange={v("kms")} /></F>
        <F label={t("Garantie")}><TextField value={data.vehicle.warranty} onChange={v("warranty")} placeholder={t("4 ans / 80 000 km")} /></F>
        <F label={t("Mise en service")}><TextField type="date" value={data.vehicle.inServiceDate} onChange={v("inServiceDate")} /></F>
        <F label={t("Carrosserie")}><TextField value={data.vehicle.bodyStyle} onChange={v("bodyStyle")} placeholder={t("SUV")} /></F>
        <F label={t("Transmission")}><TextField value={data.vehicle.transmission} onChange={v("transmission")} /></F>
        <F label={t("Statut spécial")}><TextField value={data.vehicle.spStatus} onChange={v("spStatus")} /></F>
        <label className="md:col-span-2 flex flex-col gap-1">
          <span className="lbl">{t("Description / Options (imprimée sur la feuille)")}</span>
          <textarea className="fld !h-20 py-1" value={data.vehicle.description} onChange={(e) => v("description")(e.target.value)} />
        </label>
        {purchased.length > 0 && (
          <div className="md:col-span-2 border border-[#9fb3c4] bg-[#e6f1fa] px-2 py-1.5">
            <div className="lbl text-[12px] font-semibold mb-0.5">{t("Achats du client (ajoutés automatiquement à la description et à la feuille imprimée)")}</div>
            <ul className="text-[12px] text-[#1e3a50] space-y-0.5">
              {purchased.map((x, i) => (
                <li key={i} className="flex justify-between max-w-[520px]">
                  <span>• {t(x.name)}{x.detail ? ` — ${x.detail} ${Number(x.detail) > 1 ? t("ans") : t("an")}` : ""}</span>
                  <span className="tabular-nums font-semibold">{fmtDesk(x.price)} $</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <SecHead title={t("Commentaires, promesses et conditions")} />
      <div className="p-3">
        <textarea className="fld !h-24 py-1" value={data.comments} onChange={(e) => upd((d) => void (d.comments = e.target.value))} />
      </div>
    </div>
  );
}
