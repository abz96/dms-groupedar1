export type DealType = "cash" | "finance" | "lease";
export type Frequency = "monthly" | "biweekly" | "weekly";

export interface Lender {
  id: number;
  name: string;
  shortName: string;
  type: string;
  active: boolean;
  allowFinance: boolean;
  allowLease: boolean;
  financeRates: Record<string, number>;
  leaseRates: Record<string, number>;
  residuals: Record<string, number>;
  maxMarkup: string;
  reserveShare: string;
  registrationFee: string;
  notes: string;
  sortOrder: number;
}

export interface FinOption {
  lenderId: number | null;
  term: number;
  rate: number; // sell rate (customer)
  /** @deprecated single interest rate is used (kept for older saved deals) */
  buyRate?: number;
  frequency: Frequency;
  residualPct: number;
  /** true = residual typed manually; false = always taken from the Settings residual grid */
  residualManual: boolean;
  kmPerYear: number;
  securityDeposit: number;
  /** Taxe sur les pneus neufs, par option */
  tireTax: number;
  registrationFee: number;
}

export interface DealData {
  dealType: DealType;
  /** AI quote number this deal was converted from (e.g. QT-100001) */
  quoteNumber?: string;
  status: string;
  salesperson: string;
  fiManager: string;
  comments: string;
  customer: {
    /** link to the client database */
    id?: number | null;
    firstName: string;
    lastName: string;
    address: string;
    city: string;
    province: string;
    postal: string;
    homePhone: string;
    mobile: string;
    email: string;
    coBuyer: string;
  };
  vehicle: {
    condition: string;
    year: string;
    make: string;
    model: string;
    trim: string;
    stock: string;
    vin: string;
    extColor: string;
    intColor: string;
    kms: string;
    warranty: string;
    inServiceDate: string;
    bodyStyle: string;
    transmission: string;
    spStatus: string;
    delivery: string;
    versionListe: string;
    description: string;
  };
  taxProvince: string;
  pricing: {
    basePrice: number;
    options: number;
    freight: number;
    rmNonTax: number;
    adminFees: number;
    accessories: number;
    reduction: number;
    /** Taxe sur les pneus neufs (Québec) */
    tireTax: number;
  };
  trade: {
    description: string;
    vin: string;
    kms: string;
    colour: string;
    lienHolder: string;
    value: number;
    ecoTax: number;
    lien: number;
  };
  cash: {
    cashDownPreTax: number;
    rebatePreTax: number;
    cashDownTaxIncl: number;
    rebateTaxIncl: number;
    deposit: number;
    deliveryFees: number;
  };
  /** Accessories detail — when not empty, pricing.accessories = sum of prices */
  accessoryItems: AccessoryItem[];
  /** F&I / profit products sold on this deal */
  products: DealProduct[];
  /** discount amount approved by a manager above the 3 % limit */
  reductionApproved?: number;
  /** show the discount (Réduction) on screen / printed sheet */
  showReduction?: boolean;
  /** products the client pays at delivery instead of financing them */
  payOnDelivery?: PayOnDelivery;
  /** Manufacturer incentives applied (cash ones sum into pricing.rmNonTax) */
  incentivesApplied: AppliedIncentive[];
  options: [FinOption, FinOption];
  profit: {
    /** Profit % per product. Vehicle % applies to MSRP (base + options); others apply to their selling price. */
    pct: ProfitPct;
    holdback: number;
    commission: { vehicle: number; accessories: number; warranty: number; tireRim: number; otherFI: number; reserve: number; fees?: number };
  };
}

/** Residual % by term (months): { "48": 52 } */
export type ResidualTerms = Record<string, number>;

/**
 * Km/year pricing tier. `step` = monthly $ difference vs the adjacent tier toward the base
 * (above base: vs the tier just below · below base: vs the tier just above). Base tier step = 0.
 */
export interface KmTier {
  km: number;
  step: number;
}

export interface LeaseConfig {
  residuals: ResidualTerms;
  kmTiers: KmTier[];
  baseKm: number;
}

export const DEFAULT_RESIDUAL_TERMS: ResidualTerms = { "12": 70, "24": 64, "36": 58, "48": 52, "60": 44, "72": 37, "84": 31, "96": 25 };
export const DEFAULT_BASE_KM = 16000;
export const DEFAULT_KM_TIERS: KmTier[] = [
  { km: 12000, step: -20 },
  { km: 16000, step: 0 },
  { km: 20000, step: 15 },
  { km: 24000, step: 10 },
];
export const DEFAULT_LEASE: LeaseConfig = { residuals: DEFAULT_RESIDUAL_TERMS, kmTiers: DEFAULT_KM_TIERS, baseKm: DEFAULT_BASE_KM };

export function leaseConfig(s: Pick<DealerSettings, "residualTerms" | "kmTiers" | "baseKm">): LeaseConfig {
  return {
    residuals: s.residualTerms ?? DEFAULT_RESIDUAL_TERMS,
    kmTiers: s.kmTiers?.length ? s.kmTiers : DEFAULT_KM_TIERS,
    baseKm: s.baseKm || DEFAULT_BASE_KM,
  };
}

/** Cumulative monthly $ adjustment for a km tier vs the base tier (16,000 km → 0). */
export function kmMonthlyAdjustment(tiers: KmTier[], baseKm: number, km: number): number {
  const sorted = [...tiers].sort((a, b) => a.km - b.km);
  if (!sorted.length) return 0;
  // nearest tier for km values not in the table
  const target = sorted.reduce((a, b) => (Math.abs(b.km - km) < Math.abs(a.km - km) ? b : a)).km;
  let total = 0;
  if (target > baseKm) for (const t of sorted) if (t.km > baseKm && t.km <= target) total += Number(t.step) || 0;
  if (target < baseKm) for (const t of sorted) if (t.km < baseKm && t.km >= target) total += Number(t.step) || 0;
  return Math.round(total * 100) / 100;
}

/** Residual % for a term from the settings table, falling back to lender residual, then the stored value. */
export function lookupResidual(residuals: ResidualTerms | undefined, term: number, lender?: Lender | null, fallback = 0): number {
  const v = interpolateByTerm(residuals, term, { extrapolate: true, min: 10, max: 90 });
  if (v !== null) return v;
  const lv = lender ? interpolateByTerm(lender.residuals, term, { extrapolate: true, min: 10, max: 90 }) : null;
  if (lv !== null) return lv;
  return fallback;
}

/** Manufacturer incentive defined in Settings */
export interface Incentive {
  id: string;
  name: string;
  /** cash = dealer/manufacturer rebate (non-taxable, R.M.) · rate = lower interest rate */
  kind: "cash" | "rate";
  amount: number;
  /** rate offer: subvented rate (%) */
  rate: number;
  /** "" = all deal types */
  dealType: "" | "finance" | "lease" | "cash";
  terms: string;
  notes: string;
  active: boolean;
}

/** Incentive applied on a deal */
export interface AppliedIncentive {
  id: string;
  name: string;
  kind: "cash" | "rate";
  amount: number;
  rate: number;
}

/** Profit product defined in Settings (extended warranty, tire & rim, GAP…) */
export interface ProductDef {
  id: string;
  name: string;
  /** profit % of the selling price */
  pct: number;
  /** commission % of the gross */
  commission: number;
  group: "front" | "back";
}
/** Product sold on a deal */
export interface DealProduct extends ProductDef {
  price: number;
  /** protection plan code when the product comes from the plan catalogue */
  code?: string;
  /** coverage term in years (warranty / tire & rim selector) */
  term?: number;
}

