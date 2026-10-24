/** Credit application data model (shared by the form, API and printed document). */

export interface Person {
  title: string;
  firstName: string;
  middleName: string;
  lastName: string;
  dob: string;
  sin: string;
  maritalStatus: string;
  dependents: string;
  email: string;
  mobile: string;
  homePhone: string;
  workPhone: string;
  licenseNo: string;
  licenseProv: string;
  // address
  address: string;
  unit: string;
  city: string;
  province: string;
  postal: string;
  residenceType: string;
  housingPayment: string;
  yearsAtAddress: string;
  monthsAtAddress: string;
  landlord: string;
  prevAddress: string;
  prevYears: string;
  // employment
  employmentType: string;
  employer: string;
  occupation: string;
  employerAddress: string;
  employerPhone: string;
  yearsEmployed: string;
  monthsEmployed: string;
  grossIncome: string;
  incomeFrequency: string;
  prevEmployer: string;
  prevYearsEmployed: string;
  otherIncome: string;
  otherIncomeSource: string;
}

export type TradeType = "R" | "I" | "O" | "M";
export interface Tradeline {
  creditor: string;
  type: TradeType;
  opened: string;
  limit: string;
  balance: string;
  payment: string;
  pastDue: string;
  rating: string;
  late30: string;
  late60: string;
  late90: string;
  status: string;
}
export interface Inquiry {
  date: string;
  member: string;
}
export interface Collection {
  date: string;
  agency: string;
  creditor: string;
  amount: string;
  status: string;
}
export interface PublicRecord {
  type: string;
  date: string;
  amount: string;
  status: string;
}
export interface Bureau {
  score: string;
  pulledAt: string;
  fileSince: string;
  reference: string;
  bookValue: string;
  testRate: string;
  testTerm: string;
  tradelines: Tradeline[];
  inquiries: Inquiry[];
  collections: Collection[];
  publicRecords: PublicRecord[];
  alerts: string;
  /** "" = empty · simulated = generated automatically from the application · manual = entered from a real report */
  source?: "" | "simulated" | "manual";
}
export type DecisionStatus = "" | "approved" | "conditional" | "declined";
export interface Decision {
  status: DecisionStatus;
  conditions: string[];
  requiredDown: string;
  approvedAmount: string;
  approvedRate: string;
  approvedTerm: string;
  lender: string;
  notes: string;
  decidedBy: string;
  decidedAt: string;
  /** true (default) = decision follows the automatic engine · false = manager override */
  auto?: boolean;
}

export interface CreditData {
  /** linked quotation (deal) number */
  quoteNumber: string;
  lender: string;
  rate: string;
  payment: string;
  paymentFrequency: string;
  lienPayout: string;
  taxes: string;
  residual: string;
  bureau: Bureau;
  decision: Decision;
  applicant: Person;
  hasCoApplicant: boolean;
  coApplicant: Person;
  coRelation: string;
  // vehicle & financing
  vehicle: string;
  vin: string;
  price: string;
  downPayment: string;
  tradeIn: string;
  amountRequested: string;
  termRequested: string;
  dealType: string;
  // finances
  bank: string;
  bankBranch: string;
  accountType: string;
  monthlyDebts: string;
  creditCards: string;
  otherLoans: string;
  bankruptcy: string;
  bankruptcyDetails: string;
  // references
  ref1Name: string;
  ref1Phone: string;
  ref1Relation: string;
  ref2Name: string;
  ref2Phone: string;
  ref2Relation: string;
  notes: string;
  consent: boolean;
  consentDate: string;
}

export const emptyPerson = (): Person => ({
  title: "", firstName: "", middleName: "", lastName: "", dob: "", sin: "", maritalStatus: "", dependents: "", email: "", mobile: "", homePhone: "",
  workPhone: "", licenseNo: "", licenseProv: "QC", address: "", unit: "", city: "", province: "QC", postal: "", residenceType: "", housingPayment: "",
  yearsAtAddress: "", monthsAtAddress: "", landlord: "", prevAddress: "", prevYears: "", employmentType: "", employer: "", occupation: "",
  employerAddress: "", employerPhone: "", yearsEmployed: "", monthsEmployed: "", grossIncome: "", incomeFrequency: "annual", prevEmployer: "",
  prevYearsEmployed: "", otherIncome: "", otherIncomeSource: "",
});

