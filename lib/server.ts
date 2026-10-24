import { asc, eq } from "drizzle-orm";
import { db, pool } from "@/db";
import { customers, deals, inventory, lenders, settings, staff } from "@/db/schema";
import { cookies } from "next/headers";
import { pbkdf2Sync, randomBytes, timingSafeEqual } from "node:crypto";
import { AUTH_USER, SESSION_COOKIE, verifySession } from "./auth";
import { DEFAULT_PRODUCTS, DEFAULT_SETTINGS, PLAN_DESCRIPTIONS, type DealData, type DealerSettings, type Lender } from "./deal";

let schemaReady: Promise<void> | null = null;

export function ensureSchema() {
  if (!schemaReady) {
    schemaReady = (async () => {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS deals (
          id serial PRIMARY KEY,
          deal_number text NOT NULL,
          customer_name text NOT NULL DEFAULT '',
          vehicle_label text NOT NULL DEFAULT '',
          deal_type text NOT NULL DEFAULT 'lease',
          status text NOT NULL DEFAULT 'open',
          data jsonb NOT NULL,
          created_at timestamptz NOT NULL DEFAULT now(),
          updated_at timestamptz NOT NULL DEFAULT now()
        );
        CREATE TABLE IF NOT EXISTS lenders (
          id serial PRIMARY KEY,
          name text NOT NULL,
          short_name text NOT NULL,
          type text NOT NULL DEFAULT 'bank',
          active boolean NOT NULL DEFAULT true,
          allow_finance boolean NOT NULL DEFAULT true,
          allow_lease boolean NOT NULL DEFAULT false,
          finance_rates jsonb NOT NULL,
          lease_rates jsonb NOT NULL,
          residuals jsonb NOT NULL,
          max_markup text NOT NULL DEFAULT '2.00',
          reserve_share text NOT NULL DEFAULT '75',
          registration_fee text NOT NULL DEFAULT '0',
          notes text NOT NULL DEFAULT '',
          sort_order integer NOT NULL DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS settings (
          id integer PRIMARY KEY,
          data jsonb NOT NULL
        );
        CREATE TABLE IF NOT EXISTS inventory (
          id serial PRIMARY KEY,
          stock text NOT NULL DEFAULT '',
          vin text NOT NULL DEFAULT '',
          year text NOT NULL DEFAULT '',
          make text NOT NULL DEFAULT '',
          model text NOT NULL DEFAULT '',
          trim text NOT NULL DEFAULT '',
          price text NOT NULL DEFAULT '0',
          kms text NOT NULL DEFAULT '0',
          ext_color text NOT NULL DEFAULT '',
          condition text NOT NULL DEFAULT 'USAGÉ',
          status text NOT NULL DEFAULT 'available',
          dedupe_key text NOT NULL,
          created_at timestamptz NOT NULL DEFAULT now(),
          updated_at timestamptz NOT NULL DEFAULT now(),
          CONSTRAINT inventory_dedupe_key_unique UNIQUE (dedupe_key)
        );
        CREATE TABLE IF NOT EXISTS followups (
          id serial PRIMARY KEY,
          customer_id integer NOT NULL,
          due_at timestamptz NOT NULL,
          kind text NOT NULL DEFAULT 'call',
          notes text NOT NULL DEFAULT '',
          assigned_to text NOT NULL DEFAULT '',
          done boolean NOT NULL DEFAULT false,
          done_at timestamptz,
          created_at timestamptz NOT NULL DEFAULT now()
        );
        CREATE TABLE IF NOT EXISTS quotes (
          id serial PRIMARY KEY,
          customer_id integer,
          inventory_id integer,
          status text NOT NULL DEFAULT 'pending',
          deal_type text NOT NULL DEFAULT 'finance',
          summary text NOT NULL DEFAULT '',
          request text NOT NULL DEFAULT '',
          data jsonb NOT NULL,
          created_by text NOT NULL DEFAULT '',
          decided_by text NOT NULL DEFAULT '',
          decision_note text NOT NULL DEFAULT '',
          decided_at timestamptz,
          deal_id integer,
          created_at timestamptz NOT NULL DEFAULT now()
        );
        CREATE TABLE IF NOT EXISTS credit_apps (
          id serial PRIMARY KEY,
          app_number text NOT NULL DEFAULT '',
          customer_id integer,
          deal_id integer,
          status text NOT NULL DEFAULT 'draft',
          applicant_name text NOT NULL DEFAULT '',
          data jsonb NOT NULL,
          created_by text NOT NULL DEFAULT '',
          created_at timestamptz NOT NULL DEFAULT now(),
          updated_at timestamptz NOT NULL DEFAULT now()
        );
        CREATE TABLE IF NOT EXISTS staff (
          id serial PRIMARY KEY,
          name text NOT NULL,
          username text NOT NULL,
          password_hash text NOT NULL,
          position text NOT NULL DEFAULT '',
          role text NOT NULL DEFAULT 'staff',
          email text NOT NULL DEFAULT '',
          phone text NOT NULL DEFAULT '',
          active boolean NOT NULL DEFAULT true,
          last_login_at timestamptz,
          created_at timestamptz NOT NULL DEFAULT now(),
          CONSTRAINT staff_username_unique UNIQUE (username)
        );
        CREATE TABLE IF NOT EXISTS customers (
          id serial PRIMARY KEY,
          first_name text NOT NULL DEFAULT '',
          last_name text NOT NULL DEFAULT '',
          email text NOT NULL DEFAULT '',
          home_phone text NOT NULL DEFAULT '',
          mobile text NOT NULL DEFAULT '',
          address text NOT NULL DEFAULT '',
          city text NOT NULL DEFAULT '',
          province text NOT NULL DEFAULT '',
          postal text NOT NULL DEFAULT '',
          notes text NOT NULL DEFAULT '',
          source_deal_id integer,
          created_at timestamptz NOT NULL DEFAULT now(),
          updated_at timestamptz NOT NULL DEFAULT now()
        );
        ALTER TABLE inventory ADD COLUMN IF NOT EXISTS employee_name text NOT NULL DEFAULT '';
        ALTER TABLE staff ADD COLUMN IF NOT EXISTS department text NOT NULL DEFAULT '';
        ALTER TABLE quotes ADD COLUMN IF NOT EXISTS quote_number text NOT NULL DEFAULT '';
        UPDATE quotes SET quote_number = 'QT-' || (100000 + id) WHERE quote_number = '';
        ALTER TABLE customers ADD COLUMN IF NOT EXISTS stage text NOT NULL DEFAULT 'new';
        ALTER TABLE customers ADD COLUMN IF NOT EXISTS lead_source text NOT NULL DEFAULT '';
        ALTER TABLE customers ADD COLUMN IF NOT EXISTS interest_vehicle text NOT NULL DEFAULT '';
        ALTER TABLE customers ADD COLUMN IF NOT EXISTS budget_price text NOT NULL DEFAULT '0';
        ALTER TABLE customers ADD COLUMN IF NOT EXISTS desired_payment text NOT NULL DEFAULT '0';
        ALTER TABLE customers ADD COLUMN IF NOT EXISTS payment_frequency text NOT NULL DEFAULT 'monthly';
        ALTER TABLE customers ADD COLUMN IF NOT EXISTS deal_type_pref text NOT NULL DEFAULT '';
        ALTER TABLE customers ADD COLUMN IF NOT EXISTS assigned_to text NOT NULL DEFAULT '';
      `);
      // Lender list versioning: replace the list once when the seed version changes
      const meta = await db.select().from(settings).where(eq(settings.id, 100));
      const m = (meta[0]?.data ?? {}) as {
        lenderSeedVersion?: number;
        depositMigrated?: boolean;
        refundableMigrated?: boolean;
        dealerFeesMigrated?: boolean;
        customersBackfilled?: boolean;
        staffSeeded?: boolean;
      };
      let changed = false;
      if (Number(m.lenderSeedVersion ?? 0) < LENDER_SEED_VERSION) {
        await db.delete(lenders);
        await db.insert(lenders).values(SEED_LENDERS.map((l, i) => ({ ...l, sortOrder: i })));
        m.lenderSeedVersion = LENDER_SEED_VERSION;
        changed = true;
      }
      if (!m.depositMigrated) {
        // Security deposit default = $1,000 (settings + existing deals that had $0)
        const st = await db.select().from(settings).where(eq(settings.id, 1));
        if (st[0]) {
          const sd = st[0].data as Partial<DealerSettings>;
          if (!Number(sd.defaultSecurityDeposit)) {
            await db.update(settings).set({ data: { ...sd, defaultSecurityDeposit: 1000 } }).where(eq(settings.id, 1));
          }
        }
        const all = await db.select({ id: deals.id, data: deals.data }).from(deals);
        for (const row of all) {
          const d = row.data as { options?: { securityDeposit?: number }[] };
          if (!Array.isArray(d.options)) continue;
          let touched = false;
          d.options.forEach((o) => {
            if (o && !Number(o.securityDeposit)) {
              o.securityDeposit = 1000;
              touched = true;
            }
          });
          if (touched) await db.update(deals).set({ data: d }).where(eq(deals.id, row.id));
        }
        m.depositMigrated = true;
        changed = true;
      }
      if (!m.refundableMigrated) {
        // Refundable deposit (acompte remboursable) default = $500
        const all = await db.select({ id: deals.id, data: deals.data }).from(deals);
        for (const row of all) {
          const d = row.data as { cash?: { deposit?: number } };
          if (d.cash && !Number(d.cash.deposit)) {
            d.cash.deposit = 500;
            await db.update(deals).set({ data: d }).where(eq(deals.id, row.id));
          }
        }
        m.refundableMigrated = true;
        changed = true;
      }
      if (!m.dealerFeesMigrated) {
        // Dealer fees (Frais) default = $999 — settings + existing deals at $0
        const st = await db.select().from(settings).where(eq(settings.id, 1));
        if (st[0]) {
          const sd = st[0].data as Partial<DealerSettings>;
          if (!Number(sd.defaultAdminFees)) await db.update(settings).set({ data: { ...sd, defaultAdminFees: 999 } }).where(eq(settings.id, 1));
        }
        const all = await db.select({ id: deals.id, data: deals.data }).from(deals);
        for (const row of all) {
          const d = row.data as { pricing?: { adminFees?: number } };
          if (d.pricing && !Number(d.pricing.adminFees)) {
            d.pricing.adminFees = 999;
            await db.update(deals).set({ data: d }).where(eq(deals.id, row.id));
          }
        }
        m.dealerFeesMigrated = true;
        changed = true;
      }
      if (!m.staffSeeded) {
        for (const p of SEED_STAFF) {
          const ex = await db.select({ id: staff.id }).from(staff).where(eq(staff.username, p.username));
          if (ex[0]) continue;
          await db.insert(staff).values({ ...p, passwordHash: hashPassword(DEFAULT_STAFF_PASSWORD), active: true });
        }
        // the Super Admin's name becomes the default salesperson
        const st = await db.select().from(settings).where(eq(settings.id, 1));
        const sd = (st[0]?.data ?? {}) as Partial<DealerSettings>;
        if (!sd.defaultSalesperson || sd.defaultSalesperson === "Abdul") {
          const data = { ...sd, defaultSalesperson: "Abdul Aziz Dar" };
          await db.insert(settings).values({ id: 1, data }).onConflictDoUpdate({ target: settings.id, set: { data } });
        }
        m.staffSeeded = true;
        changed = true;
      }
      if (!m.customersBackfilled) {
        // Create client records for existing deals
        const all = await db.select({ id: deals.id, data: deals.data }).from(deals).orderBy(asc(deals.id));
        for (const row of all) {
          const d = row.data as DealData;
          const id = await syncCustomerFromDeal(row.id, d);
          if (id && d.customer) {
            d.customer.id = id;
            await db.update(deals).set({ data: d }).where(eq(deals.id, row.id));
          }
        }
        m.customersBackfilled = true;
        changed = true;
      }
      if (changed) {
        await db.insert(settings).values({ id: 100, data: m }).onConflictDoUpdate({ target: settings.id, set: { data: m } });
      }
    })().catch((e) => {
      schemaReady = null;
      throw e;
    });
  }
  return schemaReady;
}

type SeedLender = Omit<Lender, "id" | "sortOrder">;

const rates = (pairs: [number, number][]) => Object.fromEntries(pairs.map(([t, r]) => [String(t), r]));

/** Bank = finance only. Only the in-house program can lease. */
const bank = (name: string, shortName: string, type: string, f: [number, number][], notes: string, regFee = "53.76"): SeedLender => ({
  name,
  shortName,
  type,
  active: true,
  allowFinance: true,
  allowLease: false,
  financeRates: rates(f),
  leaseRates: {},
  residuals: {},
  maxMarkup: "0",
  reserveShare: "0",
  registrationFee: regFee,
  notes,
});

/** Bump this to replace the lender list in existing databases. */
export const LENDER_SEED_VERSION = 2;

// Rates last updated Oct 3, 2026 (banks) / Oct 20, 2026 (Groupe Dar in-house)
export const SEED_LENDERS: SeedLender[] = [
  bank("TD Auto Finance Canada", "TD", "bank", [[24, 7.25], [48, 9.0], [60, 9.87], [72, 10.74]],
    "Most-used indirect lender at Canadian dealerships. Taux mis à jour le 3 oct. 2026."),
  bank("RBC Royal Bank (RBC Auto Finance)", "RBC", "bank", [[48, 8.99], [60, 9.74], [72, 10.49], [84, 11.24]],
    "Prime rate 6.45%; strong for existing RBC clients with 720+ scores. Taux mis à jour le 3 oct. 2026."),
  bank("BMO Bank of Montreal", "BMO", "bank", [[24, 7.99], [36, 8.82], [84, 12.16], [96, 12.99]],
    "Terms to 84+ months on used; competitive on longer amortizations. Taux mis à jour le 3 oct. 2026."),
  bank("Scotiabank (Scotia Dealer Advantage)", "SCOTIA", "bank", [[36, 8.24], [48, 8.99], [60, 9.74], [72, 10.49]],
    "One of the few big banks with a dedicated non-prime division. Taux mis à jour le 3 oct. 2026."),
  bank("CIBC Auto Finance", "CIBC", "bank", [[24, 7.75], [36, 8.5], [48, 9.25], [60, 10.0]],
    "Competitive for CIBC banking clients bundling products. Taux mis à jour le 3 oct. 2026."),
  bank("Desjardins (Caisses Desjardins du Québec)", "DESJ", "quebec", [[36, 5.91], [72, 7.16], [84, 7.57], [96, 7.99]],
    "Major Québec player — best rates for members. Used-car rates discounted 1.00% from standard market. Taux mis à jour le 3 oct. 2026.", "70.50"),
  bank("National Bank of Canada (BNC)", "BNC", "quebec", [[36, 8.0], [72, 10.39], [84, 11.19], [96, 11.99]],
    "Strong in Québec & Atlantic Canada; standardized 7.20% used rate for prime borrowers. Taux mis à jour le 3 oct. 2026.", "70.50"),
  {
    name: "Groupe Dar Financing (In-House)",
    shortName: "GROUPE DAR",
    type: "inhouse",
    active: true,
    allowFinance: true,
    allowLease: true,
    financeRates: rates([[36, 7.99], [48, 8.99], [60, 8.99], [96, 9.99]]),
    leaseRates: rates([[36, 7.99], [48, 8.99], [60, 8.99], [96, 9.99]]),
    // fallback only — the Settings residual grid (term × km) is used first
    residuals: { "36": 56, "48": 49, "60": 41, "96": 20 },
    maxMarkup: "0",
    reserveShare: "0",
    registrationFee: "70.50",
    notes: "In-house financing — Groupe Dar. Seul prêteur offrant la location. Taux mis à jour le 20 oct. 2026.",
  },
];

export async function getLenders(): Promise<Lender[]> {
  await ensureSchema();
  const rows = await db.select().from(lenders).orderBy(asc(lenders.sortOrder), asc(lenders.id));
  return rows.map((r) => ({
    ...r,
    financeRates: (r.financeRates ?? {}) as Record<string, number>,
    leaseRates: (r.leaseRates ?? {}) as Record<string, number>,
    residuals: (r.residuals ?? {}) as Record<string, number>,
  }));
}

export async function getSettings(): Promise<DealerSettings> {
  await ensureSchema();
  const rows = await db.select().from(settings).where(eq(settings.id, 1));
  const saved = (rows[0]?.data ?? {}) as Partial<DealerSettings>;
  return {
    ...DEFAULT_SETTINGS,
    ...saved,
    commission: { ...DEFAULT_SETTINGS.commission, ...(saved.commission ?? {}) },
    defaultKmPerYear: Number(saved.defaultKmPerYear) || DEFAULT_SETTINGS.defaultKmPerYear,
    defaultRefundableDeposit:
      saved.defaultRefundableDeposit === undefined ? DEFAULT_SETTINGS.defaultRefundableDeposit : Number(saved.defaultRefundableDeposit) || 0,
    defaultFinanceLenderId: saved.defaultFinanceLenderId ? Number(saved.defaultFinanceLenderId) : null,
    defaultLeaseLenderId: saved.defaultLeaseLenderId ? Number(saved.defaultLeaseLenderId) : null,
    accessoryCatalog: Array.isArray(saved.accessoryCatalog) ? saved.accessoryCatalog : [],
    incentives: Array.isArray(saved.incentives) ? saved.incentives : [],
    warrantyDivisors:
      saved.warrantyDivisors && typeof saved.warrantyDivisors === "object" && Object.keys(saved.warrantyDivisors).length
        ? saved.warrantyDivisors
        : DEFAULT_SETTINGS.warrantyDivisors,
    tireRimFormula: { ...DEFAULT_SETTINGS.tireRimFormula, ...(saved.tireRimFormula ?? {}) },
    defaultKmPerYear2: Number(saved.defaultKmPerYear2) || DEFAULT_SETTINGS.defaultKmPerYear2,
    protectionPlans: Array.isArray(saved.protectionPlans)
      ? saved.protectionPlans.map((p) => ({
          ...p,
          description: p.description ?? PLAN_DESCRIPTIONS[p.code]?.[0] ?? "",
          descriptionEn: p.descriptionEn ?? PLAN_DESCRIPTIONS[p.code]?.[1] ?? "",
        }))
      : DEFAULT_SETTINGS.protectionPlans,
    vehicleTiers: Array.isArray(saved.vehicleTiers) && saved.vehicleTiers.length ? saved.vehicleTiers : DEFAULT_SETTINGS.vehicleTiers,
    termFactors:
      saved.termFactors && typeof saved.termFactors === "object" && Object.keys(saved.termFactors).length ? saved.termFactors : DEFAULT_SETTINGS.termFactors,
    planMargin: saved.planMargin === undefined ? DEFAULT_SETTINGS.planMargin : Number(saved.planMargin) || 0,
    managerCode: String(saved.managerCode ?? DEFAULT_SETTINGS.managerCode),
    maxDiscountPct: saved.maxDiscountPct === undefined ? DEFAULT_SETTINGS.maxDiscountPct : Number(saved.maxDiscountPct) || 0,
    dealTerms:
      Array.isArray(saved.dealTerms) && saved.dealTerms.length
        ? Array.from(new Set(saved.dealTerms.map(Number).filter((n) => n > 0))).sort((x, y) => x - y)
        : DEFAULT_SETTINGS.dealTerms,
    optDefaults: {
      lease: [
        { ...DEFAULT_SETTINGS.optDefaults.lease[0], ...(saved.optDefaults?.lease?.[0] ?? {}) },
        { ...DEFAULT_SETTINGS.optDefaults.lease[1], ...(saved.optDefaults?.lease?.[1] ?? {}) },
      ],
      finance: [
        { ...DEFAULT_SETTINGS.optDefaults.finance[0], ...(saved.optDefaults?.finance?.[0] ?? {}) },
        { ...DEFAULT_SETTINGS.optDefaults.finance[1], ...(saved.optDefaults?.finance?.[1] ?? {}) },
      ],
    },
    products: Array.isArray(saved.products)
      ? saved.products
      : DEFAULT_PRODUCTS.map((x) => ({
          ...x,
          pct: Number((saved.profitPct as Record<string, number> | undefined)?.[x.id] ?? x.pct),
          commission: Number((saved.commission as Record<string, number> | undefined)?.[x.id] ?? x.commission),
        })),
    profitPct: { ...DEFAULT_SETTINGS.profitPct, ...(saved.profitPct ?? {}) },
    ...migrateLease(saved as Partial<DealerSettings> & { residualGrid?: Record<string, Record<string, number>> }),
  };
}

export function toVehicle(r: typeof inventory.$inferSelect) {
  return { ...r, price: Number(r.price) || 0, kms: Number(r.kms) || 0 };
}

export async function getInventory() {
  await ensureSchema();
  const rows = await db.select().from(inventory).orderBy(asc(inventory.make), asc(inventory.model), asc(inventory.year));
  return rows.map(toVehicle);
}

/* ---------------------------------------------------------------- client database */

const normPhone = (p: string) => p.replace(/\D/g, "").slice(-10);

/**
 * Keep the client database in sync with a deal's customer block.
 * Match order: linked id → client created from this deal → email → phone → exact full name.
 * Returns the client id (or null when the deal has no customer name/contact yet).
 */
export async function syncCustomerFromDeal(dealId: number, d: DealData): Promise<number | null> {
  const c = d.customer;
  if (!c) return null;
  const first = (c.firstName ?? "").trim();
  const last = (c.lastName ?? "").trim();
  if (!first && !last) return null;
  const values = {
    firstName: first,
    lastName: last,
    email: (c.email ?? "").trim(),
    homePhone: (c.homePhone ?? "").trim(),
    mobile: (c.mobile ?? "").trim(),
    address: (c.address ?? "").trim(),
    city: (c.city ?? "").trim(),
    province: (c.province ?? "").trim(),
    postal: (c.postal ?? "").trim(),
  };

  let id: number | null = null;
  if (c.id) {
    const r = await db.select({ id: customers.id }).from(customers).where(eq(customers.id, Number(c.id)));
    id = r[0]?.id ?? null;
  }
  if (!id) {
    const r = await db.select({ id: customers.id }).from(customers).where(eq(customers.sourceDealId, dealId));
    id = r[0]?.id ?? null;
  }
  if (!id) {
    const all = await db.select().from(customers);
    const email = values.email.toLowerCase();
    const phones = [values.mobile, values.homePhone].map(normPhone).filter((p) => p.length >= 7);
    const full = `${first} ${last}`.toLowerCase();
    const hit =
      (email && all.find((x) => x.email.toLowerCase() === email)) ||
      (phones.length && all.find((x) => phones.includes(normPhone(x.mobile)) || phones.includes(normPhone(x.homePhone)))) ||
      all.find((x) => `${x.firstName} ${x.lastName}`.trim().toLowerCase() === full);
    id = hit ? hit.id : null;
  }

  if (id) {
    // update with non-empty values from the deal (never wipe existing info)
    const patch = Object.fromEntries(Object.entries(values).filter(([, v]) => v !== "")) as Partial<typeof values>;
    await db.update(customers).set({ ...patch, updatedAt: new Date() }).where(eq(customers.id, id));
    return id;
  }
  const [row] = await db.insert(customers).values({ ...values, sourceDealId: dealId }).returning({ id: customers.id });
  return row.id;
}

/* ---------------------------------------------------------------- staff & sessions */

export function hashPassword(pw: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = pbkdf2Sync(pw, salt, 120000, 32, "sha256").toString("hex");
  return `pbkdf2$120000$${salt}$${hash}`;
}

export function verifyPassword(pw: string, stored: string): boolean {
  const [scheme, iter, salt, hash] = stored.split("$");
  if (scheme !== "pbkdf2" || !salt || !hash) return false;
  const h = pbkdf2Sync(pw, salt, Number(iter) || 120000, 32, "sha256");
  const ref = Buffer.from(hash, "hex");
  return ref.length === h.length && timingSafeEqual(ref, h);
}

export interface SessionUser {
  username: string;
  name: string;
  position: string;
  /** admin = full access (Super Admin / Owner, Administrator) */
  role: "admin" | "staff";
  /** detailed permission role (owner, admin, sales_manager, finance, sales, appraiser, inventory, service, administration) */
  permission: string;
  department: string;
  staffId: number | null;
}

/** Roles with full access (staff management, quote approval). */
export const ADMIN_ROLES = ["owner", "admin", "sales_manager"];
export const isAdminRole = (r: string) => ADMIN_ROLES.includes(r);

export const DEFAULT_STAFF_PASSWORD = "9296";

type SeedStaff = { name: string; username: string; position: string; department: string; role: string };
const ss = (name: string, position: string, department: string, role: string, username?: string): SeedStaff => ({
  name,
  position,
  department,
  role,
  username:
    username ??
    name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z\s-]/g, "")
      .trim()
      .split(/\s+/)
      .reduce((acc, w, i, arr) => (i === 0 ? w : i === arr.length - 1 ? `${acc}.${w}` : acc), ""),
});
export const SEED_STAFF: SeedStaff[] = [
  ss("Marc-Antoine Dubois", "Conseiller en location", "Ventes", "sales"),
  ss("Sarah Khalil", "Directrice financière", "Finance", "finance"),
  ss("Anthony Petrucci", "Conseiller aux ventes", "Ventes", "sales"),
  ss("Abdul Aziz Dar", "Directeur des ventes", "Direction", "owner", "adar"),
  ss("Joseph Veleno", "Évaluateur", "Ventes", "appraiser"),
  ss("Nadia El-Khoury", "Conseillère aux ventes", "Ventes", "sales"),
  ss("Vanessa Martel", "Conseillère aux ventes", "Ventes", "sales"),
  ss("Steve Psomas", "Directeur du service", "Service", "service"),
  ss("Arpi Manoukian", "Conseillère technique", "Service", "service"),
  ss("Daniel Greco", "Directeur de l'inventaire", "Inventaire", "inventory"),
  ss("Michael Romano", "Technicien", "Service", "service"),
  ss("Hassan Farah", "Technicien", "Service", "service"),
  ss("Victor Nguyen", "Technicien", "Service", "service"),
  ss("Nicolas Tremblay", "Technicien", "Service", "service"),
  ss("Omar Haddad", "Technicien", "Service", "service"),
  ss("Tony Marino", "Carrossier", "Carrosserie", "service"),
  ss("Samir Bouchra", "Esthéticien", "Esthétique", "service"),
  ss("Melissa Gagnon", "Secrétaire", "Administration", "administration"),
  ss("Sofia Ricci", "Secrétaire", "Administration", "administration"),
];

/** Look up the logged-in user (master account or staff member). */
export async function userFromUsername(username: string | null): Promise<SessionUser | null> {
  if (!username) return null;
  await ensureSchema();
  const r = await db.select().from(staff).where(eq(staff.username, username));
  const u = r[0];
  if (username === AUTH_USER.toLowerCase()) {
    // master account — shown as its staff profile when one exists (always full access)
    return {
      username,
      name: u?.name ?? username,
      position: u?.position ?? "Administrateur",
      role: "admin",
      permission: "owner",
      department: u?.department ?? "Direction",
      staffId: u?.id ?? null,
    };
  }
  if (!u || !u.active) return null;
  return {
    username,
    name: u.name,
    position: u.position,
    role: isAdminRole(u.role) ? "admin" : "staff",
    permission: u.role,
    department: u.department,
    staffId: u.id,
  };
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const c = await cookies();
  return userFromUsername(await verifySession(c.get(SESSION_COOKIE)?.value));
}

/** Settings migration: old term × km residual grid → residual by term (16,000 km column) + km tiers. */
function migrateLease(saved: Partial<DealerSettings> & { residualGrid?: Record<string, Record<string, number>> }) {
  const baseKm = Number(saved.baseKm) || DEFAULT_SETTINGS.baseKm;
  let residualTerms = saved.residualTerms;
  if (!residualTerms || typeof residualTerms !== "object") {
    if (saved.residualGrid && typeof saved.residualGrid === "object") {
      residualTerms = {};
      for (const [term, row] of Object.entries(saved.residualGrid)) {
        const v = row?.[String(baseKm)] ?? Object.values(row ?? {})[0];
        if (v !== undefined) residualTerms[term] = Number(v) || 0;
      }
    } else residualTerms = DEFAULT_SETTINGS.residualTerms;
  }
  const kmTiers = Array.isArray(saved.kmTiers) && saved.kmTiers.length ? saved.kmTiers : DEFAULT_SETTINGS.kmTiers;
  return { residualTerms, kmTiers, baseKm };
}

/* ---------------------------------------------------------------- CRM */

/** Parse client fields from a request body (contact + CRM interest). */
export function customerValues(b: Record<string, unknown>) {
  const v = (k: string) => String(b[k] ?? "").trim();
  const n = (k: string) => String(Number(String(b[k] ?? "0").replace(/[^\d.-]/g, "")) || 0);
  return {
    firstName: v("firstName"),
    lastName: v("lastName"),
    email: v("email"),
    homePhone: v("homePhone"),
    mobile: v("mobile"),
    address: v("address"),
    city: v("city"),
    province: v("province"),
    postal: v("postal").toUpperCase(),
    notes: String(b.notes ?? ""),
    stage: v("stage") || "new",
    leadSource: v("leadSource"),
    interestVehicle: v("interestVehicle"),
    budgetPrice: n("budgetPrice"),
    desiredPayment: n("desiredPayment"),
    paymentFrequency: ["monthly", "biweekly", "weekly"].includes(v("paymentFrequency")) ? v("paymentFrequency") : "monthly",
    dealTypePref: ["", "finance", "lease", "cash"].includes(v("dealTypePref")) ? v("dealTypePref") : "",
    assignedTo: v("assignedTo"),
  };
}
