import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { deals, inventory } from "@/db/schema";
import { normalizeDeal } from "@/lib/deal";
import { ensureSchema, getSettings } from "@/lib/server";
import {
  coverageStatus,
  normalizeVin,
  oemWarrantyFor,
  vinCheckDigitValid,
  vinFormatError,
  vinMakeFallback,
  vinModelYear,
} from "@/lib/warranty-check";

export const dynamic = "force-dynamic";

type Decoded = { make: string; model: string; year: number | null; trim: string; body: string; engine: string; fuel: string; drive: string; plant: string; source: "nhtsa" | "local" };

async function decode(vin: string): Promise<Decoded> {
  const local: Decoded = { make: vinMakeFallback(vin) ?? "", model: "", year: vinModelYear(vin), trim: "", body: "", engine: "", fuel: "", drive: "", plant: "", source: "local" };
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8000);
    const r = await fetch(`https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/${vin}?format=json`, { signal: ctrl.signal, cache: "no-store" });
    clearTimeout(t);
    const j = (await r.json()) as { Results?: Record<string, string>[] };
    const x = j.Results?.[0];
    if (!x || (!x.Make && !x.ModelYear)) return local;
    const engine = [x.DisplacementL ? `${Number(x.DisplacementL).toFixed(1)} L` : "", x.EngineCylinders ? `${x.EngineCylinders} cyl.` : "", x.ElectrificationLevel || ""]
      .filter(Boolean)
      .join(" · ");
    return {
      make: (x.Make || local.make).toUpperCase(),
      model: x.Model || "",
      year: Number(x.ModelYear) || local.year,
      trim: [x.Trim, x.Series].filter(Boolean).join(" "),
      body: x.BodyClass || "",
      engine,
      fuel: x.FuelTypePrimary || "",
      drive: x.DriveType || "",
      plant: [x.PlantCity, x.PlantCountry].filter(Boolean).join(", "),
      source: "nhtsa",
    };
  } catch {
    return local;
  }
}