export const emptyTradeline = (): Tradeline => ({ creditor: "", type: "R", opened: "", limit: "", balance: "", payment: "", pastDue: "", rating: "1", late30: "", late60: "", late90: "", status: "open" });
export const emptyBureau = (): Bureau => ({
  score: "", pulledAt: "", fileSince: "", reference: "", bookValue: "", testRate: "12.99", testTerm: "", tradelines: [], inquiries: [], collections: [], publicRecords: [], alerts: "", source: "",
});
export const emptyDecision = (): Decision => ({
  status: "", conditions: [], requiredDown: "", approvedAmount: "", approvedRate: "", approvedTerm: "", lender: "", notes: "", decidedBy: "", decidedAt: "", auto: true,
});

export const emptyCredit = (): CreditData => ({
  quoteNumber: "", lender: "", rate: "", payment: "", paymentFrequency: "monthly", lienPayout: "", taxes: "", residual: "",
  bureau: emptyBureau(), decision: emptyDecision(),
  applicant: emptyPerson(), hasCoApplicant: false, coApplicant: emptyPerson(), coRelation: "", vehicle: "", vin: "", price: "", downPayment: "",
  tradeIn: "", amountRequested: "", termRequested: "", dealType: "finance", bank: "", bankBranch: "", accountType: "", monthlyDebts: "",
  creditCards: "", otherLoans: "", bankruptcy: "no", bankruptcyDetails: "", ref1Name: "", ref1Phone: "", ref1Relation: "", ref2Name: "",
  ref2Phone: "", ref2Relation: "", notes: "", consent: false, consentDate: "",
});

export function normalizeCredit(raw: unknown): CreditData {
  const r = (raw ?? {}) as Partial<CreditData>;
  const e = emptyCredit();
  return {
    ...e,
    ...r,
    applicant: { ...e.applicant, ...(r.applicant ?? {}) },
    coApplicant: { ...e.coApplicant, ...(r.coApplicant ?? {}) },
    bureau: {
      ...e.bureau,
      ...(r.bureau ?? {}),
      tradelines: Array.isArray(r.bureau?.tradelines) ? r.bureau!.tradelines.map((x) => ({ ...emptyTradeline(), ...x })) : [],
      inquiries: Array.isArray(r.bureau?.inquiries) ? r.bureau!.inquiries : [],
      collections: Array.isArray(r.bureau?.collections) ? r.bureau!.collections : [],
      publicRecords: Array.isArray(r.bureau?.publicRecords) ? r.bureau!.publicRecords : [],
    },
    decision: { ...e.decision, ...(r.decision ?? {}), conditions: Array.isArray(r.decision?.conditions) ? r.decision!.conditions : [] },
  };
}

/* ---------------------------------------------------------------- quotation link */

export interface DealFinancing {
  dealId: number;
  dealNumber: string;
  quoteNumber: string;
  dealType: string;
  vehicle: string;
  vin: string;
  price: number;
  downPayment: number;
  tradeIn: number;
  lienPayout: number;
  taxes: number;
  amountFinanced: number;
  term: number;
  rate: number;
  lender: string;
  payment: number;
  frequency: string;
  residual: number;
  customerId: number | null;
  customer: { firstName: string; lastName: string; email: string; mobile: string; homePhone: string; address: string; city: string; province: string; postal: string };
}

const s2 = (n: number) => (n ? String(Math.round(n * 100) / 100) : "");

