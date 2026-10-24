import { desc, eq, ilike, or } from "drizzle-orm";
import { db } from "@/db";
import { customers, deals, inventory } from "@/db/schema";
import { applyVehicleToDeal } from "@/lib/inventory";
import { customerLabel, defaultDeal, normalizeDeal, vehicleLabel } from "@/lib/deal";
import { ensureSchema, getSessionUser, getSettings, toVehicle } from "@/lib/server";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  await ensureSchema();
  const q = new URL(req.url).searchParams.get("q")?.trim();
  const base = db
    .select({
      id: deals.id,
      dealNumber: deals.dealNumber,
      customerName: deals.customerName,
      vehicleLabel: deals.vehicleLabel,
      dealType: deals.dealType,
      status: deals.status,
      updatedAt: deals.updatedAt,
      createdAt: deals.createdAt,
    })
    .from(deals);
  const rows = q
    ? await base
        .where(or(ilike(deals.customerName, `%${q}%`), ilike(deals.vehicleLabel, `%${q}%`), ilike(deals.dealNumber, `%${q}%`)))
        .orderBy(desc(deals.updatedAt))
    : await base.orderBy(desc(deals.updatedAt)).limit(500);
  return Response.json(rows);
}

export async function POST(req: Request) {
  await ensureSchema();
  const body = (await req.json().catch(() => ({}))) as { duplicateOf?: number; inventoryId?: number; customerId?: number };
  let data = defaultDeal(await getSettings());
  if (body.duplicateOf) {
    const src = await db.select().from(deals).where(eq(deals.id, Number(body.duplicateOf)));
    if (src[0]) data = normalizeDeal(src[0].data);
  }
  if (!body.duplicateOf) {
    // the logged-in staff member is the salesperson (falls back to the Settings default)
    const me = await getSessionUser();
    if (me?.staffId) data.salesperson = me.name;
  }
  if (body.customerId) {
    const cu = await db.select().from(customers).where(eq(customers.id, Number(body.customerId)));
    if (cu[0]) {
      const x = cu[0];
      data.customer = {
        ...data.customer,
        id: x.id,
        firstName: x.firstName,
        lastName: x.lastName,
        email: x.email,
        homePhone: x.homePhone,
        mobile: x.mobile,
        address: x.address,
        city: x.city,
        province: x.province || data.customer.province,
        postal: x.postal,
      };
    }
  }
  if (body.inventoryId) {
    const inv = await db.select().from(inventory).where(eq(inventory.id, Number(body.inventoryId)));
    if (inv[0]) applyVehicleToDeal(data, toVehicle(inv[0]));
  }
  const [row] = await db
    .insert(deals)
    .values({
      dealNumber: "TMP",
      customerName: customerLabel(data),
      vehicleLabel: vehicleLabel(data),
      dealType: data.dealType,
      status: data.status,
      data,
    })
    .returning();
  const dealNumber = String(39978000 + row.id);
  await db.update(deals).set({ dealNumber }).where(eq(deals.id, row.id));
  return Response.json({ id: row.id, dealNumber });
}
