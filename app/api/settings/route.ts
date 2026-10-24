import { eq } from "drizzle-orm";
import { db } from "@/db";
import { settings } from "@/db/schema";
import { ensureSchema, getSessionUser, getSettings } from "@/lib/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const [s, me] = await Promise.all([getSettings(), getSessionUser()]);
  // the manager approval code is never sent to non-admin browsers
  return Response.json(me?.role === "admin" ? s : { ...s, managerCode: "" });
}

export async function PUT(req: Request) {
  await ensureSchema();
  const me = await getSessionUser();
  const data = (await req.json()) as Record<string, unknown>;
  const cur = (await db.select().from(settings).where(eq(settings.id, 1)))[0]?.data as Record<string, unknown> | undefined;
  if (me?.role !== "admin" || !String(data.managerCode ?? "").trim()) data.managerCode = cur?.managerCode ?? "9296";
  await db
    .insert(settings)
    .values({ id: 1, data })
    .onConflictDoUpdate({ target: settings.id, set: { data } });
  const s = await getSettings();
  return Response.json(me?.role === "admin" ? s : { ...s, managerCode: "" });
}
