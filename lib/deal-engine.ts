import {
  availableTerms,
  applyOptDefaults,
  lenderRate,
  computeDeal,
  defaultDeal,
  DEFAULT_PRODUCTS,
  leaseConfig,
  tireRimOptions,
  warrantyOptions,
  type AccessoryItem,
  type DealData,
  type DealerSettings,
  type DealType,
  type Frequency,
  type Lender,
} from "./deal";
import { applyVehicleToDeal, type InventoryVehicle } from "./inventory";

export const MAX_REBATE_PCT = 3;

export function lendersFor(lenders: Lender[], type: DealType) {
  return lenders.filter((l) => l.active && (type === "lease" ? l.allowLease : l.allowFinance));
}

export function preferredLender(lenders: Lender[], type: DealType, s: DealerSettings): Lender | null {
  const valid = lendersFor(lenders, type);
  const pref = type === "lease" ? s.defaultLeaseLenderId : s.defaultFinanceLenderId;
  return valid.find((l) => l.id === pref) ?? valid[0] ?? null;
}

/** Apply a lender + nearest available term + its rate to both options. */
export function applyLenderToDeal(d: DealData, lender: Lender | null, term?: number, dealTerms?: number[]) {
  d.options.forEach((o, i) => {
    o.lenderId = lender?.id ?? null;
    if (!lender) return;
    const terms = availableTerms(lender, d.dealType, dealTerms);
    let t = term ?? o.term ?? (i === 0 ? 48 : 60);
    if (terms.length && !terms.includes(t)) t = terms.reduce((a, b) => (Math.abs(b - t) < Math.abs(a - t) ? b : a), terms[0]);
    o.term = t;
    const r = lenderRate(lender, d.dealType, t);
    if (r !== null) o.rate = r;
    o.registrationFee = Number(lender.registrationFee) || 0;
    o.residualManual = false;
  });
}

export interface QuoteParams {
  dealType: DealType;
  frequency: Frequency;
  term?: number;
  targetPayment?: number;
  maxPrice?: number;
  vehicleQuery?: string;
  cashDown?: number;
  warrantyYears?: number;
  tireRimYears?: number;
  accessories?: AccessoryItem[];
  count?: number;
}