/** Tire & rim: max term uses the base divisor; every shorter year adds `step`. */
export interface TireRimFormula {
  base: number;
  step: number;
  maxYears: number;
}
export const DEFAULT_WARRANTY_DIVISORS: Record<string, number> = { "1": 18, "2": 16, "3": 14, "4": 12, "5": 11, "6": 10 };
export const DEFAULT_TIRE_RIM: TireRimFormula = { base: 48, step: 4, maxYears: 6 };

export interface TermOption {
  years: number;
  divisor: number;
  price: number;
}

/** Warranty price = vehicle price ÷ divisor */
export function warrantyOptions(divisors: Record<string, number> | undefined, vehiclePrice: number): TermOption[] {
  const d = divisors && Object.keys(divisors).length ? divisors : DEFAULT_WARRANTY_DIVISORS;
  return Object.entries(d)
    .map(([y, div]) => ({ years: Number(y), divisor: Number(div) || 0 }))
    .filter((x) => x.years > 0 && x.divisor > 0)
    .sort((a, b) => a.years - b.years)
    .map((x) => ({ ...x, price: Math.round((vehiclePrice / x.divisor) * 100) / 100 }));
}

/** Tire & rim price = vehicle price ÷ (base + step × (maxYears − years)) */
export function tireRimOptions(f: TireRimFormula | undefined, vehiclePrice: number): TermOption[] {
  const { base, step, maxYears } = { ...DEFAULT_TIRE_RIM, ...(f ?? {}) };
  const out: TermOption[] = [];
  for (let y = 1; y <= Math.max(1, Math.round(maxYears)); y++) {
    const divisor = Number(base) + Number(step) * (maxYears - y);
    if (divisor > 0) out.push({ years: y, divisor, price: Math.round((vehiclePrice / divisor) * 100) / 100 });
  }
  return out;
}

export const DEFAULT_PRODUCTS: ProductDef[] = [
  { id: "warranty", name: "Garantie prolongée", pct: 50, commission: 10, group: "back" },
  { id: "tireRim", name: "Protection pneus & jantes", pct: 50, commission: 10, group: "back" },
  { id: "otherFI", name: "Autres produits F&A", pct: 50, commission: 10, group: "back" },
];

/* ---------------------------------------------------------------- protection plan catalogue */

export type PlanCategory = "cosmetic" | "mechanical" | "antitheft" | "financial";
/** Where the plan goes on the deal */
export type PlanSection = "warranty" | "tireRim" | "accessory" | "fi";

export interface ProtectionPlan {
  id: string;
  name: string;
  code: string;
  category: PlanCategory;
  baseWholesale: number;
  /** scales with the vehicle price tier */
  scales: boolean;
  active: boolean;
  section: PlanSection;
  /** customer-facing description (FR / EN) */
  description?: string;
  descriptionEn?: string;
}
export interface VehicleTier {
  key: string;
  label: string;
  min: number;
  /** null = unlimited */
  max: number | null;
  factor: number;
}

/** Default plan descriptions [FR, EN] by code */
export const PLAN_DESCRIPTIONS: Record<string, [string, string]> = {
  "APP-GARD": [
    "Protection esthétique intérieure et extérieure : taches sur les tissus et le cuir, petites bosses sans peinture, éclats de pare-brise et dommages mineurs à la peinture. Garde le véhicule comme neuf et protège sa valeur de revente.",
    "Interior and exterior appearance protection: stains on fabric and leather, paintless dent repair, windshield chips and minor paint damage. Keeps the vehicle looking new and protects its resale value.",
  ],
  "BODY-GARD": [
    "Traitement protecteur de la carrosserie avec scellant Sharkskin Plus® : protège la peinture contre les rayons UV, le sel de déglaçage, la sève, les fientes d'oiseaux et l'oxydation. Entretien facilité et brillance durable.",
    "Body protection treatment with Sharkskin Plus® sealant: protects the paint against UV rays, road salt, tree sap, bird droppings and oxidation. Easier cleaning and long-lasting shine.",
  ],
  "I-SELECT": [
    "Garantie prolongée mécanique la plus complète : couvre les principales composantes mécaniques et électriques (moteur, transmission, direction, freins, climatisation, systèmes électroniques) après la garantie du fabricant. Assistance routière incluse.",
    "The most comprehensive extended mechanical warranty: covers the main mechanical and electrical components (engine, transmission, steering, brakes, A/C, electronic systems) after the manufacturer's warranty. Roadside assistance included.",
  ],
  "100-LIMITE": [
    "Garantie prolongée conçue pour les véhicules d'occasion : protège les composantes mécaniques majeures avec une limite de réclamation adaptée à la valeur du véhicule. Une protection abordable contre les réparations coûteuses.",
    "Extended warranty designed for pre-owned vehicles: protects major mechanical components with a claim limit adapted to the vehicle's value. Affordable protection against costly repairs.",
  ],
  "DRIVE-AHEAD": [
    "Programme de protection mécanique qui prend le relais de la garantie d'origine : couverture des pannes des composantes essentielles, remorquage et location de véhicule de courtoisie pendant les réparations.",
    "Mechanical protection program that takes over from the original warranty: breakdown coverage for essential components, towing and courtesy rental during repairs.",
  ],
  "POWERTRAIN-PLUS": [
    "Protection du groupe motopropulseur : moteur, transmission, différentiel et arbres de transmission — les réparations les plus coûteuses d'un véhicule — avec composantes additionnelles incluses.",
    "Powertrain protection: engine, transmission, differential and drive shafts — the most expensive repairs on a vehicle — with additional components included.",
  ],
  "RIDE-GREEN": [
    "Programme environnemental certifié : compense les émissions de gaz à effet de serre du véhicule par des projets de reboisement et de réduction de carbone. Le client reçoit un certificat attestant sa participation.",
    "Certified environmental program: offsets the vehicle's greenhouse gas emissions through reforestation and carbon-reduction projects. The client receives a certificate confirming participation.",
  ],
  "TIRE-GARD": [
    "Protection pneus et jantes contre les dangers de la route : nids-de-poule, clous, débris et crevaisons. Réparation ou remplacement des pneus et jantes, pose et équilibrage inclus, assistance routière 24 h / 24.",
    "Tire and rim protection against road hazards: potholes, nails, debris and flats. Repair or replacement of tires and rims, mounting and balancing included, 24/7 roadside assistance.",
  ],
  "SECURE-GARD": [
    "Système antivol par burinage du NIV sur les vitres et les pièces principales : décourage les voleurs et facilite la récupération. Prestation financière versée en cas de vol non récupéré.",
    "Anti-theft VIN etching on the windows and major parts: deters thieves and helps recovery. A financial benefit is paid if the vehicle is stolen and not recovered.",
  ],
  "CARRX-GPS": [
    "Traceur GPS Elo installé dans le véhicule : localisation en temps réel, alertes de mouvement et assistance à la récupération en cas de vol, accessible depuis une application mobile.",
    "Elo GPS tracker installed in the vehicle: real-time location, movement alerts and theft-recovery assistance, accessible from a mobile app.",
  ],
  "DATADOT-DNA": [
    "Marquage antivol par milliers de micro-points portant un code unique appliqués sur les pièces du véhicule. Identification permanente et invisible qui décourage le vol et la revente de pièces.",
    "Anti-theft marking with thousands of micro-dots carrying a unique code applied to the vehicle's parts. Permanent, invisible identification that deters theft and resale of parts.",
  ],
  "CREDITOR-INS": [
    "Assurance crédit (vie, invalidité et perte d'emploi) : rembourse le solde du prêt ou effectue les paiements si l'emprunteur décède, devient invalide ou perd son emploi involontairement.",
    "Creditor insurance (life, disability and job loss): pays off the loan balance or makes the payments if the borrower dies, becomes disabled or involuntarily loses their job.",
  ],
  "REPLACE-INS": [
    "Assurance de remplacement : en cas de perte totale, permet de remplacer le véhicule par un véhicule neuf comparable, sans dépréciation, au-delà de ce que verse l'assureur principal.",
    "Replacement insurance: in the event of a total loss, replaces the vehicle with a comparable new vehicle, with no depreciation, beyond what the primary insurer pays.",
  ],
  "GAP-PROT": [
    "Protection de l'écart (GAP) : couvre la différence entre l'indemnité de l'assureur et le solde dû sur le prêt ou la location en cas de perte totale ou de vol du véhicule.",
    "Guaranteed Asset Protection (GAP): covers the difference between the insurer's settlement and the balance owed on the loan or lease if the vehicle is a total loss or stolen.",
  ],
  "TOTAL-LOSS": [
    "Protection perte totale : verse une prestation forfaitaire à appliquer sur l'achat du prochain véhicule lorsque le véhicule est déclaré perte totale par l'assureur.",
    "Total loss protection: pays a lump-sum benefit toward the purchase of the next vehicle when the vehicle is declared a total loss by the insurer.",
  ],
};

