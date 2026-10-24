import { and, eq, ne } from "drizzle-orm";
import { db } from "@/db";
import { inventory } from "@/db/schema";
import { dedupeKey, type InventoryVehicle } from "@/lib/inventory";
import { ensureSchema, toVehicle } from "@/lib/server";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function PUT(req: Request, { params }: Ctx) {
  await ensureSchema();
  const { id } = await params;
  const v = (await req.json()) as InventoryVehicle;
  const values = {
    stock: (v.stock ?? "").trim().toUpperCase(),
    vin: (v.vin ?? "").trim().toUpperCase(),
    year: String(v.year ?? ""),
    make: v.make ?? "",
    model: v.model ?? "",
    trim: v.trim ?? "",
    price: String(Number(v.price) || 0),
    kms: String(Number(v.kms) || 0),
    extColor: v.extColor ?? "",
    condition: v.condition || "USAGÉ",
    status: ["available", "hold", "sold", "employee"].includes(String(v.status)) ? String(v.status) : "available",
    employeeName: v.status === "employee" ? String(v.employeeName ?? "").trim() : "",
  };
  const key = dedupeKey({ ...values, price: Number(values.price), kms: Number(values.kms) });
  const clash = await db
    .select({ id: inventory.id })
    .from(inventory)
    .where(and(eq(inventory.dedupeKey, key), ne(inventory.id, Number(id))))
    .limit(1);
  if (clash[0]) return Response.json({ error: "Doublon : ce # de stock existe déjà dans l'inventaire." }, { status: 409 });
  const [row] = await db
    .update(inventory)
    .set({ ...values, dedupeKey: key, updatedAt: new Date() })
    .where(eq(inventory.id, Number(id)))
    .returning();
  return Response.json(row ? toVehicle(row) : null);
}

export async function DELETE(_req: Request, { params }: Ctx) {
  await ensureSchema();
  const { id } = await params;
  await db.delete(inventory).where(eq(inventory.id, Number(id)));
  return Response.json({ ok: true });
}