export interface QuoteResult {
  vehicle: InventoryVehicle & { id: number };
  deal: DealData;
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

function matchesQuery(v: InventoryVehicle, q?: string) {
  if (!q?.trim()) return true;
  const hay = `${v.year} ${v.make} ${v.model} ${v.trim} ${v.extColor} ${v.stock}`.toLowerCase();
  return q
    .toLowerCase()
    .split(/[\s,]+/)
    .filter((w) => w.length > 1)
    .every((w) => hay.includes(w));
}

/** Build and price a quote for one vehicle; discount (rebate) never exceeds MAX_REBATE_PCT of MSRP. */
export function priceVehicle(
  v: InventoryVehicle & { id: number },
  p: QuoteParams,
  lenders: Lender[],
  s: DealerSettings,
): QuoteResult {
  const lc = leaseConfig(s);
  const d = defaultDeal(s);
  applyVehicleToDeal(d, v);
  d.dealType = p.dealType;
  d.status = "pending";
  applyOptDefaults(d, s, p.dealType);
  d.options.forEach((o) => (o.frequency = p.frequency));
  if (p.dealType !== "cash") applyLenderToDeal(d, preferredLender(lenders, p.dealType, s), p.term, s.dealTerms);
  if (p.cashDown) {
    if (p.dealType === "lease") d.cash.cashDownPreTax = p.cashDown;
    else d.cash.cashDownTaxIncl = p.cashDown;
  }
  // products
  const vehiclePrice = d.pricing.basePrice + d.pricing.options;
  d.products = (s.products?.length ? s.products : DEFAULT_PRODUCTS).map((x) => ({ ...x, price: 0 }));
  const setProd = (id: string, years: number | undefined, opts: { years: number; price: number }[]) => {
    if (!years) return;
    const o = opts.find((x) => x.years === years) ?? opts[opts.length - 1];
    const idx = d.products.findIndex((x) => x.id === id);
    if (o && idx >= 0) {
      d.products[idx].price = o.price;
      d.products[idx].term = o.years;
    }
  };
  setProd("warranty", p.warrantyYears, warrantyOptions(s.warrantyDivisors, vehiclePrice));
  setProd("tireRim", p.tireRimYears, tireRimOptions(s.tireRimFormula, vehiclePrice));
  if (p.accessories?.length) {
    d.accessoryItems = p.accessories.map((a) => ({ name: a.name, price: Number(a.price) || 0 }));
    d.pricing.accessories = d.accessoryItems.reduce((a, x) => a + x.price, 0);
  }

  const msrp = d.pricing.basePrice + d.pricing.options;
  const maxDiscount = Math.floor(msrp * (MAX_REBATE_PCT / 100) * 100) / 100;
  const pay = (disc: number) => {
    d.pricing.reduction = disc;
    const c = computeDeal(d, lenders, s.excessKmCharge, lc);
    return p.dealType === "cash" ? c.soldeDu : c.options[0].totalPayment;
  };

  let discount = 0;
  let meetsTarget: boolean | null = null;
  if (p.targetPayment && p.targetPayment > 0 && p.dealType !== "cash") {
    const p0 = pay(0);
    if (p0 <= p.targetPayment) meetsTarget = true;
    else {
      const p1 = pay(1000);
      const slope = (p1 - p0) / 1000;
      const need = slope < 0 ? (p.targetPayment - p0) / slope : Infinity;
      discount = Math.min(maxDiscount, Math.ceil(Math.max(0, need) * 100) / 100);
      meetsTarget = pay(discount) <= p.targetPayment + 0.005;
    }
  } else if (p.targetPayment && p.dealType === "cash") {
    const p0 = pay(0);
    const p1 = pay(1000);
    const slope = (p1 - p0) / 1000;
    const need = slope < 0 ? (p.targetPayment - p0) / slope : 0;
    discount = Math.min(maxDiscount, Math.ceil(Math.max(0, need) * 100) / 100);
    meetsTarget = pay(discount) <= p.targetPayment + 0.005;
  }
  d.pricing.reduction = discount;
  const c = computeDeal(d, lenders, s.excessKmCharge, lc);
  const o = c.options[0];
  return {
    vehicle: v,
    deal: d,
    payment: p.dealType === "cash" ? c.soldeDu : o.totalPayment,
    frequency: p.frequency,
    term: p.dealType === "cash" ? null : d.options[0].term,
    rate: p.dealType === "cash" ? null : d.options[0].rate,
    lender: p.dealType === "cash" ? null : (o.lender?.shortName ?? null),
    msrp,
    discount,
    discountPct: msrp ? Math.round((discount / msrp) * 10000) / 100 : 0,
    sellingPrice: msrp - discount,
    products: d.products.filter((x) => x.price > 0).map((x) => ({ name: x.name, term: x.term, price: x.price })),
    accessoriesTotal: d.pricing.accessories,
    dueOnDelivery: p.dealType === "cash" ? c.soldeDu : o.dueOnDelivery,
    gross: c.profit.total,
    meetsTarget,
  };
}

/** Generate up to `count` quotes from available inventory. */
export function generateQuotes(
  inventory: (InventoryVehicle & { id: number; status?: string })[],
  p: QuoteParams,
  lenders: Lender[],
  s: DealerSettings,
): QuoteResult[] {
  const pool = inventory.filter(
    (v) => v.status !== "sold" && v.status !== "employee" && v.price > 0 && matchesQuery(v, p.vehicleQuery) && (!p.maxPrice || v.price <= p.maxPrice * 1.03),
  );
  const results = pool.map((v) => priceVehicle(v, p, lenders, s));
  results.sort((a, b) => {
    if (p.targetPayment) {
      if (a.meetsTarget !== b.meetsTarget) return a.meetsTarget ? -1 : 1;
      return Math.abs(a.payment - p.targetPayment) - Math.abs(b.payment - p.targetPayment);
    }
    return a.payment - b.payment;
  });
  return results.slice(0, Math.max(1, Math.min(10, p.count ?? 3)));
}

/** Quick payment estimate for any price (used by the assistant). */
export function estimatePayment(
  args: { price: number; dealType: DealType; term?: number; frequency?: Frequency; rate?: number; residualPct?: number; cashDown?: number; kmPerYear?: number },
  lenders: Lender[],
  s: DealerSettings,
) {
  const d = defaultDeal(s);
  d.dealType = args.dealType;
  d.pricing.basePrice = args.price;
  const lender = args.dealType === "cash" ? null : preferredLender(lenders, args.dealType, s);
  applyOptDefaults(d, s, args.dealType);
  d.options.forEach((o) => (o.frequency = args.frequency ?? o.frequency ?? "monthly"));
  if (lender) applyLenderToDeal(d, lender, args.term, s.dealTerms);
  if (args.term) d.options[0].term = args.term;
  if (args.rate !== undefined && args.rate !== null) d.options[0].rate = args.rate;
  if (args.residualPct) {
    d.options[0].residualPct = args.residualPct;
    d.options[0].residualManual = true;
  }
  if (args.kmPerYear) d.options[0].kmPerYear = args.kmPerYear;
  if (args.cashDown) {
    if (args.dealType === "lease") d.cash.cashDownPreTax = args.cashDown;
    else d.cash.cashDownTaxIncl = args.cashDown;
  }
  const c = computeDeal(d, lenders, s.excessKmCharge, leaseConfig(s));
  const o = c.options[0];
  return {
    province: c.prov.name,
    taxRatePct: Math.round(c.taxRate * 100000) / 1000,
    dealType: args.dealType,
    price: args.price,
    freightAndPdi: d.pricing.freight,
    dealerFees: d.pricing.adminFees,
    lender: lender?.name ?? null,
    term: args.dealType === "cash" ? null : d.options[0].term,
    ratePct: args.dealType === "cash" ? null : d.options[0].rate,
    residualPct: args.dealType === "lease" ? o.residualPct : null,
    residualValue: args.dealType === "lease" ? o.residual : null,
    kmPerYear: args.dealType === "lease" ? d.options[0].kmPerYear : null,
    frequency: d.options[0].frequency,
    paymentBeforeTax: args.dealType === "cash" ? null : o.payment,
    paymentWithTax: args.dealType === "cash" ? null : o.totalPayment,
    amountFinanced: args.dealType === "cash" ? null : args.dealType === "lease" ? o.capCost : o.amountFinanced,
    dueOnDelivery: args.dealType === "cash" ? c.soldeDu : o.dueOnDelivery,
    totalCashPrice: args.dealType === "cash" ? c.cashTotal : null,
    luxuryTax: c.luxuryTax,
  };
}