const plan = (code: string, name: string, category: PlanCategory, baseWholesale: number, section: PlanSection): ProtectionPlan => ({
  id: code.toLowerCase(),
  name,
  code,
  category,
  baseWholesale,
  scales: true,
  active: true,
  section,
  description: PLAN_DESCRIPTIONS[code]?.[0] ?? "",
  descriptionEn: PLAN_DESCRIPTIONS[code]?.[1] ?? "",
});
export const DEFAULT_PLANS: ProtectionPlan[] = [
  plan("APP-GARD", "Appearance-Gard®", "cosmetic", 495, "accessory"),
  plan("BODY-GARD", "Body-Gard® with Sharkskin Plus®", "cosmetic", 595, "accessory"),
  plan("I-SELECT", "i-Select Plus™", "mechanical", 1250, "warranty"),
  plan("100-LIMITE", "100 Limite™", "mechanical", 1100, "warranty"),
  plan("DRIVE-AHEAD", "Drive-Ahead™", "mechanical", 890, "warranty"),
  plan("POWERTRAIN-PLUS", "Powertrain Protection Plus™", "mechanical", 780, "warranty"),
  plan("RIDE-GREEN", "Ride Green Certified®", "mechanical", 295, "warranty"),
  plan("TIRE-GARD", "Tire-Gard®", "mechanical", 420, "tireRim"),
  plan("SECURE-GARD", "Secure-Gard®", "antitheft", 280, "accessory"),
  plan("CARRX-GPS", "CarRx® by Elo GPS®", "antitheft", 395, "accessory"),
  plan("DATADOT-DNA", "DataDotDNA®", "antitheft", 250, "accessory"),
  plan("CREDITOR-INS", "Creditor Insurance", "financial", 690, "fi"),
  plan("REPLACE-INS", "Replacement Insurance", "financial", 750, "fi"),
  plan("GAP-PROT", "Guaranteed Asset Protection", "financial", 540, "fi"),
  plan("TOTAL-LOSS", "Total Loss Protection", "financial", 480, "fi"),
];
export function planDescription(p: ProtectionPlan, lang: "fr" | "en"): string {
  const d = PLAN_DESCRIPTIONS[p.code];
  return (lang === "en" ? p.descriptionEn || d?.[1] || p.description : p.description || d?.[0] || p.descriptionEn) ?? "";
}

export const DEFAULT_VEHICLE_TIERS: VehicleTier[] = [
  { key: "T1", label: "Up to $25,000", min: 0, max: 25000, factor: 0.82 },
  { key: "T2", label: "$25,001 – $45,000", min: 25000, max: 45000, factor: 1 },
  { key: "T3", label: "$45,001 – $65,000", min: 45000, max: 65000, factor: 1.06 },
  { key: "T4", label: "Over $65,000", min: 65000, max: null, factor: 1.32 },
];
export const DEFAULT_TERM_FACTORS: Record<string, number> = { "1": 0.46, "2": 0.66, "3": 0.84, "4": 1.5, "5": 1.9, "6": 2.5 };
export const DEFAULT_PLAN_MARGIN = 40;

export function vehicleTierFor(tiers: VehicleTier[] | undefined, price: number): VehicleTier | null {
  const list = (tiers?.length ? tiers : DEFAULT_VEHICLE_TIERS).slice().sort((a, b) => a.min - b.min);
  return list.find((t, i) => (i === 0 ? price >= t.min : price > t.min) && (t.max === null || price <= t.max)) ?? list[list.length - 1] ?? null;
}

export interface PlanQuote {
  years: number;
  vehicleFactor: number;
  termFactor: number;
  tier: VehicleTier | null;
  wholesale: number;
  retail: number;
  gross: number;
}

/** Base × vehicle factor × term factor = wholesale; retail = wholesale ÷ (1 − margin). */
export function planPrice(
  p: ProtectionPlan,
  years: number,
  vehiclePrice: number,
  s: Pick<DealerSettings, "vehicleTiers" | "termFactors" | "planMargin">,
): PlanQuote {
  const tier = vehicleTierFor(s.vehicleTiers, vehiclePrice);
  const vehicleFactor = p.scales ? (tier?.factor ?? 1) : 1;
  const tf = s.termFactors && Object.keys(s.termFactors).length ? s.termFactors : DEFAULT_TERM_FACTORS;
  const termFactor = Number(tf[String(years)] ?? 1) || 1;
  const wholesale = Math.round(p.baseWholesale * vehicleFactor * termFactor * 100) / 100;
  const margin = Math.min(95, Math.max(0, s.planMargin ?? DEFAULT_PLAN_MARGIN)) / 100;
  const retail = Math.round((wholesale / (1 - margin)) * 100) / 100;
  return { years, vehicleFactor, termFactor, tier, wholesale, retail, gross: Math.round((retail - wholesale) * 100) / 100 };
}

export interface AccessoryItem {
  name: string;
  price: number;
}

export interface OptDefault {
  term: number;
  frequency: Frequency;
}
export interface OptDefaults {
  lease: [OptDefault, OptDefault];
  finance: [OptDefault, OptDefault];
}

/** Apply Settings defaults (term, frequency, km) to OPT 1 & OPT 2 for a deal type. */
export function applyOptDefaults(d: DealData, s: Pick<DealerSettings, "optDefaults" | "defaultKmPerYear" | "defaultKmPerYear2">, type: DealType) {
  if (type === "cash") return;
  const od = s.optDefaults?.[type];
  d.options.forEach((o, i) => {
    const x = od?.[i];
    if (x?.term) o.term = x.term;
    if (x?.frequency) o.frequency = x.frequency;
    if (type === "lease") o.kmPerYear = i === 0 ? s.defaultKmPerYear || 16000 : s.defaultKmPerYear2 || 20000;
    o.residualManual = false;
  });
}

export interface PayOnDelivery {
  warranty: boolean;
  tireRim: boolean;
  accessories: boolean;
  fi: boolean;
}
export const NO_POD: PayOnDelivery = { warranty: false, tireRim: false, accessories: false, fi: false };