/** Copy a quotation's financing structure into the credit application. */
export function applyFinancing(d: CreditData, f: DealFinancing): CreditData {
  const x: CreditData = { ...d, applicant: { ...d.applicant }, bureau: { ...d.bureau } };
  x.quoteNumber = f.dealNumber;
  x.vehicle = f.vehicle;
  x.vin = f.vin;
  x.dealType = f.dealType === "lease" ? "lease" : "finance";
  x.price = s2(f.price);
  x.downPayment = s2(f.downPayment);
  x.tradeIn = s2(f.tradeIn);
  x.lienPayout = s2(f.lienPayout);
  x.taxes = s2(f.taxes);
  x.amountRequested = s2(f.amountFinanced);
  x.termRequested = f.term ? String(f.term) : "";
  x.rate = f.rate ? String(f.rate) : "";
  x.lender = f.lender;
  x.payment = s2(f.payment);
  x.paymentFrequency = f.frequency;
  x.residual = s2(f.residual);
  if (!x.bureau.bookValue) x.bureau.bookValue = s2(f.price);
  if (!x.bureau.testTerm) x.bureau.testTerm = f.term ? String(f.term) : "";
  const a = x.applicant;
  const c = f.customer;
  a.firstName ||= c.firstName;
  a.lastName ||= c.lastName;
  a.email ||= c.email;
  a.mobile ||= c.mobile;
  a.homePhone ||= c.homePhone;
  a.address ||= c.address;
  a.city ||= c.city;
  a.province = a.province || c.province || "QC";
  a.postal ||= c.postal;
  return x;
}

/* ---------------------------------------------------------------- scoring & metrics */

export const num = (v: string | number | undefined) => Number(String(v ?? "").replace(/[^\d.-]/g, "")) || 0;

export const SCORE_BANDS: { min: number; max: number; fr: string; en: string; color: string }[] = [
  { min: 300, max: 559, fr: "TRÈS FAIBLE", en: "VERY POOR", color: "#c0392b" },
  { min: 560, max: 659, fr: "PASSABLE", en: "FAIR", color: "#e67e22" },
  { min: 660, max: 724, fr: "BON", en: "GOOD", color: "#d4ac0d" },
  { min: 725, max: 759, fr: "TRÈS BON", en: "VERY GOOD", color: "#7cb342" },
  { min: 760, max: 900, fr: "EXCELLENT", en: "EXCELLENT", color: "#2e9a57" },
];
export function scoreBand(score: number) {
  const s = Math.max(300, Math.min(900, score || 300));
  return SCORE_BANDS.find((b) => s >= b.min && s <= b.max) ?? SCORE_BANDS[0];
}

export function monthlyPayment(principal: number, annualRate: number, months: number) {
  if (principal <= 0 || months <= 0) return 0;
  const r = annualRate / 100 / 12;
  if (!r) return principal / months;
  return (principal * r) / (1 - Math.pow(1 + r, -months));
}
export function presentValue(payment: number, annualRate: number, months: number) {
  if (payment <= 0 || months <= 0) return 0;
  const r = annualRate / 100 / 12;
  if (!r) return payment * months;
  return (payment * (1 - Math.pow(1 + r, -months))) / r;
}

export interface CreditMetrics {
  monthlyIncome: number;
  taxes: number;
  amountFinanced: number;
  negativeEquity: number;
  bookValue: number;
  ltv: number;
  revolvingBalance: number;
  revolvingLimit: number;
  revolvingUtil: number;
  testRate: number;
  testTerm: number;
  estPayment: number;
  pti: number;
  housing: number;
  otherDebts: number;
  tds: number;
  tradeCount: number;
  inquiries12: number;
  openCollections: number;
  late30: number;
  late60: number;
  late90: number;
  activePublic: number;
  dischargedPublic: number;
}

