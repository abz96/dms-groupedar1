import { db } from "@/db";
import { customers, followups, staff } from "@/db/schema";
import { aiEnabled, openaiResponses, outputText } from "@/lib/ai";
import { FREQ_LABEL_FR, type DealType, type Frequency } from "@/lib/deal";
import { priceVehicle } from "@/lib/deal-engine";
import {
  between,
  customerRound,
  int,
  LEAD_SOURCES,
  makeIdentity,
  makeRng,
  pick,
  REGION_LABEL,
  weighted,
  type Region,
} from "@/lib/lead-generator";
import { ensureSchema, getInventory, getLenders, getSessionUser, getSettings } from "@/lib/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export interface GeneratedLead {
  firstName: string;
  lastName: string;
  mobile: string;
  email: string;
  address: string;
  city: string;
  province: string;
  postal: string;
  stage: string;
  leadSource: string;
  interestVehicle: string;
  inventoryId: number;
  dealTypePref: DealType;
  budgetPrice: number;
  desiredPayment: number;
  paymentFrequency: Frequency;
  actualPayment: number;
  term: number | null;
  assignedTo: string;
  notes: string;
  region: Region;
}

const TIMING = [
  "Veut prendre livraison d'ici 2 semaines.",
  "Pas pressé, magasine 2-3 concessionnaires.",
  "Bail actuel se termine le mois prochain.",
  "Veut décider cette fin de semaine.",
  "Prêt à signer si le paiement fonctionne.",
  "Attend son bonus en décembre.",
];
const TRADES = [
  "Échange : 2017 Honda Civic, ~118 000 km, payé.",
  "Échange : 2019 Toyota RAV4, ~84 000 km, solde ~9 500 $.",
  "Échange : 2018 Mazda CX-5, ~97 000 km, solde ~6 000 $.",
  "Échange : 2020 Hyundai Elantra, ~62 000 km, solde ~11 200 $.",
  "Échange : 2016 Ford F-150, ~145 000 km, payé.",
  "Aucun échange.",
  "Aucun échange.",
];
const CREDIT = ["Bon crédit (~740).", "Crédit excellent selon le client.", "Crédit moyen, à valider.", "Travailleur autonome — preuves de revenus à fournir.", "Client existant, bon dossier."];
const ASKS = [
  "Demande un meilleur rabais que l'offre en ligne.",
  "A une soumission d'un compétiteur, veut qu'on fasse mieux.",
  "Veut les pneus d'hiver inclus.",
  "Demande la garantie prolongée incluse dans le prix.",
  "Négocie fort sur le prix — rester ferme sur le 3 %.",
  "Veut un taux plus bas.",
];