/** Pre-tax amount per product group (for pay-on-delivery). */
export function productGroups(d: DealData) {
  const sum = (f: (p: DealProduct) => boolean) => Math.round(d.products.filter((p) => p.price > 0 && f(p)).reduce((a, p) => a + p.price, 0) * 100) / 100;
  return {
    warranty: sum((p) => p.id === "warranty"),
    tireRim: sum((p) => p.id === "tireRim"),
    fi: sum((p) => p.id !== "warranty" && p.id !== "tireRim"),
    accessories: Math.round((Number(d.pricing.accessories) || 0) * 100) / 100,
  };
}

export type ProfitKey = "vehicle" | "accessories" | "warranty" | "tireRim" | "otherFI";
export type ProfitPct = Record<ProfitKey, number>;

export interface DealerSettings {
  dealerName: string;
  legalName: string;
  address: string;
  tel: string;
  fax: string;
  dealerNumber: string;
  gstNumber: string;
  qstNumber: string;
  email: string;
  defaultProvince: string;
  excessKmCharge: number;
  defaultSalesperson: string;
  defaultFreight: number;
  defaultAdminFees: number;
  defaultTireTax: number;
  defaultSecurityDeposit: number;
  /** Acompte remboursable (refundable deposit) */
  defaultRefundableDeposit: number;
  /** Default lender picked automatically on new finance / lease deals */
  defaultFinanceLenderId: number | null;
  defaultLeaseLenderId: number | null;
  /** Saved accessories (name + price) for quick add */
  accessoryCatalog: AccessoryItem[];
  /** Manufacturer rebates & rate incentives */
  incentives: Incentive[];
  defaultKmPerYear: number;
  profitPct: ProfitPct;
  /** Lease residual % by term */
  residualTerms: ResidualTerms;
  /** Km/year tiers with monthly $ steps */
  kmTiers: KmTier[];
  /** Km tier the residual payment is based on (16,000) */
  baseKm: number;
  commission: { vehicle: number; accessories: number; warranty: number; tireRim: number; otherFI: number; reserve: number; fees?: number };
  /** Profit products (add / edit / remove in Settings) */
  products: ProductDef[];
  /** Warranty price = vehicle price ÷ divisor (by years) */
  warrantyDivisors: Record<string, number>;
  tireRimFormula: TireRimFormula;
  /** Lease km/year for OPT 2 */
  defaultKmPerYear2: number;
  /** Manager approval code (discount above the limit) */
  managerCode: string;
  /** Max discount without manager approval (% of MSRP) */
  maxDiscountPct: number;
  /** Terms offered for lease & finance (months) */
  dealTerms: number[];
  /** Default OPT 1 / OPT 2 structure */
  optDefaults: OptDefaults;
  /** Protection plan catalogue & pricing policy */
  protectionPlans: ProtectionPlan[];
  vehicleTiers: VehicleTier[];
  termFactors: Record<string, number>;
  planMargin: number;
}

export const DEFAULT_DEAL_TERMS = [12, 24, 36, 48, 60, 72, 84, 96];

export const DEFAULT_SETTINGS: DealerSettings = {
  dealerName: "Auto Dealer Montréal",
  legalName: "o/b 9465812 Canada Ltd.",
  address: "4525 Boul Saint-Jean, Dollard-Des-Ormeaux, QC, H9H 2A7",
  tel: "(514) 620-5900",
  fax: "(514) 626-8820",
  dealerNumber: "79650",
  gstNumber: "802653527RT0001",
  qstNumber: "1223310407TQ0001",
  email: "ventes@dealer.ca",
  defaultProvince: "QC",
  excessKmCharge: 0.2,
  defaultSalesperson: "",
  defaultFreight: 2695,
  defaultAdminFees: 999,
  defaultTireTax: 18,
  defaultSecurityDeposit: 1000,
  defaultRefundableDeposit: 500,
  defaultFinanceLenderId: null,
  defaultLeaseLenderId: null,
  accessoryCatalog: [],
  incentives: [],
  defaultKmPerYear: 16000,
  profitPct: { vehicle: 6, accessories: 40, warranty: 50, tireRim: 50, otherFI: 50 },
  residualTerms: DEFAULT_RESIDUAL_TERMS,
  kmTiers: DEFAULT_KM_TIERS,
  baseKm: DEFAULT_BASE_KM,
  commission: { vehicle: 25, accessories: 10, warranty: 10, tireRim: 10, otherFI: 10, reserve: 10, fees: 0 },
  products: DEFAULT_PRODUCTS,
  warrantyDivisors: DEFAULT_WARRANTY_DIVISORS,
  tireRimFormula: DEFAULT_TIRE_RIM,
  defaultKmPerYear2: 20000,
  dealTerms: DEFAULT_DEAL_TERMS,
  managerCode: "9296",
  maxDiscountPct: 3,
  protectionPlans: DEFAULT_PLANS,
  vehicleTiers: DEFAULT_VEHICLE_TIERS,
  termFactors: DEFAULT_TERM_FACTORS,
  planMargin: DEFAULT_PLAN_MARGIN,
  optDefaults: {
    lease: [
      { term: 48, frequency: "monthly" },
      { term: 60, frequency: "monthly" },
    ],
    finance: [
      { term: 60, frequency: "monthly" },
      { term: 72, frequency: "monthly" },
    ],
  },
};

export interface ProvinceTax {
  code: string;
  name: string;
  gst: number;
  pst: number;
  hst: number;
  pstLabel: string;
}

// Current Canadian sales tax rates (2025/2026)
export const PROVINCES: ProvinceTax[] = [
  { code: "QC", name: "QUEBEC", gst: 5, pst: 9.975, hst: 0, pstLabel: "QST" },
  { code: "ON", name: "ONTARIO", gst: 0, pst: 0, hst: 13, pstLabel: "PST" },
  { code: "BC", name: "BRITISH COLUMBIA", gst: 5, pst: 7, hst: 0, pstLabel: "PST" },
  { code: "AB", name: "ALBERTA", gst: 5, pst: 0, hst: 0, pstLabel: "PST" },
  { code: "SK", name: "SASKATCHEWAN", gst: 5, pst: 6, hst: 0, pstLabel: "PST" },
  { code: "MB", name: "MANITOBA", gst: 5, pst: 7, hst: 0, pstLabel: "RST" },
  { code: "NB", name: "NEW BRUNSWICK", gst: 0, pst: 0, hst: 15, pstLabel: "PST" },
  { code: "NS", name: "NOVA SCOTIA", gst: 0, pst: 0, hst: 14, pstLabel: "PST" },
  { code: "PE", name: "PRINCE EDWARD ISLAND", gst: 0, pst: 0, hst: 15, pstLabel: "PST" },
  { code: "NL", name: "NEWFOUNDLAND", gst: 0, pst: 0, hst: 15, pstLabel: "PST" },
  { code: "YT", name: "YUKON", gst: 5, pst: 0, hst: 0, pstLabel: "PST" },
  { code: "NT", name: "NORTHWEST TERRITORIES", gst: 5, pst: 0, hst: 0, pstLabel: "PST" },
  { code: "NU", name: "NUNAVUT", gst: 5, pst: 0, hst: 0, pstLabel: "PST" },
];

export function getProvince(code: string): ProvinceTax {
  return PROVINCES.find((p) => p.code === code) ?? PROVINCES[0];
}

export function defaultOption(term = 48): FinOption {
  return {
    lenderId: null,
    term,
    rate: 0,
    frequency: "monthly",
    residualPct: 0,
    residualManual: false,
    kmPerYear: 16000,
    securityDeposit: DEFAULT_SETTINGS.defaultSecurityDeposit,
    tireTax: DEFAULT_SETTINGS.defaultTireTax,
    registrationFee: 53.76,
  };
}

