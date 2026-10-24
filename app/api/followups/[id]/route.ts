import { eq } from "drizzle-orm";
import { db } from "@/db";
import { followups } from "@/db/schema";
import { ensureSchema } from "@/lib/server";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

export async function PUT(req: Request, { params }: Ctx) {
  await ensureSchema();
  const { id } = await params;
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const patch: Partial<typeof followups.$inferInsert> = {};
  if (b.dueAt !== undefined) {
    const d = new Date(String(b.dueAt));
    if (!isNaN(d.getTime())) patch.dueAt = d;
  }
  if (b.kind !== undefined) patch.kind = String(b.kind);
  if (b.notes !== undefined) patch.notes = String(b.notes);
  if (b.assignedTo !== undefined) patch.assignedTo = String(b.assignedTo);
  if (b.done !== undefined) {
    patch.done = Boolean(b.done);
    patch.doneAt = b.done ? new Date() : null;
  }
  const [row] = await db.update(followups).set(patch).where(eq(followups.id, Number(id))).returning();
  return Response.json(row ?? null);
}

export async function DELETE(_req: Request, { params }: Ctx) {
  await ensureSchema();
  const { id } = await params;
  await db.delete(followups).where(eq(followups.id, Number(id)));
  return Response.json({ ok: true });
}