export async function GET(req: Request) {
  await ensureSchema();
  const u = new URL(req.url).searchParams;
  const vin = normalizeVin(u.get("vin") ?? "");
  const err = vinFormatError(vin);
  if (err) return Response.json({ error: err }, { status: 400 });

  const [dec, s] = await Promise.all([decode(vin), getSettings()]);

  /* ----- our database: inventory + deals (sold vehicle or trade-in) ----- */
  const inv = await db.select().from(inventory).where(sql`upper(${inventory.vin}) = ${vin}`).limit(1);
  const dealRows = await db
    .select({ id: deals.id, dealNumber: deals.dealNumber, status: deals.status, data: deals.data, createdAt: deals.createdAt, updatedAt: deals.updatedAt })
    .from(deals)
    .where(sql`upper(${deals.data}->'vehicle'->>'vin') = ${vin} OR upper(${deals.data}->'trade'->>'vin') = ${vin}`)
    .orderBy(desc(deals.updatedAt));

  const planCodes = new Map((s.protectionPlans ?? []).map((p) => [p.code, p]));
  const planNames = (s.protectionPlans ?? []).map((p) => p.name.toLowerCase());
  const now = new Date();
  const registered: {
    dealId: number;
    dealNumber: string;
    dealStatus: string;
    customer: string;
    name: string;
    code: string | null;
    kind: string;
    term: number | null;
    price: number;
    purchased: string;
    expiresOn: string | null;
    active: boolean | null;
  }[] = [];
  let dbKm: number | null = null;
  let inServiceFromDb: string | null = null;
  const history: { dealId: number; dealNumber: string; role: "vehicle" | "trade"; customer: string; status: string; date: string }[] = [];

  for (const r of dealRows) {
    const d = normalizeDeal(r.data);
    const isVehicle = d.vehicle.vin.toUpperCase() === vin;
    const customer = `${d.customer.firstName} ${d.customer.lastName}`.trim();
    history.push({ dealId: r.id, dealNumber: r.dealNumber, role: isVehicle ? "vehicle" : "trade", customer, status: r.status, date: r.updatedAt.toISOString() });
    const km = Number(String(isVehicle ? d.vehicle.kms : d.trade.kms).replace(/\D/g, "")) || null;
    if (km !== null && dbKm === null) dbKm = km;
    if (!isVehicle) continue;
    if (d.vehicle.inServiceDate && !inServiceFromDb) inServiceFromDb = d.vehicle.inServiceDate;
    const start = new Date(r.updatedAt);
    const push = (name: string, code: string | null, kind: string, term: number | null, price: number) => {
      const exp = term ? new Date(start.getFullYear() + term, start.getMonth(), start.getDate()) : null;
      registered.push({
        dealId: r.id,
        dealNumber: r.dealNumber,
        dealStatus: r.status,
        customer,
        name,
        code,
        kind,
        term,
        price,
        purchased: start.toISOString().slice(0, 10),
        expiresOn: exp ? exp.toISOString().slice(0, 10) : null,
        active: exp ? exp.getTime() > now.getTime() : null,
      });
    };
    for (const p of d.products) {
      if (!(p.price > 0)) continue;
      const kind = p.code ? (planCodes.get(p.code)?.section ?? "fi") : p.id === "warranty" ? "warranty" : p.id === "tireRim" ? "tireRim" : "fi";
      push(p.name, p.code ?? null, kind, p.term ?? null, p.price);
    }
    for (const a of d.accessoryItems) {
      const hit = planNames.find((n) => a.name.toLowerCase().startsWith(n));
      if (!hit) continue;
      const plan = (s.protectionPlans ?? []).find((p) => p.name.toLowerCase() === hit)!;
      const yrs = Number(a.name.match(/\((\d+)\s*(?:ans?|years?|yrs?)\)/i)?.[1]) || null;
      push(plan.name, plan.code, "accessory", yrs, a.price);
    }
  }
  if (inv[0]) dbKm = Number(inv[0].kms) || dbKm;

  /* ----- OEM factory warranty ----- */
  const kmParam = u.get("km");
  const km = kmParam !== null && kmParam !== "" ? Number(kmParam.replace(/\D/g, "")) : dbKm;
  const inServiceParam = u.get("inService");
  const year = dec.year;
  let start: Date | null = null;
  let startSource: "input" | "database" | "estimated" = "estimated";
  if (inServiceParam) {
    start = new Date(inServiceParam);
    startSource = "input";
  } else if (inServiceFromDb) {
    start = new Date(inServiceFromDb);
    startSource = "database";
  } else if (year) {
    start = new Date(year - 1, 8, 1); // model-year launch (Sept. 1 of the previous year)
  }
  const oem = oemWarrantyFor(dec.make);
  const coverages =
    oem && start && !isNaN(start.getTime())
      ? [
          coverageStatus("Garantie de base (pare-chocs à pare-chocs)", oem.basic, start, km ?? null, now),
          coverageStatus(oem.powertrainLabel ?? "Groupe motopropulseur", oem.powertrain, start, km ?? null, now),
        ]
      : [];

  return Response.json({
    vin,
    checkDigitValid: vinCheckDigitValid(vin),
    vehicle: {
      ...dec,
      make: dec.make || inv[0]?.make?.toUpperCase() || "",
      model: dec.model || inv[0]?.model || "",
      trim: dec.trim || inv[0]?.trim || "",
    },
    km: km ?? null,
    kmSource: kmParam ? "input" : dbKm !== null ? "database" : null,
    inService: start && !isNaN(start.getTime()) ? start.toISOString().slice(0, 10) : null,
    inServiceSource: startSource,
    oem: oem ? { ...oem } : null,
    coverages,
    inventory: inv[0] ? { id: inv[0].id, stock: inv[0].stock, price: Number(inv[0].price) || 0, kms: Number(inv[0].kms) || 0, status: inv[0].status } : null,
    registered,
    history,
  });
}