export function defaultDeal(s: DealerSettings = DEFAULT_SETTINGS): DealData {
  return {
    dealType: "lease",
    status: "open",
    salesperson: s.defaultSalesperson,
    fiManager: "",
    comments:
      "No Export: Purchaser shall not sell, lease, or trade the Vehicle to any person not resident of Canada or sell, lease or trade the Vehicle to any person whom Purchaser knew or acting reasonably ought to have known intended to export the Vehicle without the prior consent of Dealer.",
    customer: { firstName: "", lastName: "", address: "", city: "", province: s.defaultProvince, postal: "", homePhone: "", mobile: "", email: "", coBuyer: "" },
    vehicle: {
      condition: "USAGÉ", year: "2026", make: "", model: "", trim: "", stock: "", vin: "", extColor: "", intColor: "",
      kms: "", warranty: "", inServiceDate: "", bodyStyle: "", transmission: "Automatic", spStatus: "NA", delivery: "",
      versionListe: "", description: "",
    },
    taxProvince: s.defaultProvince,
    pricing: { basePrice: 0, options: 0, freight: s.defaultFreight, rmNonTax: 0, adminFees: s.defaultAdminFees, accessories: 0, reduction: 0, tireTax: s.defaultTireTax ?? 18 },
    trade: { description: "", vin: "", kms: "", colour: "", lienHolder: "", value: 0, ecoTax: 0, lien: 0 },
    cash: { cashDownPreTax: 0, rebatePreTax: 0, cashDownTaxIncl: 0, rebateTaxIncl: 0, deposit: s.defaultRefundableDeposit ?? 500, deliveryFees: 0 },
    accessoryItems: [],
    incentivesApplied: [],
    products: (s.products?.length ? s.products : DEFAULT_PRODUCTS).map((x) => ({ ...x, price: 0 })),
    options: [0, 1].map((i) => ({
      ...defaultOption(i === 0 ? 48 : 60),
      kmPerYear: i === 0 ? (s.defaultKmPerYear ?? 16000) : (s.defaultKmPerYear2 ?? 20000),
      term: s.optDefaults?.lease?.[i]?.term ?? (i === 0 ? 48 : 60),
      frequency: s.optDefaults?.lease?.[i]?.frequency ?? "monthly",
      securityDeposit: s.defaultSecurityDeposit ?? 1000,
      tireTax: s.defaultTireTax ?? 18,
    })) as [FinOption, FinOption],
    profit: {
      pct: { ...DEFAULT_SETTINGS.profitPct, ...(s.profitPct ?? {}) },
      holdback: 0,
      commission: { ...s.commission },
    },
  };
}

/** Older deals stored warranty / tire & rim / other F&I as fixed pricing fields. */
function legacyProducts(r: Partial<DealData>): DealProduct[] {
  const lp = (r.pricing ?? {}) as Record<string, unknown>;
  const pct = (r.profit?.pct ?? {}) as Partial<ProfitPct>;
  const com = (r.profit?.commission ?? {}) as Partial<DealData["profit"]["commission"]>;
  const price: Record<string, number> = { warranty: Number(lp.garProl) || 0, tireRim: Number(lp.tireRim) || 0, otherFI: Number(lp.otherFI) || 0 };
  return DEFAULT_PRODUCTS.map((x) => ({
    ...x,
    price: price[x.id] ?? 0,
    pct: Number(pct[x.id as ProfitKey] ?? x.pct),
    commission: Number(com[x.id as "warranty"] ?? x.commission),
  }));
}

/** Deep merge saved data with defaults so older deals always open correctly. */
export function normalizeDeal(raw: unknown): DealData {
  const d = defaultDeal();
  const r = (raw ?? {}) as Partial<DealData>;
  return {
    ...d,
    ...r,
    customer: { ...d.customer, ...(r.customer ?? {}) },
    vehicle: { ...d.vehicle, ...(r.vehicle ?? {}) },
    pricing: { ...d.pricing, ...(r.pricing ?? {}) },
    trade: { ...d.trade, ...(r.trade ?? {}) },
    cash: { ...d.cash, ...(r.cash ?? {}) },
    products: Array.isArray(r.products)
      ? r.products.map((x) => ({
          id: String(x?.id ?? Math.random().toString(36).slice(2, 10)),
          name: String(x?.name ?? ""),
          price: Number(x?.price) || 0,
          pct: Number(x?.pct) || 0,
          commission: Number(x?.commission) || 0,
          group: x?.group === "front" ? ("front" as const) : ("back" as const),
          term: x?.term ? Number(x.term) : undefined,
          code: x?.code ? String(x.code) : undefined,
        }))
      : legacyProducts(r),
    payOnDelivery: { ...NO_POD, ...(r.payOnDelivery ?? {}) },
    incentivesApplied: Array.isArray(r.incentivesApplied)
      ? r.incentivesApplied.map((x) => ({
          id: String(x?.id ?? ""),
          name: String(x?.name ?? ""),
          kind: x?.kind === "rate" ? ("rate" as const) : ("cash" as const),
          amount: Number(x?.amount) || 0,
          rate: Number(x?.rate) || 0,
        }))
      : [],
    accessoryItems: Array.isArray(r.accessoryItems)
      ? r.accessoryItems.map((a) => ({ name: String(a?.name ?? ""), price: Number(a?.price) || 0 }))
      : [],
    options: [0, 1].map((i) => {
      const ro = (r.options?.[i] ?? {}) as Partial<FinOption>;
      const tire = ro.tireTax ?? r.pricing?.tireTax ?? d.options[i].tireTax;
      return { ...d.options[i], ...ro, tireTax: Number(tire) || 0 };
    }) as [FinOption, FinOption],
    profit: {
      pct: { ...d.profit.pct, ...(r.profit?.pct ?? {}) },
      holdback: Number(r.profit?.holdback ?? d.profit.holdback) || 0,
      commission: { ...d.profit.commission, ...(r.profit?.commission ?? {}) },
    },
  };
}

export const PERIODS: Record<Frequency, number> = { monthly: 12, biweekly: 26, weekly: 52 };
export const FREQ_LABEL: Record<Frequency, string> = { monthly: "MONTHLY", biweekly: "BI-WEEKLY", weekly: "WEEKLY" };
export const FREQ_LABEL_FR: Record<Frequency, string> = { monthly: "Mensuel", biweekly: "Aux 2 sem.", weekly: "Hebdo" };

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const num = (n: unknown) => (typeof n === "number" && isFinite(n) ? n : Number(n) || 0);

export interface OptionResult {
  lender: Lender | null;
  periods: number;
  n: number;
  // finance
  amountFinanced: number;
  payment: number;
  taxOnPayment: number;
  gstOnPayment: number;
  pstOnPayment: number;
  totalPayment: number;
  costOfBorrowing: number;
  totalObligation: number;
  // lease
  capCost: number;
  residual: number;
  upfrontTaxes: number;
  upfrontGst: number;
  upfrontPst: number;
  dueOnDelivery: number;
  totalLeaseCost: number;
  reserve: number;
  excessKm: number;
  totalKms: number;
  /** effective residual % used */
  residualPct: number;
  /** km/year price adjustment per payment period (pre-tax), included in payment */
  kmAdjustment: number;
  /** same adjustment expressed per month */
  kmAdjustmentMonthly: number;
  /** fees collected on delivery day (not financed) */
  deliverySecurityDeposit: number;
  deliveryRegistration: number;
  deliveryTireTax: number;
  deliveryFeesTotal: number;
  /** cash down (incl. upfront taxes) collected at delivery */
  deliveryCashDown: number;
  /** products paid at delivery (taxes incl.) */
  deliveryProducts: number;
  /** refundable deposit applied against the amount due */
  depositApplied: number;
  /** lease: first payment collected at delivery (included in dueOnDelivery) */
  deliveryFirstPayment: number;
}