export function creditMetrics(d: CreditData): CreditMetrics {
  const inc = (p: Person) => annualIncome(p) + num(p.otherIncome);
  const monthlyIncome = (inc(d.applicant) + (d.hasCoApplicant ? inc(d.coApplicant) : 0)) / 12;
  const amountFinanced = num(d.amountRequested);
  const negativeEquity = Math.max(0, num(d.lienPayout) - num(d.tradeIn));
  const bookValue = num(d.bureau.bookValue);
  const ltv = bookValue > 0 ? (amountFinanced / bookValue) * 100 : 999;
  const rev = d.bureau.tradelines.filter((t) => t.type === "R" && t.status !== "closed");
  const revolvingBalance = rev.reduce((a, t) => a + num(t.balance), 0);
  const revolvingLimit = rev.reduce((a, t) => a + num(t.limit), 0);
  const revolvingUtil = revolvingLimit > 0 ? (revolvingBalance / revolvingLimit) * 100 : 0;
  const testRate = num(d.bureau.testRate) || 12.99;
  const testTerm = num(d.bureau.testTerm) || num(d.termRequested) || 72;
  const estPayment = monthlyPayment(amountFinanced, testRate, testTerm);
  const pti = monthlyIncome > 0 ? (estPayment / monthlyIncome) * 100 : 999;
  const housing = num(d.applicant.housingPayment) + (d.hasCoApplicant ? num(d.coApplicant.housingPayment) : 0);
  const tradePayments = d.bureau.tradelines.filter((t) => t.status !== "closed" && t.type !== "M").reduce((a, t) => a + num(t.payment), 0);
  const otherDebts = tradePayments || num(d.monthlyDebts);
  const tds = monthlyIncome > 0 ? ((estPayment + housing + otherDebts) / monthlyIncome) * 100 : 999;
  const year = Date.now() - 365 * 86400000;
  return {
    monthlyIncome,
    taxes: num(d.taxes),
    amountFinanced,
    negativeEquity,
    bookValue,
    ltv,
    revolvingBalance,
    revolvingLimit,
    revolvingUtil,
    testRate,
    testTerm,
    estPayment,
    pti,
    housing,
    otherDebts,
    tds,
    tradeCount: d.bureau.tradelines.length,
    inquiries12: d.bureau.inquiries.filter((q) => !q.date || new Date(q.date).getTime() >= year).length,
    openCollections: d.bureau.collections.filter((c) => c.status !== "paid").length,
    late30: d.bureau.tradelines.reduce((a, t) => a + num(t.late30), 0),
    late60: d.bureau.tradelines.reduce((a, t) => a + num(t.late60), 0),
    late90: d.bureau.tradelines.reduce((a, t) => a + num(t.late90), 0),
    activePublic: d.bureau.publicRecords.filter((p) => p.status === "active").length,
    dischargedPublic: d.bureau.publicRecords.filter((p) => p.status !== "active").length,
  };
}

/** Conditions offered on a conditional approval [key, FR, EN] */
export const CONDITIONS: [string, string, string][] = [
  ["higher_down", "Mise de fonds supplémentaire", "Higher down payment"],
  ["cosigner", "Co-signataire requis", "Co-signer required"],
  ["poi", "Preuve de revenu (2 talons de paie / avis de cotisation)", "Proof of income (2 pay stubs / notice of assessment)"],
  ["employment", "Lettre d'emploi", "Employment letter"],
  ["residence", "Preuve de résidence", "Proof of residence"],
  ["reduce_amount", "Réduire le montant financé", "Reduce the amount financed"],
  ["shorter_term", "Terme plus court", "Shorter term"],
  ["higher_rate", "Taux ajusté au risque", "Risk-adjusted rate"],
  ["trade_lien", "Confirmation du solde de l'échange (équité négative)", "Trade payout confirmation (negative equity)"],
  ["bankruptcy_discharge", "Preuve de libération de faillite / proposition", "Proof of bankruptcy / proposal discharge"],
  ["insurance", "Preuve d'assurance avant livraison", "Proof of insurance before delivery"],
  ["references", "Vérification des références", "Reference verification"],
];

export interface Suggestion {
  status: DecisionStatus;
  reasons: [string, string][];
  conditions: string[];
  requiredDown: number;
  maxFinance: number;
}

