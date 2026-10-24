import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { deals, followups, quotes, staff } from "@/db/schema";
import { AUTH_USER } from "@/lib/auth";
import { computeDeal, leaseConfig, normalizeDeal } from "@/lib/deal";
import { ensureSchema, getLenders, getSessionUser, getSettings, hashPassword } from "@/lib/server";
import { normalizeRole } from "@/lib/staff-roles";

export const dynamic = "force-dynamic";

const pub = (r: typeof staff.$inferSelect) => {
  const { passwordHash: _p, ...rest } = r;
  void _p;
  return rest;
};

const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();

/** GET: admins get full list + stats; others get name/position list (salesperson picker). */
export async function GET() {
  await ensureSchema();
  const me = await getSessionUser();
  if (!me) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const rows = await db.select().from(staff).orderBy(asc(staff.name));
  if (me.role !== "admin") return Response.json(rows.filter((r) => r.active).map((r) => ({ id: r.id, name: r.name, position: r.position, department: r.department })));

  // stats per employee
  const [allDeals, allQuotes, allFu, lenders, s] = await Promise.all([
    db.select({ data: deals.data }).from(deals),
    db.select({ createdBy: quotes.createdBy }).from(quotes),
    db.select({ assignedTo: followups.assignedTo, kind: followups.kind }).from(followups),
    getLenders(),
    getSettings(),
  ]);
  const lc = leaseConfig(s);
  const firstNames = new Map<string, number>();
  rows.forEach((r) => firstNames.set(norm(r.name.split(" ")[0]), (firstNames.get(norm(r.name.split(" ")[0])) ?? 0) + 1));
  /** match a free-text salesperson / assignee to a staff member */
  const owner = (who: string) => {
    const w = norm(who);
    if (!w) return null;
    const exact = rows.find((r) => norm(r.name) === w || r.username === w);
    if (exact) return exact.id;
    if (!w.includes(" ") && firstNames.get(w) === 1) return rows.find((r) => norm(r.name.split(" ")[0]) === w)?.id ?? null;
    return null;
  };
  const stats = new Map<number, { deals: number; quotes: number; appointments: number; gross: number }>();
  const st = (id: number) => {
    if (!stats.has(id)) stats.set(id, { deals: 0, quotes: 0, appointments: 0, gross: 0 });
    return stats.get(id)!;
  };
  for (const d of allDeals) {
    const deal = normalizeDeal(d.data);
    const id = owner(deal.salesperson);
    if (!id) continue;
    const x = st(id);
    x.deals++;
    x.gross += computeDeal(deal, lenders, s.excessKmCharge, lc).profit.total;
  }
  for (const q of allQuotes) {
    const id = owner(q.createdBy);
    if (id) st(id).quotes++;
  }
  for (const f of allFu) {
    if (!["appointment", "test_drive", "delivery"].includes(f.kind)) continue;
    const id = owner(f.assignedTo);
    if (id) st(id).appointments++;
  }
  return Response.json(
    rows.map((r) => ({
      ...pub(r),
      role: normalizeRole(r.role === "admin" ? "admin" : r.role),
      stats: stats.get(r.id) ?? { deals: 0, quotes: 0, appointments: 0, gross: 0 },
    })),
  );
}

export async function POST(req: Request) {
  await ensureSchema();
  const me = await getSessionUser();
  if (me?.role !== "admin") return Response.json({ error: "Forbidden" }, { status: 403 });
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const name = String(b.name ?? "").trim();
  const username = String(b.username ?? "").trim().toLowerCase();
  const password = String(b.password ?? "");
  if (!name || !username) return Response.json({ error: "Nom et nom d'utilisateur requis." }, { status: 400 });
  if (!/^[a-z0-9._-]{2,40}$/.test(username)) return Response.json({ error: "Nom d'utilisateur invalide (lettres, chiffres, . _ -)." }, { status: 400 });
  if (password.length < 4) return Response.json({ error: "Mot de passe : 4 caractères minimum." }, { status: 400 });
  if (username === AUTH_USER.toLowerCase()) return Response.json({ error: "Nom d'utilisateur réservé." }, { status: 409 });
  const exists = await db.select({ id: staff.id }).from(staff).where(eq(staff.username, username));
  if (exists[0]) return Response.json({ error: "Ce nom d'utilisateur existe déjà." }, { status: 409 });
  const role = normalizeRole(b.role);
  if (role === "owner" && me.permission !== "owner") return Response.json({ error: "Seul le propriétaire peut créer un Super Admin." }, { status: 403 });
  const [row] = await db
    .insert(staff)
    .values({
      name,
      username,
      passwordHash: hashPassword(password),
      position: String(b.position ?? ""),
      department: String(b.department ?? ""),
      role,
      email: String(b.email ?? ""),
      phone: String(b.phone ?? ""),
      active: b.active !== false,
    })
    .returning();
  return Response.json(pub(row));
}