export interface DealCalc {
  prov: ProvinceTax;
  taxRate: number;
  leftSubtotal: number;
  luxuryBase: number;
  luxuryTax: number;
  /** tire tax incl. sales taxes, as included in cashTotal */
  tireWithTax: number;
  rightSubtotal: number;
  fiSubtotal: number;
  achatTotal: number;
  tradeCredit: number;
  tradeNet: number;
  taxable: number;
  gst: number;
  pst: number;
  hst: number;
  totalTaxes: number;
  cashTotal: number;
  cashPaid: number;
  soldeDu: number;
  msrp: number;
  options: [OptionResult, OptionResult];
  profit: {
    vehiclePrice: number;
    rows: ProfitRow[];
    reserve: number;
    reserveCommission: number;
    front: number;
    back: number;
    /** dealer fees gross (100%) */
    fees: number;
    total: number;
    totalCommission: number;
  };
}

export interface ProfitRow {
  key: string;
  /** what the row edits: vehicle/accessories pct, a deal product, or dealer fees */
  kind: "vehicle" | "accessories" | "product" | "fees";
  productIndex?: number;
  group: "front" | "back" | "fees";
  label: string;
  /** amount the % is applied to (MSRP for vehicle, selling price for products) */
  base: number;
  baseLabel: string;
  pct: number;
  /** base × pct */
  pctProfit: number;
  /** deductions (vehicle: discount) */
  deduction: number;
  /** additions (vehicle: holdback) */
  addition: number;
  price: number;
  cost: number;
  gross: number;
  commissionPct: number;
  commission: number;
  front: boolean;
}

function pmtArrears(rate: number, n: number, pv: number, fv = 0) {
  if (n <= 0) return 0;
  if (rate === 0) return (pv - fv) / n;
  const f = Math.pow(1 + rate, n);
  return ((pv - fv / f) * rate) / (1 - 1 / f);
}

function pmtAdvance(rate: number, n: number, pv: number, fv = 0) {
  return pmtArrears(rate, n, pv, fv) / (1 + rate);
}