/** Rule-based recommendation (guidance only — the manager makes the final decision). */
export function suggestDecision(d: CreditData, m: CreditMetrics): Suggestion {
  const score = num(d.bureau.score);
  const reasons: [string, string][] = [];
  const cond = new Set<string>();
  if (!score) return { status: "", reasons: [["Entrez le pointage de crédit pour obtenir une recommandation.", "Enter the credit score to get a recommendation."]], conditions: [], requiredDown: 0, maxFinance: 0 };
  let level = 0; // 0 approve, 1 conditional, 2 decline
  const bump = (l: number, r: [string, string]) => {
    level = Math.max(level, l);
    reasons.push(r);
  };
  const pct = (n: number) => (n >= 999 ? "—" : `${n.toFixed(1)} %`);
  if (score < 520) bump(2, [`Pointage ${score} trop faible (minimum 520).`, `Score ${score} too low (minimum 520).`]);
  else if (score < 660) bump(1, [`Pointage ${score} sous le seuil prime (660).`, `Score ${score} below prime threshold (660).`]);
  if (m.activePublic > 0) bump(2, ["Faillite ou proposition non libérée au dossier.", "Undischarged bankruptcy or proposal on file."]);
  if (m.dischargedPublic > 0) {
    bump(1, ["Faillite / proposition libérée au dossier.", "Discharged bankruptcy / proposal on file."]);
    cond.add("bankruptcy_discharge");
  }
  if (m.openCollections > 0) bump(1, [`${m.openCollections} recouvrement(s) non payé(s).`, `${m.openCollections} unpaid collection(s).`]);
  if (m.late90 > 0) bump(1, [`${m.late90} retard(s) de 90 jours et plus.`, `${m.late90} payment(s) 90+ days late.`]);
  if (m.monthlyIncome <= 0) {
    bump(1, ["Revenu non déclaré.", "Income not provided."]);
    cond.add("poi");
  } else {
    if (m.pti > 30) bump(2, [`Ratio paiement/revenu (PTI) ${pct(m.pti)} > 30 %.`, `Payment-to-income (PTI) ${pct(m.pti)} > 30%.`]);
    else if (m.pti > 15) bump(1, [`PTI ${pct(m.pti)} > 15 %.`, `PTI ${pct(m.pti)} > 15%.`]);
    if (m.tds > 60) bump(2, [`Ratio d'endettement total (TDS) ${pct(m.tds)} > 60 %.`, `Total debt service (TDS) ${pct(m.tds)} > 60%.`]);
    else if (m.tds > 42) bump(1, [`TDS ${pct(m.tds)} > 42 %.`, `TDS ${pct(m.tds)} > 42%.`]);
  }
  if (m.bookValue > 0) {
    if (m.ltv > 175) bump(2, [`Ratio prêt/valeur (LTV) ${pct(m.ltv)} > 175 %.`, `Loan-to-value (LTV) ${pct(m.ltv)} > 175%.`]);
    else if (m.ltv > 125) bump(1, [`LTV ${pct(m.ltv)} > 125 %.`, `LTV ${pct(m.ltv)} > 125%.`]);
  }
  if (m.revolvingUtil > 75) {
    bump(1, [`Utilisation du crédit renouvelable ${m.revolvingUtil.toFixed(0)} % > 75 %.`, `Revolving utilization ${m.revolvingUtil.toFixed(0)}% > 75%.`]);
    cond.add("higher_rate");
  }
  if (m.negativeEquity > 0) cond.add("trade_lien");
  if (num(d.applicant.yearsEmployed) < 1 && d.applicant.employmentType !== "retired") cond.add("employment");
  if (d.applicant.employmentType === "self") cond.add("poi");
  if (num(d.applicant.yearsAtAddress) < 1) cond.add("residence");

  // financing capacity: LTV 120 % of book value and PTI 15 %
  const maxByLtv = m.bookValue > 0 ? m.bookValue * 1.2 : Infinity;
  const maxByPti = m.monthlyIncome > 0 ? presentValue(m.monthlyIncome * 0.15, m.testRate, m.testTerm) : Infinity;
  const maxFinance = Math.min(maxByLtv, maxByPti);
  const requiredDown = isFinite(maxFinance) ? Math.max(0, Math.ceil((m.amountFinanced - maxFinance) / 100) * 100) : 0;
  if (requiredDown > 0) {
    cond.add("higher_down");
    cond.add("reduce_amount");
  }
  if (score < 620 || m.tds > 42) cond.add("cosigner");
  if (level >= 1) cond.add("insurance");
  if (level === 0) reasons.push(["Le dossier respecte les critères d'approbation.", "File meets approval criteria."]);
  return {
    status: level === 2 ? "declined" : level === 1 ? "conditional" : "approved",
    reasons,
    conditions: level === 0 ? [] : Array.from(cond),
    requiredDown,
    maxFinance: isFinite(maxFinance) ? Math.floor(maxFinance) : 0,
  };
}

