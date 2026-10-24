import { and, eq, ne } from "drizzle-orm";
import { db } from "@/db";
import { staff } from "@/db/schema";
import { AUTH_USER } from "@/lib/auth";
import { ensureSchema, getSessionUser, hashPassword, isAdminRole } from "@/lib/server";
import { normalizeRole } from "@/lib/staff-roles";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

export async function PUT(req: Request, { params }: Ctx) {
  await ensureSchema();
  const me = await getSessionUser();
  if (me?.role !== "admin") return Response.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;
  const cur = (await db.select().from(staff).where(eq(staff.id, Number(id))))[0];
  if (!cur) return Response.json({ error: "Not found" }, { status: 404 });
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const name = String(b.name ?? "").trim();
  const username = String(b.username ?? "").trim().toLowerCase();
  if (!name || !username) return Response.json({ error: "Nom et nom d'utilisateur requis." }, { status: 400 });
  if (!/^[a-z0-9._-]{2,40}$/.test(username)) return Response.json({ error: "Nom d'utilisateur invalide (lettres, chiffres, . _ -)." }, { status: 400 });
  // the master account username can only stay on the record that already has it
  if (username === AUTH_USER.toLowerCase() && cur.username !== username) return Response.json({ error: "Nom d'utilisateur réservé." }, { status: 409 });
  if (cur.username === AUTH_USER.toLowerCase() && username !== cur.username) return Response.json({ error: "Le nom d'utilisateur du compte principal ne peut pas être changé." }, { status: 400 });
  const clash = await db.select({ id: staff.id }).from(staff).where(and(eq(staff.username, username), ne(staff.id, Number(id))));
  if (clash[0]) return Response.json({ error: "Ce nom d'utilisateur existe déjà." }, { status: 409 });
  const role = normalizeRole(b.role);
  if ((role === "owner" || cur.role === "owner") && me.permission !== "owner" && role !== cur.role) {
    return Response.json({ error: "Seul le propriétaire peut modifier un Super Admin." }, { status: 403 });
  }
  if (me.staffId === Number(id) && (!isAdminRole(role) || b.active === false)) {
    return Response.json({ error: "Vous ne pouvez pas retirer vos propres droits administrateur." }, { status: 400 });
  }
  const patch: Partial<typeof staff.$inferInsert> = {
    name,
    username,
    position: String(b.position ?? ""),
    department: String(b.department ?? ""),
    role,
    email: String(b.email ?? ""),
    phone: String(b.phone ?? ""),
    active: b.active !== false,
  };
  const pw = String(b.password ?? "");
  if (pw) {
    if (pw.length < 4) return Response.json({ error: "Mot de passe : 4 caractères minimum." }, { status: 400 });
    patch.passwordHash = hashPassword(pw);
  }
  const [row] = await db.update(staff).set(patch).where(eq(staff.id, Number(id))).returning();
  const { passwordHash: _p, ...rest } = row;
  void _p;
  return Response.json(rest);
}

export async function DELETE(_req: Request, { params }: Ctx) {
  await ensureSchema();
  const me = await getSessionUser();
  if (me?.role !== "admin") return Response.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;
  if (me.staffId === Number(id)) return Response.json({ error: "Vous ne pouvez pas supprimer votre propre compte." }, { status: 400 });
  const cur = (await db.select().from(staff).where(eq(staff.id, Number(id))))[0];
  if (cur?.role === "owner" && me.permission !== "owner") return Response.json({ error: "Seul le propriétaire peut supprimer un Super Admin." }, { status: 403 });
  await db.delete(staff).where(eq(staff.id, Number(id)));
  return Response.json({ ok: true });
}