export function computeDeal(
  d: DealData,
  lenders: Lender[],
  excessKmCharge = 0.2,
  lease: LeaseConfig = DEFAULT_LEASE,
): DealCalc {
  const p = d.pricing;
  const prov = getProvince(d.taxProvince);
  const gstR = (prov.hst ? 0 : prov.gst) / 100;
  const pstR = (prov.hst ? 0 : prov.pst) / 100;
  const hstR = prov.hst / 100;
  const taxRate = gstR + pstR + hstR;

  const leftSubtotal = num(p.basePrice) + num(p.options) + num(p.freight);
  // Federal Select Luxury Items Tax (automatic): vehicles over $100,000 →
  // lesser of 10% of the full value or 20% of the amount above $100,000.
  const luxuryBase = r2(leftSubtotal + num(p.adminFees) + num(p.accessories) - num(p.reduction));
  // Select Luxury Items Tax Act — NEW vehicles only (used vehicles previously registered in Canada are exempt):
  // lesser of 20 % of the value above $100,000 or 10 % of the full value. GST/QST apply on top.
  const isNew = d.vehicle.condition === "NEUF";
  const luxuryTax = isNew && luxuryBase > 100000 ? r2(Math.min(luxuryBase * 0.1, (luxuryBase - 100000) * 0.2)) : 0;
  const rightSubtotal = r2(luxuryBase + luxuryTax + num(p.tireTax));
  const fiSubtotal = r2(d.products.reduce((a, x) => a + num(x.price), 0));
  const achatTotal = rightSubtotal + fiSubtotal;

  const tradeCredit = num(d.trade.value) + num(d.trade.ecoTax);
  const tradeNet = tradeCredit - num(d.trade.lien);
  const c = d.cash;

  const taxable = Math.max(0, achatTotal - num(c.rebatePreTax) - tradeCredit);
  const gst = r2(taxable * gstR);
  const pst = r2(taxable * pstR);
  const hst = r2(taxable * hstR);
  const totalTaxes = gst + pst + hst;

  const cashTotal = r2(taxable + totalTaxes);
  const cashPaid = r2(num(c.cashDownPreTax) * (1 + taxRate) + num(c.cashDownTaxIncl));
  const soldeDu = r2(
    cashTotal + num(d.trade.lien) - cashPaid - num(c.rebateTaxIncl) - num(p.rmNonTax) - num(c.deposit) + num(c.deliveryFees),
  );
  const msrp = num(p.basePrice) + num(p.options);

  // Lease / finance: RDPRM/PPSA, tire tax (and security deposit on a lease) are paid on delivery day — never financed.
  const tireInAchat = num(p.tireTax);
  const taxableNoTire = Math.max(0, achatTotal - tireInAchat - num(c.rebatePreTax) - tradeCredit);
  const cashTotalNoTire = r2(taxableNoTire + r2(taxableNoTire * gstR) + r2(taxableNoTire * pstR) + r2(taxableNoTire * hstR));
  const tireWithTax = r2(cashTotal - cashTotalNoTire);

  const groups = productGroups(d);
  const pod = { ...NO_POD, ...(d.payOnDelivery ?? {}) };
  const podPreTax = d.dealType === "cash" ? 0 : r2((pod.warranty ? groups.warranty : 0) + (pod.tireRim ? groups.tireRim : 0) + (pod.fi ? groups.fi : 0) + (pod.accessories ? groups.accessories : 0));

  const optionResults = d.options.map((o) => {
    const lender = lenders.find((l) => l.id === o.lenderId) ?? null;
    const periods = PERIODS[o.frequency] ?? 12;
    const n = Math.round((num(o.term) * periods) / 12);
    const rate = num(o.rate) / 100 / periods;
    const buyRate = rate; // single interest rate
    const reg = num(o.registrationFee);
    const share = lender ? num(lender.reserveShare) / 100 : 0.75;
    const res: OptionResult = {
      lender, periods, n, amountFinanced: 0, payment: 0, taxOnPayment: 0, gstOnPayment: 0, pstOnPayment: 0, totalPayment: 0,
      costOfBorrowing: 0, totalObligation: 0, capCost: 0, residual: 0, upfrontTaxes: 0, upfrontGst: 0, upfrontPst: 0,
      dueOnDelivery: 0, totalLeaseCost: 0, reserve: 0, excessKm: excessKmCharge, totalKms: 0,
      residualPct: o.residualManual ? num(o.residualPct) : lookupResidual(lease.residuals, num(o.term), lender, num(o.residualPct)),
      kmAdjustment: 0,
      kmAdjustmentMonthly: 0,
      deliverySecurityDeposit: 0,
      deliveryRegistration: 0,
      deliveryTireTax: 0,
      deliveryFeesTotal: 0,
      deliveryCashDown: 0,
      deliveryProducts: 0,
      depositApplied: 0,
      deliveryFirstPayment: 0,
    };

    if (d.dealType === "lease") {
      // due on delivery = security deposit + RDPRM/PPSA + tire tax (+ cash down, + products paid upfront) − refundable deposit
      const upGstPre = r2(num(c.cashDownPreTax) * (gstR + hstR));
      const upPstPre = r2(num(c.cashDownPreTax) * pstR);
      const cashDownPart = r2(num(c.cashDownPreTax) + upGstPre + upPstPre + num(c.cashDownTaxIncl));
      const podTaxed = r2(podPreTax * (1 + taxRate));
      const sub = r2(num(o.securityDeposit) + reg + num(o.tireTax) + podTaxed + cashDownPart);
      // refundable deposit can also cover the first payment (the first payment amount is only known after the cap cost; use the
      // payment computed without the excess deposit — a deposit larger than everything due reduces the cap cost below)
      const depApplied = Math.min(num(c.deposit), sub);
      const depExcess = r2(num(c.deposit) - depApplied);
      const capCost = r2(
        achatTotal - num(c.rebatePreTax) - num(c.cashDownPreTax) - num(c.cashDownTaxIncl) / (1 + taxRate) -
          num(c.rebateTaxIncl) / (1 + taxRate) - num(p.rmNonTax) - tradeNet - tireInAchat - podPreTax - depExcess / (1 + taxRate),
      );
      const residual = r2((msrp * res.residualPct) / 100);
      // Residual payment is based on the base km tier (16,000); other tiers add/subtract a monthly $ step,
      // converted automatically to the payment frequency (bi-weekly = monthly × 12 / 26, weekly = × 12 / 52).
      const kmMonthly = kmMonthlyAdjustment(lease.kmTiers, lease.baseKm, num(o.kmPerYear));
      const kmAdj = r2((kmMonthly * 12) / periods);
      res.kmAdjustmentMonthly = kmMonthly;
      res.kmAdjustment = kmAdj;
      const payment = r2(pmtAdvance(rate, n, capCost, residual) + kmAdj);
      const buyPayment = pmtAdvance(buyRate, n, capCost, residual) + kmAdj;
      const gstP = r2(payment * gstR);
      const pstP = r2(payment * (pstR + hstR));
      const upGst = r2(num(c.cashDownPreTax) * (gstR + hstR));
      const upPst = r2(num(c.cashDownPreTax) * pstR);
      res.capCost = capCost;
      res.residual = residual;
      res.payment = payment;
      res.gstOnPayment = gstP;
      res.pstOnPayment = pstP;
      res.taxOnPayment = r2(gstP + pstP);
      res.totalPayment = r2(payment + res.taxOnPayment);
      res.upfrontGst = upGst;
      res.upfrontPst = upPst;
      res.upfrontTaxes = r2(upGst + upPst);
      res.amountFinanced = capCost;
      res.costOfBorrowing = r2(payment * n - (capCost - residual));
      res.totalLeaseCost = r2(res.totalPayment * n);
      res.totalObligation = res.totalLeaseCost;
      res.deliverySecurityDeposit = num(o.securityDeposit);
      res.deliveryRegistration = reg;
      res.deliveryTireTax = num(o.tireTax);
      res.deliveryFeesTotal = r2(res.deliverySecurityDeposit + reg + res.deliveryTireTax);
      res.deliveryCashDown = cashDownPart;
      res.deliveryProducts = podTaxed;
      res.depositApplied = r2(depApplied);
      res.deliveryFirstPayment = res.totalPayment;
      // due on delivery = security deposit + RDPRM + tire tax (+ cash, + products) − refundable deposit + first payment
      res.dueOnDelivery = r2(sub - depApplied + res.totalPayment);
      res.totalKms = Math.round((num(o.kmPerYear) * num(o.term)) / 12) + (parseInt(d.vehicle.kms) || 0);
      res.reserve = buyRate < rate ? r2((payment - buyPayment) * n * share) : 0;
    } else if (d.dealType === "finance") {
      const podTaxed = r2(podPreTax * (1 + taxRate));
      const sub = r2(reg + num(o.tireTax) + podTaxed + cashPaid);
      const depApplied = Math.min(num(c.deposit), sub);
      const depExcess = r2(num(c.deposit) - depApplied);
      // soldeDu already deducted the full deposit — only the excess (not used at delivery) reduces the loan
      const af = r2(soldeDu + num(c.deposit) - depExcess - tireWithTax - podTaxed);
      const payment = r2(pmtArrears(rate, n, af));
      const buyPayment = pmtArrears(buyRate, n, af);
      res.amountFinanced = af;
      res.payment = payment;
      res.totalPayment = payment;
      res.totalObligation = r2(payment * n);
      res.costOfBorrowing = r2(payment * n - af);
      res.deliveryRegistration = reg;
      res.deliveryTireTax = num(o.tireTax);
      res.deliveryFeesTotal = r2(reg + res.deliveryTireTax);
      res.deliveryCashDown = cashPaid;
      res.deliveryProducts = podTaxed;
      res.depositApplied = r2(depApplied);
      res.dueOnDelivery = r2(sub - depApplied);
      res.reserve = buyRate < rate ? r2((payment - buyPayment) * n * share) : 0;
    } else {
      res.amountFinanced = 0;
      res.totalObligation = soldeDu;
      res.dueOnDelivery = soldeDu;
    }
    return res;
  }) as [OptionResult, OptionResult];

  // Profit analysis
  const pr = d.profit;
  const vehiclePrice = msrp - num(p.reduction);
  /**
   * Cost is ALWAYS derived from the % :  cost = base × (1 − %).
   *  - Vehicle: base = MSRP (base price + options), selling price = MSRP − Réduction.
   *  - Products: base = selling price.
   * Profit = selling price − cost (+ holdback for the vehicle). Recalculates automatically.
   */
  const mk = (
    key: string,
    kind: ProfitRow["kind"],
    group: ProfitRow["group"],
    label: string,
    base: number,
    baseLabel: string,
    price: number,
    pct: number,
    commissionPct: number,
    deduction = 0,
    addition = 0,
    productIndex?: number,
  ): ProfitRow => {
    const pctProfit = r2((base * pct) / 100);
    const cost = r2(base - pctProfit);
    const gross = r2(price - cost + addition);
    return {
      key, kind, group, productIndex, label, base: r2(base), baseLabel, pct, pctProfit, deduction: r2(deduction), addition: r2(addition),
      price: r2(price), cost, gross,
      commissionPct, commission: r2((Math.max(0, gross) * commissionPct) / 100), front: group === "front",
    };
  };
  const reduction = num(p.reduction);
  const rows: ProfitRow[] = [
    mk("vehicle", "vehicle", "front", "Véhicule", msrp, "PDSF / MSRP", msrp - reduction, num(pr.pct?.vehicle), num(pr.commission.vehicle), reduction, num(pr.holdback)),
    mk("accessories", "accessories", "front", "Accessoires", num(p.accessories), "Prix vente", num(p.accessories), num(pr.pct?.accessories), num(pr.commission.accessories)),
    ...d.products.map((x, i) =>
      mk(`p:${x.id}`, "product", x.group, x.name, num(x.price), "Prix vente", num(x.price), num(x.pct), num(x.commission), 0, 0, i),
    ),
    // Dealer fees ("Frais" on the Achat screen) — 100% profit
    mk("fees", "fees", "fees", "Frais de concession", num(p.adminFees), "Prix vente", num(p.adminFees), 100, num(pr.commission.fees)),
  ];
  const reserve = optionResults[0].reserve;
  const reserveCommission = r2((reserve * num(pr.commission.reserve)) / 100);
  const front = r2(rows.filter((r) => r.group === "front").reduce((a, r) => a + r.gross, 0));
  const back = r2(rows.filter((r) => r.group === "back").reduce((a, r) => a + r.gross, 0) + reserve);
  const fees = r2(rows.filter((r) => r.group === "fees").reduce((a, r) => a + r.gross, 0));

  return {
    prov, taxRate, leftSubtotal, luxuryBase, luxuryTax, tireWithTax, rightSubtotal, fiSubtotal, achatTotal, tradeCredit, tradeNet, taxable, gst, pst, hst,
    totalTaxes, cashTotal, cashPaid, soldeDu, msrp, options: optionResults,
    profit: {
      vehiclePrice, rows, reserve, reserveCommission, front, back, fees, total: r2(front + back + fees),
      totalCommission: r2(rows.reduce((a, r) => a + r.commission, 0) + reserveCommission),
    },
  };
}

