import { boolean, integer, jsonb, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const deals = pgTable("deals", {
  id: serial("id").primaryKey(),
  dealNumber: text("deal_number").notNull(),
  customerName: text("customer_name").notNull().default(""),
  vehicleLabel: text("vehicle_label").notNull().default(""),
  dealType: text("deal_type").notNull().default("lease"),
  status: text("status").notNull().default("open"),
  data: jsonb("data").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const lenders = pgTable("lenders", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  shortName: text("short_name").notNull(),
  type: text("type").notNull().default("bank"), // bank | captive | inhouse | subprime
  active: boolean("active").notNull().default(true),
  allowFinance: boolean("allow_finance").notNull().default(true),
  allowLease: boolean("allow_lease").notNull().default(false),
  financeRates: jsonb("finance_rates").notNull(), // { "60": 6.99 }
  leaseRates: jsonb("lease_rates").notNull(),
  residuals: jsonb("residuals").notNull(), // { "48": 51 }
  maxMarkup: text("max_markup").notNull().default("2.00"),
  reserveShare: text("reserve_share").notNull().default("75"),
  registrationFee: text("registration_fee").notNull().default("0"),
  notes: text("notes").notNull().default(""),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const inventory = pgTable("inventory", {
  id: serial("id").primaryKey(),
  stock: text("stock").notNull().default(""),
  vin: text("vin").notNull().default(""),
  year: text("year").notNull().default(""),
  make: text("make").notNull().default(""),
  model: text("model").notNull().default(""),
  trim: text("trim").notNull().default(""),
  price: text("price").notNull().default("0"),
  kms: text("kms").notNull().default("0"),
  extColor: text("ext_color").notNull().default(""),
  condition: text("condition").notNull().default("USAGÉ"),
  status: text("status").notNull().default("available"),
  employeeName: text("employee_name").notNull().default(""),
  dedupeKey: text("dedupe_key").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const customers = pgTable("customers", {
  id: serial("id").primaryKey(),
  firstName: text("first_name").notNull().default(""),
  lastName: text("last_name").notNull().default(""),
  email: text("email").notNull().default(""),
  homePhone: text("home_phone").notNull().default(""),
  mobile: text("mobile").notNull().default(""),
  address: text("address").notNull().default(""),
  city: text("city").notNull().default(""),
  province: text("province").notNull().default(""),
  postal: text("postal").notNull().default(""),
  notes: text("notes").notNull().default(""),
  sourceDealId: integer("source_deal_id"),
  stage: text("stage").notNull().default("new"),
  leadSource: text("lead_source").notNull().default(""),
  interestVehicle: text("interest_vehicle").notNull().default(""),
  budgetPrice: text("budget_price").notNull().default("0"),
  desiredPayment: text("desired_payment").notNull().default("0"),
  paymentFrequency: text("payment_frequency").notNull().default("monthly"),
  dealTypePref: text("deal_type_pref").notNull().default(""),
  assignedTo: text("assigned_to").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const staff = pgTable("staff", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  position: text("position").notNull().default(""),
  department: text("department").notNull().default(""),
  role: text("role").notNull().default("sales"),
  email: text("email").notNull().default(""),
  phone: text("phone").notNull().default(""),
  active: boolean("active").notNull().default(true),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const followups = pgTable("followups", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").notNull(),
  dueAt: timestamp("due_at", { withTimezone: true }).notNull(),
  kind: text("kind").notNull().default("call"),
  notes: text("notes").notNull().default(""),
  assignedTo: text("assigned_to").notNull().default(""),
  done: boolean("done").notNull().default(false),
  doneAt: timestamp("done_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const quotes = pgTable("quotes", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id"),
  inventoryId: integer("inventory_id"),
  quoteNumber: text("quote_number").notNull().default(""),
  status: text("status").notNull().default("pending"),
  dealType: text("deal_type").notNull().default("finance"),
  summary: text("summary").notNull().default(""),
  request: text("request").notNull().default(""),
  data: jsonb("data").notNull(),
  createdBy: text("created_by").notNull().default(""),
  decidedBy: text("decided_by").notNull().default(""),
  decisionNote: text("decision_note").notNull().default(""),
  decidedAt: timestamp("decided_at", { withTimezone: true }),
  dealId: integer("deal_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const creditApps = pgTable("credit_apps", {
  id: serial("id").primaryKey(),
  appNumber: text("app_number").notNull().default(""),
  customerId: integer("customer_id"),
  dealId: integer("deal_id"),
  status: text("status").notNull().default("draft"),
  applicantName: text("applicant_name").notNull().default(""),
  data: jsonb("data").notNull(),
  createdBy: text("created_by").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const settings = pgTable("settings", {
  id: integer("id").primaryKey(),
  data: jsonb("data").notNull(),
});
