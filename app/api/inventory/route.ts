import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { inventory } from "@/db/schema";
import { dedupeKey, type InventoryVehicle } from "@/lib/inventory";
import { ensureSchema, toVehicle } from "@/lib/server";

export const dynamic = "force-dynamic";

export async function GET() {
  await ensureSchema();
  const rows = await db.select().from(inventory).orderBy(desc(inventory.updatedAt));
  return Response.json(rows.map(toVehicle));
}

/** Import a list of vehicles; duplicates (same stock #, VIN, or identical listing) are never inserted twice. */
export async function POST(req: Request) {
  await ensureSchema();
  const { vehicles, updateExisting } = (await req.json()) as { vehicles: InventoryVehicle[]; updateExisting?: boolean };
  let inserted = 0;
  let updated = 0;
  let skipped = 0;
  const seen = new Set<string>();

  for (const v of vehicles ?? []) {
    if (!v.year || !v.make) {
      skipped++;
      continue;
    }
    const key = dedupeKey(v);
    if (seen.has(key)) {
      skipped++;
      continue;
    }
    seen.add(key);
    const values = {
      stock: (v.stock ?? "").trim().toUpperCase(),
      vin: (v.vin ?? "").trim().toUpperCase(),
      year: String(v.year),
      make: v.make,
      model: v.model ?? "",
      trim: v.trim ?? "",
      price: String(Number(v.price) || 0),
      kms: String(Number(v.kms) || 0),
      extColor: v.extColor ?? "",
      condition: v.condition || (Number(v.kms) <= 500 ? "NEUF" : "USAGÉ"),
      dedupeKey: key,
    };

    // match on dedupe key OR VIN
    const existing = await db
      .select({ id: inventory.id })
      .from(inventory)
      .where(values.vin ? sql`${inventory.dedupeKey} = ${key} OR upper(${inventory.vin}) = ${values.vin}` : eq(inventory.dedupeKey, key))
      .limit(1);

    if (existing[0]) {
      if (updateExisting) {
        await db
          .update(inventory)
          .set({ ...values, dedupeKey: undefined, updatedAt: new Date() })
          .where(eq(inventory.id, existing[0].id));
        updated++;
      } else skipped++;
      continue;
    }
    const res = await db.insert(inventory).values(values).onConflictDoNothing({ target: inventory.dedupeKey }).returning({ id: inventory.id });
    if (res.length) inserted++;
    else skipped++;
  }
  return Response.json({ inserted, updated, skipped });
}