/** "47 980.00" style used on the desking screen */
export function fmtDesk(n: number): string {
  const v = num(n);
  const neg = v < 0;
  const [i, dec] = Math.abs(v).toFixed(2).split(".");
  return (neg ? "-" : "") + i.replace(/\B(?=(\d{3})+(?!\d))/g, " ") + "." + dec;
}

/** "$64,100.00" / "($2,650.00)" style used on printed sheets */
export function money(n: number, parens = false): string {
  const v = num(n);
  const s = "$" + Math.abs(v).toLocaleString("en-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (v < 0) return parens ? `(${s})` : `-${s}`;
  return s;
}

/** Terms offered on leases & finance — the dealership list from Settings (same for every lender). */
export function availableTerms(_lender: Lender | null, _type: DealType, terms?: number[]): number[] {
  void _lender;
  void _type;
  const t = (terms?.length ? terms : DEFAULT_DEAL_TERMS).map(Number).filter((n) => n > 0);
  return Array.from(new Set(t)).sort((a, b) => a - b);
}

/** Linear interpolation / nearest extrapolation in a { term: value } table. */
export function interpolateByTerm(
  table: Record<string, number> | undefined,
  term: number,
  opts: { extrapolate?: boolean; min?: number; max?: number } = {},
): number | null {
  const pts = Object.entries(table ?? {})
    .map(([k, v]) => [Number(k), Number(v)] as [number, number])
    .filter(([k, v]) => k > 0 && isFinite(v))
    .sort((a, b) => a[0] - b[0]);
  if (!pts.length) return null;
  const exact = pts.find(([k]) => k === term);
  if (exact) return exact[1];
  const clamp = (v: number) => Math.round(Math.min(opts.max ?? Infinity, Math.max(opts.min ?? -Infinity, v)) * 100) / 100;
  if (term <= pts[0][0]) {
    if (!opts.extrapolate || pts.length < 2) return pts[0][1];
    const [[k1, v1], [k2, v2]] = pts;
    return clamp(v1 - ((v2 - v1) * (k1 - term)) / (k2 - k1));
  }
  if (term >= pts[pts.length - 1][0]) {
    if (!opts.extrapolate || pts.length < 2) return pts[pts.length - 1][1];
    const [k1, v1] = pts[pts.length - 2];
    const [k2, v2] = pts[pts.length - 1];
    return clamp(v2 + ((v2 - v1) * (term - k2)) / (k2 - k1));
  }
  for (let i = 1; i < pts.length; i++) {
    const [k1, v1] = pts[i - 1];
    const [k2, v2] = pts[i];
    if (term < k2) return Math.round((v1 + ((v2 - v1) * (term - k1)) / (k2 - k1)) * 100) / 100;
  }
  return null;
}

/** Lender rate for any term (exact rate if defined, otherwise interpolated from its grid). */
export function lenderRate(lender: Lender, type: DealType, term: number): number | null {
  return interpolateByTerm(type === "lease" ? lender.leaseRates : lender.financeRates, term, { extrapolate: true, min: 0, max: 29.99 });
}

export function vehicleLabel(d: DealData) {
  return [d.vehicle.year, d.vehicle.make, d.vehicle.model, d.vehicle.trim].filter(Boolean).join(" ");
}
export function customerLabel(d: DealData) {
  return [d.customer.firstName, d.customer.lastName].filter(Boolean).join(" ");
}


/* ---------------------------------------------------------------- Rollback (payment → down payment) */

export type RollbackMode = "cash" | "rebate" | "discount";

export interface RollbackResult {
  /** total amount of the chosen field needed (new value to set) */
  newValue: number;
  /** additional amount vs current value (negative = room to spare) */
  delta: number;
  /** resulting payment after applying */
  resultPayment: number;
  currentPayment: number;
  feasible: boolean;
}

function rollbackGet(d: DealData, mode: RollbackMode): number {
  if (mode === "discount") return d.pricing.reduction;
  if (mode === "rebate") return d.cash.rebatePreTax;
  return d.dealType === "lease" ? d.cash.cashDownPreTax : d.cash.cashDownTaxIncl;
}
function rollbackSet(d: DealData, mode: RollbackMode, v: number) {
  if (mode === "discount") d.pricing.reduction = v;
  else if (mode === "rebate") d.cash.rebatePreTax = v;
  else if (d.dealType === "lease") d.cash.cashDownPreTax = v;
  else d.cash.cashDownTaxIncl = v;
}

/** Applies a rollback to a copy of the deal (sets the field + frequency). */
export function applyRollback(d: DealData, idx: 0 | 1, mode: RollbackMode, value: number, frequency: Frequency) {
  d.options[idx].frequency = frequency;
  rollbackSet(d, mode, Math.max(0, r2(value)));
}

/**
 * Solve the down payment / rebate / discount needed so the option's total payment
 * (taxes incl.) equals the target. Payment is linear in these amounts, so two
 * evaluations + one refinement give the exact answer.
 */
export function solveRollback(
  d: DealData,
  lenders: Lender[],
  idx: 0 | 1,
  target: number,
  frequency: Frequency,
  mode: RollbackMode,
  excessKmCharge = 0.2,
  lease: LeaseConfig = DEFAULT_LEASE,
): RollbackResult {
  const base = structuredClone(d);
  base.options[idx].frequency = frequency;
  const cur = rollbackGet(base, mode);
  const pay = (v: number) => {
    const x = structuredClone(base);
    rollbackSet(x, mode, v);
    return computeDeal(x, lenders, excessKmCharge, lease).options[idx].totalPayment;
  };
  const p0 = pay(cur);
  const p1 = pay(cur + 1000);
  const slope = (p1 - p0) / 1000;
  if (!isFinite(slope) || slope >= 0 || target <= 0) {
    return { newValue: cur, delta: 0, resultPayment: p0, currentPayment: p0, feasible: false };
  }
  let v = cur + (target - p0) / slope;
  // refine (handles tax floors / rounding)
  for (let k = 0; k < 3; k++) {
    const pv = pay(Math.max(0, v));
    if (Math.abs(pv - target) < 0.005) break;
    v = v + (target - pv) / slope;
  }
  // round up to the cent so payment ≤ target
  v = Math.ceil(Math.max(0, v) * 100) / 100;
  const resultPayment = pay(v);
  return { newValue: v, delta: r2(v - cur), resultPayment, currentPayment: p0, feasible: v >= 0 };
}


/** Purchased extras (accessories, warranty, tire & rim, other F&I) — for the description & printed sheet. */
export function purchasedItems(d: DealData): { name: string; detail?: string; price: number }[] {
  const out: { name: string; detail?: string; price: number }[] = [];
  for (const a of d.accessoryItems ?? []) if (a.price > 0 || a.name) out.push({ name: a.name, price: a.price });
  if (!d.accessoryItems?.length && d.pricing.accessories > 0) out.push({ name: "Accessoires", price: d.pricing.accessories });
  for (const p of d.products ?? []) if (p.price > 0) out.push({ name: p.name, detail: p.term ? `${p.term}` : undefined, price: p.price });
  return out;
}