/** Option lists [value, FR, EN] */
export const OPT = {
  title: [["", "—", "—"], ["M.", "M.", "Mr."], ["Mme", "Mme", "Mrs./Ms."]],
  marital: [["", "—", "—"], ["single", "Célibataire", "Single"], ["married", "Marié(e)", "Married"], ["common", "Conjoint de fait", "Common-law"], ["separated", "Séparé(e)", "Separated"], ["divorced", "Divorcé(e)", "Divorced"], ["widowed", "Veuf(ve)", "Widowed"]],
  residence: [["", "—", "—"], ["own", "Propriétaire", "Own"], ["rent", "Locataire", "Rent"], ["parents", "Chez les parents", "With parents"], ["other", "Autre", "Other"]],
  employment: [["", "—", "—"], ["full", "Temps plein", "Full-time"], ["part", "Temps partiel", "Part-time"], ["self", "Travailleur autonome", "Self-employed"], ["retired", "Retraité(e)", "Retired"], ["student", "Étudiant(e)", "Student"], ["other", "Autre", "Other"]],
  incomeFreq: [["annual", "Annuel", "Annual"], ["monthly", "Mensuel", "Monthly"], ["biweekly", "Aux 2 semaines", "Bi-weekly"], ["weekly", "Hebdomadaire", "Weekly"], ["hourly", "Horaire", "Hourly"]],
  account: [["", "—", "—"], ["chequing", "Chèques", "Chequing"], ["savings", "Épargne", "Savings"], ["both", "Chèques et épargne", "Chequing & savings"]],
  dealType: [["finance", "Financement", "Finance"], ["lease", "Location", "Lease"]],
  status: [["draft", "Brouillon", "Draft"], ["submitted", "Soumise au prêteur", "Submitted to lender"], ["approved", "Approuvée", "Approved"], ["conditional", "Approuvée avec conditions", "Conditionally approved"], ["declined", "Refusée", "Declined"]],
} as const;

export const optLabel = (list: readonly (readonly string[])[], v: string, lang: "fr" | "en") => list.find((x) => x[0] === v)?.[lang === "fr" ? 1 : 2] ?? v;

/** Annualized income from amount + frequency */
export function annualIncome(p: Person): number {
  const n = Number(String(p.grossIncome).replace(/[^\d.]/g, "")) || 0;
  const f: Record<string, number> = { annual: 1, monthly: 12, biweekly: 26, weekly: 52, hourly: 2080 };
  return n * (f[p.incomeFrequency] ?? 1);
}

export const maskSin = (s: string) => {
  const d = s.replace(/\D/g, "");
  return d.length >= 3 ? `***-***-${d.slice(-3)}` : "";
};


/* ---------------------------------------------------------------- automatic report & decision */