export async function POST(req: Request) {
  await ensureSchema();
  const me = await getSessionUser();
  const b = (await req.json().catch(() => ({}))) as {
    mode?: "preview" | "save";
    count?: number;
    region?: Region | "";
    dealType?: DealType | "";
    assignTo?: string;
    fictional?: boolean;
    followUp?: boolean;
    leads?: GeneratedLead[];
  };

  /* ---------- save previewed leads ---------- */
  if (b.mode === "save") {
    const leads = (b.leads ?? []).slice(0, 50);
    const ids: number[] = [];
    for (const l of leads) {
      const [c] = await db
        .insert(customers)
        .values({
          firstName: l.firstName,
          lastName: l.lastName,
          mobile: l.mobile,
          email: l.email,
          address: l.address,
          city: l.city,
          province: l.province || "QC",
          postal: l.postal,
          stage: l.stage || "new",
          leadSource: l.leadSource,
          interestVehicle: l.interestVehicle,
          budgetPrice: String(l.budgetPrice || 0),
          desiredPayment: String(l.desiredPayment || 0),
          paymentFrequency: l.paymentFrequency,
          dealTypePref: l.dealTypePref,
          assignedTo: l.assignedTo,
          notes: l.notes,
        })
        .returning({ id: customers.id });
      ids.push(c.id);
      if (b.followUp !== false) {
        const due = new Date();
        due.setDate(due.getDate() + (due.getDay() === 5 ? 3 : due.getDay() === 6 ? 2 : 1));
        due.setHours(9 + Math.floor(Math.random() * 7), Math.random() < 0.5 ? 0 : 30, 0, 0);
        await db.insert(followups).values({
          customerId: c.id,
          dueAt: due,
          kind: "call",
          notes: `Premier contact — ${l.interestVehicle}`,
          assignedTo: l.assignedTo,
        });
      }
    }
    return Response.json({ saved: ids.length, ids });
  }

  /* ---------- generate ---------- */
  const [inv, lenders, s, staffRows] = await Promise.all([getInventory(), getLenders(), getSettings(), db.select().from(staff)]);
  const vehicles = inv.filter((v) => v.status !== "sold" && v.status !== "employee" && v.price > 0);
  if (!vehicles.length) return Response.json({ error: "Aucun véhicule disponible dans l'inventaire. Importez d'abord l'inventaire." }, { status: 400 });

  const sellers = staffRows
    .filter((x) => x.active && (x.department === "Ventes" || ["sales", "sales_manager"].includes(x.role)) && x.role !== "appraiser")
    .map((x) => x.name);
  const pool = sellers.length ? sellers : [me?.name ?? ""];
  const r = makeRng();
  let rr = int(r, 0, pool.length - 1);
  const count = Math.max(1, Math.min(20, Number(b.count) || 1));
  const leads: GeneratedLead[] = [];

  for (let i = 0; i < count; i++) {
    const region: Region = b.region || weighted(r, { montreal: 38, laval: 18, southshore: 20, northshore: 16, westisland: 8 } as Record<Region, number>);
    const id = makeIdentity(r, region, Boolean(b.fictional));
    const v = pick(r, vehicles);
    const used = v.condition !== "NEUF" && v.kms > 500;
    const dealType: DealType =
      b.dealType || weighted(r, (used ? { finance: 60, lease: 22, cash: 18 } : { lease: 45, finance: 42, cash: 13 }) as Record<DealType, number>);
    const frequency: Frequency = dealType === "cash" ? "monthly" : weighted(r, { monthly: 55, biweekly: 35, weekly: 10 } as Record<Frequency, number>);
    const term = dealType === "lease" ? pick(r, [36, 48, 48, 48, 60]) : dealType === "finance" ? pick(r, used ? [60, 72, 72, 84] : [60, 72, 84, 96]) : undefined;
    const q = priceVehicle(v, { dealType, frequency, term }, lenders, s);
    // customer asks for ~5–15 % less than the real payment (reasonable, wants a discount)
    const factor = between(r, 0.85, 0.95);
    const desired = dealType === "cash" ? 0 : customerRound(r, q.payment * factor);
    const budget = dealType === "cash" ? Math.round((v.price * between(r, 0.92, 0.97)) / 500) * 500 : Math.round((v.price * between(r, 0.93, 0.98)) / 1000) * 1000;
    const assignedTo = b.assignTo || pool[rr++ % pool.length];
    const freqLbl = FREQ_LABEL_FR[frequency].toLowerCase();
    const gapPct = dealType === "cash" ? Math.round((1 - budget / v.price) * 100) : Math.round((1 - desired / q.payment) * 100);
    const label = `${v.year} ${v.make} ${v.model}${v.trim ? " " + v.trim : ""}`.trim();
    const notes = [
      dealType === "cash"
        ? `Achat comptant. Prix affiché ${Math.round(v.price).toLocaleString("fr-CA")} $ — le client vise ~${budget.toLocaleString("fr-CA")} $ (≈ ${gapPct} % de rabais demandé).`
        : `${dealType === "lease" ? "Location" : "Financement"} ${q.term} mois. Paiement calculé : ${q.payment.toFixed(2)} $ ${freqLbl} (taxes incl.) — le client vise ${desired} $ ${freqLbl} (≈ ${gapPct} % de moins). Négocier rabais (max 3 %) ou mise de fonds.`,
      pick(r, TIMING),
      pick(r, TRADES),
      dealType !== "cash" ? pick(r, CREDIT) : "",
      pick(r, ASKS),
      `Région : ${REGION_LABEL[region]}.`,
      b.fictional ? "Client fictif (numéro 555) — démonstration." : "Généré par IA.",
    ]
      .filter(Boolean)
      .join(" ");
    leads.push({
      ...id,
      stage: "new",
      leadSource: pick(r, LEAD_SOURCES),
      interestVehicle: `${label}${v.stock ? ` (#${v.stock})` : ""}`,
      inventoryId: v.id,
      dealTypePref: dealType,
      budgetPrice: budget,
      desiredPayment: desired,
      paymentFrequency: frequency,
      actualPayment: q.payment,
      term: q.term,
      assignedTo,
      notes,
      region,
    });
  }

  // optional: richer, natural-sounding notes with OpenAI
  let engine = "local";
  if (aiEnabled()) {
    try {
      const out = await openaiResponses({
        instructions:
          "You write short French (Québec) CRM lead notes for a car dealership salesperson. For each lead return 2-3 natural sentences keeping ALL numbers (payments, prices, %, km, balances) exactly as given. Reply ONLY with a JSON array of strings, same order.",
        input: JSON.stringify(leads.map((l) => ({ name: `${l.firstName} ${l.lastName}`, vehicle: l.interestVehicle, notes: l.notes }))),
      });
      const arr = JSON.parse(outputText(out.output).text.replace(/```json|```/g, "").trim()) as string[];
      if (Array.isArray(arr) && arr.length === leads.length) {
        arr.forEach((n, i) => typeof n === "string" && n.trim() && (leads[i].notes = n.trim()));
        engine = "ai";
      }
    } catch {
      /* keep local notes */
    }
  }
  return Response.json({ leads, engine });
}
