import { eq } from "drizzle-orm";
import { db } from "@/db";
import { deals } from "@/db/schema";
import type { DealFinancing } from "./credit";
import { computeDeal, leaseConfig, normalizeDeal, vehicleLabel } from "./deal";
import { getLenders, getSettings } from "./server";

const r2 = (n: number) => Math.round(n * 100) / 100;

/** Financing structure of a quotation (OPT 1) for the credit application. */
export async function dealFinancing(dealId: number): Promise<DealFinancing | null> {
  const r = (await db.select().from(deals).where(eq(deals.id, dealId)))[0];
  if (!r) return null;
  const [lenders, s] = await Promise.all([getLenders(), getSettings()]);
  const d = normalizeDeal(r.data);
  const c = computeDeal(d, lenders, s.excessKmCharge, leaseConfig(s));
  const o = c.options[0];
  const lease = d.dealType === "lease";
  const cash = d.dealType === "cash";
  return {
    dealId: r.id,
    dealNumber: r.dealNumber,
    quoteNumber: d.quoteNumber ?? "",
    dealType: d.dealType,
    vehicle: vehicleLabel(d),
    vin: d.vehicle.vin,
    price: r2(d.pricing.basePrice + d.pricing.options - d.pricing.reduction),
    downPayment: r2(d.cash.cashDownPreTax + d.cash.cashDownTaxIncl),
    tradeIn: r2(d.trade.value + d.trade.ecoTax),
    lienPayout: r2(d.trade.lien),
    taxes: lease ? r2(o.taxOnPayment * o.n) : r2(c.totalTaxes),
    amountFinanced: cash ? r2(c.soldeDu) : lease ? r2(o.capCost) : r2(o.amountFinanced),
    term: cash ? 0 : d.options[0].term,
    rate: cash ? 0 : d.options[0].rate,
    lender: cash ? "" : (o.lender?.name ?? ""),
    payment: cash ? 0 : lease ? r2(o.totalPayment) : r2(o.payment),
    frequency: d.options[0].frequency,
    residual: lease ? r2(o.residual) : 0,
    customerId: d.customer.id ? Number(d.customer.id) : null,
    customer: {
      firstName: d.customer.firstName,
      lastName: d.customer.lastName,
      email: d.customer.email,
      mobile: d.customer.mobile,
      homePhone: d.customer.homePhone,
      address: d.customer.address,
      city: d.customer.city,
      province: d.customer.province,
      postal: d.customer.postal,
    },
  };
}