function hashSeed(str: string) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function rng(seed: number) {
  let a = seed || 1;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Enough information to run the automatic credit analysis. */
export function readyForAuto(d: CreditData) {
  return Boolean(d.applicant.firstName.trim() && d.applicant.lastName.trim() && annualIncome(d.applicant) > 0 && num(d.amountRequested) > 0);
}

/**
 * Simulated credit report built from the application (income, employment, residence, debts, bankruptcy).
 * Deterministic for the same applicant. NOT a real Equifax pull.
 */
export function simulateBureau(d: CreditData, today = new Date()): Bureau {
  const a = d.applicant;
  const r = rng(hashSeed(`${a.firstName}|${a.lastName}|${a.dob}|${a.sin}|${a.postal}`.toLowerCase()));
  const income = annualIncome(a) + num(a.otherIncome);
  let score = 690;
  if (income >= 120000) score += 45;
  else if (income >= 80000) score += 30;
  else if (income >= 55000) score += 12;
  else if (income < 35000) score -= 40;
  const yEmp = num(a.yearsEmployed);
  if (yEmp >= 5) score += 20;
  else if (yEmp >= 2) score += 8;
  else if (a.employmentType !== "retired") score -= 25;
  if (a.employmentType === "self") score -= 10;
  if (a.employmentType === "student") score -= 30;
  const yAddr = num(a.yearsAtAddress);
  if (yAddr >= 5) score += 15;
  else if (yAddr < 1) score -= 15;
  if (a.residenceType === "own") score += 25;
  else if (a.residenceType === "parents") score -= 5;
  const cards = num(d.creditCards);
  const loans = num(d.otherLoans);
  if (income > 0 && (cards + loans) / income > 0.6) score -= 45;
  else if (income > 0 && (cards + loans) / income > 0.3) score -= 20;
  const bankrupt = d.bankruptcy === "yes";
  if (bankrupt) score -= 170;
  const dob = a.dob ? new Date(a.dob) : null;
  const age = dob && !isNaN(dob.getTime()) ? Math.floor((today.getTime() - dob.getTime()) / (365.25 * 86400000)) : 35;
  if (age < 23) score -= 30;
  score += Math.round((r() - 0.5) * 90);
  score = Math.max(300, Math.min(900, score));

  const sinceYear = Math.max(today.getFullYear() - Math.max(1, age - 19), today.getFullYear() - 30);
  const month = (yearsAgo: number) => {
    const x = new Date(today);
    x.setMonth(x.getMonth() - Math.round(yearsAgo * 12));
    return x.toISOString().slice(0, 7);
  };
  const poor = score < 620;
  const veryPoor = score < 560;
  const util = score >= 760 ? 0.08 + r() * 0.15 : score >= 700 ? 0.2 + r() * 0.25 : score >= 620 ? 0.45 + r() * 0.3 : 0.75 + r() * 0.3;
  const lim = (v: number) => Math.max(500, Math.round(v / 500) * 500);
  const tl: Tradeline[] = [];
  const cardLimit = lim(cards > 0 ? cards / Math.max(0.2, util) : income * (0.08 + r() * 0.1));
  const cardBal = cards > 0 ? cards : Math.round(cardLimit * util);
  const banks = ["TD VISA", "RBC MASTERCARD", "BMO MASTERCARD", "DESJARDINS VISA", "CIBC VISA", "BNC MASTERCARD", "SCOTIA VISA", "AMEX"];
  tl.push({
    creditor: banks[Math.floor(r() * banks.length)], type: "R", opened: month(Math.max(1, Math.min(15, age - 20)) * (0.5 + r() * 0.5)), limit: String(cardLimit),
    balance: String(cardBal), payment: String(Math.max(10, Math.round(cardBal * 0.03))), pastDue: veryPoor ? String(Math.round(cardBal * 0.05)) : "0",
    rating: veryPoor ? "3" : poor ? "2" : "1", late30: poor ? String(1 + Math.floor(r() * 3)) : r() < 0.15 ? "1" : "", late60: veryPoor ? "1" : "", late90: veryPoor && r() < 0.5 ? "1" : "", status: "open",
  });
  if (r() < 0.6 || income > 70000) {
    const l2 = lim(cardLimit * (0.4 + r() * 0.6));
    const b2 = Math.round(l2 * Math.min(1, util * (0.6 + r() * 0.6)));
    tl.push({ creditor: banks[Math.floor(r() * banks.length)], type: "R", opened: month(1 + r() * 6), limit: String(l2), balance: String(b2), payment: String(Math.max(10, Math.round(b2 * 0.03))), pastDue: "0", rating: poor && r() < 0.5 ? "2" : "1", late30: "", late60: "", late90: "", status: "open" });
  }
  if (loans > 0 || r() < 0.45) {
    const bal = loans > 0 ? loans : Math.round((5000 + r() * 20000) / 100) * 100;
    tl.push({ creditor: ["DESJARDINS PRÊT AUTO", "TD AUTO FINANCE", "RBC PRÊT PERSONNEL", "BNC PRÊT AUTO", "FORD CREDIT"][Math.floor(r() * 5)], type: "I", opened: month(1 + r() * 4), limit: String(Math.round(bal * (1.4 + r() * 0.8))), balance: String(bal), payment: String(Math.round(bal / 36)), pastDue: "0", rating: "1", late30: poor && r() < 0.5 ? "1" : "", late60: "", late90: "", status: "open" });
  }
  if (a.residenceType === "own") {
    const pmt = num(a.housingPayment) || Math.round(1400 + r() * 1200);
    tl.push({ creditor: ["DESJARDINS HYPOTHÈQUE", "RBC HYPOTHÈQUE", "TD HYPOTHÈQUE", "BNC HYPOTHÈQUE"][Math.floor(r() * 4)], type: "M", opened: month(Math.min(yAddr || 3, 20)), limit: String(Math.round((pmt * 200) / 1000) * 1000), balance: String(Math.round((pmt * 150) / 1000) * 1000), payment: String(pmt), pastDue: "0", rating: "1", late30: "", late60: "", late90: "", status: "open" });
  }
  if (r() < 0.5) tl.push({ creditor: ["BELL CANADA", "VIDÉOTRON", "ROGERS", "TELUS"][Math.floor(r() * 4)], type: "O", opened: month(2 + r() * 6), limit: "", balance: String(Math.round(60 + r() * 120)), payment: String(Math.round(60 + r() * 120)), pastDue: "0", rating: "1", late30: "", late60: "", late90: "", status: "open" });

  const inquiries: Inquiry[] = [{ date: today.toISOString().slice(0, 10), member: "GROUPE DAR" }];
  const extra = poor ? 2 + Math.floor(r() * 3) : Math.floor(r() * 2);
  for (let i = 0; i < extra; i++) {
    const x = new Date(today);
    x.setDate(x.getDate() - Math.floor(20 + r() * 300));
    inquiries.push({ date: x.toISOString().slice(0, 10), member: ["CAPITAL ONE", "TD", "DESJARDINS", "ROGERS BANK", "BNC", "FAIRSTONE"][Math.floor(r() * 6)] });
  }
  const collections: Collection[] = veryPoor
    ? [{ date: month(1 + r() * 3) + "-15", agency: "COLLECTION SERVICES CANADA", creditor: ["BELL CANADA", "HYDRO-QUÉBEC", "ROGERS"][Math.floor(r() * 3)], amount: String(Math.round(300 + r() * 1500)), status: "open" }]
    : [];
  const publicRecords: PublicRecord[] = bankrupt ? [{ type: d.bankruptcyDetails.toLowerCase().includes("propos") ? "proposal" : "bankruptcy", date: month(2 + r() * 4) + "-01", amount: "", status: /libér|discharg|\d{4}/i.test(d.bankruptcyDetails) ? "discharged" : "active" }] : [];
  return {
    ...d.bureau,
    score: String(score),
    pulledAt: today.toISOString().slice(0, 10),
    fileSince: `${sinceYear}-${String(1 + Math.floor(r() * 12)).padStart(2, "0")}`,
    reference: `SIM-${hashSeed(a.lastName + a.firstName + a.dob).toString(36).toUpperCase().slice(0, 8)}`,
    bookValue: d.bureau.bookValue || String(Math.round(num(d.price) * 0.9)),
    testRate: d.bureau.testRate || "12.99",
    testTerm: d.bureau.testTerm || d.termRequested || "72",
    tradelines: tl,
    inquiries,
    collections,
    publicRecords,
    alerts: "",
    source: "simulated",
  };
}

/** Apply the automatic decision (unless a manager has overridden it). */
export function autoDecide(d: CreditData, now = new Date()): CreditData {
  if (d.decision.auto === false || !num(d.bureau.score)) return d;
  const m = creditMetrics(d);
  const sg = suggestDecision(d, m);
  const prev = d.decision;
  const changed = prev.status !== sg.status;
  const baseRate = num(d.rate) || m.testRate;
  const score = num(d.bureau.score);
  const rate = sg.status === "conditional" && sg.conditions.includes("higher_rate") ? baseRate + (score < 620 ? 4 : 2) : baseRate;
  return {
    ...d,
    decision: {
      ...prev,
      auto: true,
      status: sg.status,
      conditions: sg.conditions,
      requiredDown: sg.requiredDown ? String(sg.requiredDown) : "",
      approvedAmount: sg.status === "declined" ? "" : String(Math.round(Math.max(0, m.amountFinanced - sg.requiredDown))),
      approvedRate: sg.status === "declined" ? "" : String(Math.round(rate * 100) / 100),
      approvedTerm: sg.status === "declined" ? "" : String(num(d.termRequested) || m.testTerm),
      lender: d.lender || prev.lender,
      decidedBy: "Système (automatique)",
      decidedAt: changed || !prev.decidedAt ? now.toISOString() : prev.decidedAt,
    },
  };
}

/** Full automatic processing: generate the report when ready (if none), then decide. */
export function autoProcess(d: CreditData, now = new Date()): CreditData {
  let x = d;
  if (!num(x.bureau.score) && x.bureau.source !== "manual" && readyForAuto(x)) x = { ...x, bureau: simulateBureau(x, now) };
  return autoDecide(x, now);
}
