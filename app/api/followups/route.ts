import { and, asc, eq, gte, inArray, lte } from "drizzle-orm";
import { db } from "@/db";
import { customers, followups } from "@/db/schema";
import { ensureSchema, getSessionUser } from "@/lib/server";

export const dynamic = "force-dynamic";

/** GET ?status=open|done|all&from=ISO&to=ISO&customerId= */
export async function GET(req: Request) {
  await ensureSchema();
  const u = new URL(req.url).searchParams;
  const conds = [];
  const status = u.get("status") ?? "open";
  if (status === "open") conds.push(eq(followups.done, false));
  if (status === "done") conds.push(eq(followups.done, true));
  if (u.get("from")) conds.push(gte(followups.dueAt, new Date(u.get("from")!)));
  if (u.get("to")) conds.push(lte(followups.dueAt, new Date(u.get("to")!)));
  if (u.get("customerId")) conds.push(eq(followups.customerId, Number(u.get("customerId"))));
  const kinds = (u.get("kinds") ?? "").split(",").filter(Boolean);
  if (kinds.length) conds.push(inArray(followups.kind, kinds));
  if (u.get("mine") === "1") {
    const me = await getSessionUser();
    if (me) conds.push(eq(followups.assignedTo, me.name));
  }
  const rows = await db
    .select({
      id: followups.id,
      customerId: followups.customerId,
      dueAt: followups.dueAt,
      kind: followups.kind,
      notes: followups.notes,
      assignedTo: followups.assignedTo,
      done: followups.done,
      doneAt: followups.doneAt,
      firstName: customers.firstName,
      lastName: customers.lastName,
      mobile: customers.mobile,
      email: customers.email,
      interestVehicle: customers.interestVehicle,
    })
    .from(followups)
    .leftJoin(customers, eq(customers.id, followups.customerId))
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(asc(followups.dueAt))
    .limit(1000);
  return Response.json(rows);
}

export async function POST(req: Request) {
  await ensureSchema();
  const me = await getSessionUser();
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  let customerId = Number(b.customerId);
  const nc = b.newCustomer as { firstName?: string; lastName?: string; mobile?: string; email?: string } | undefined;
  if (!customerId && nc && (nc.firstName?.trim() || nc.lastName?.trim())) {
    const [c] = await db
      .insert(customers)
      .values({
        firstName: String(nc.firstName ?? "").trim(),
        lastName: String(nc.lastName ?? "").trim(),
        mobile: String(nc.mobile ?? "").trim(),
        email: String(nc.email ?? "").trim(),
        stage: "appointment",
        assignedTo: me?.name ?? "",
      })
      .returning({ id: customers.id });
    customerId = c.id;
  }
  const due = new Date(String(b.dueAt ?? ""));
  if (!customerId || isNaN(due.getTime())) return Response.json({ error: "Client et date requis." }, { status: 400 });
  const [row] = await db
    .insert(followups)
    .values({
      customerId,
      dueAt: due,
      kind: String(b.kind ?? "call"),
      notes: String(b.notes ?? ""),
      assignedTo: String(b.assignedTo ?? me?.name ?? ""),
    })
    .returning();
  return Response.json(row);
}
