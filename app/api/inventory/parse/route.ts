import { db } from "@/db";
import { inventory } from "@/db/schema";
import { markDuplicates, parseInventoryText, type InventoryVehicle } from "@/lib/inventory";
import { ensureSchema } from "@/lib/server";

export const dynamic = "force-dynamic";

/** Optional AI extraction (used automatically when OPENAI_API_KEY is configured). */
async function aiExtract(text: string): Promise<InventoryVehicle[] | null> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              'Extract every distinct vehicle from dealer inventory text. Return JSON {"vehicles":[{"year":"","make":"","model":"","trim":"","stock":"","vin":"","price":0,"kms":0,"extColor":""}]}. ' +
              "price and kms are numbers (no symbols). Ignore marketing words like New Arrival, Previous, Next, Your price. Do not repeat the same vehicle.",
          },
          { role: "user", content: text.slice(0, 60000) },
        ],
      }),
    });
    if (!res.ok) return null;
    const j = await res.json();
    const parsed = JSON.parse(j.choices?.[0]?.message?.content ?? "{}") as { vehicles?: Partial<InventoryVehicle>[] };
    if (!Array.isArray(parsed.vehicles) || !parsed.vehicles.length) return null;
    return parsed.vehicles.map((v) => {
      const kms = Number(v.kms) || 0;
      return {
        year: String(v.year ?? ""),
        make: String(v.make ?? ""),
        model: String(v.model ?? ""),
        trim: String(v.trim ?? ""),
        stock: String(v.stock ?? "").toUpperCase(),
        vin: String(v.vin ?? "").toUpperCase(),
        price: Number(v.price) || 0,
        kms,
        extColor: String(v.extColor ?? ""),
        condition: kms <= 500 ? "NEUF" : "USAGÉ",
      };
    });
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  await ensureSchema();
  const { text } = (await req.json()) as { text?: string };
  if (!text?.trim()) return Response.json({ vehicles: [], engine: "rules" });
  const ai = await aiExtract(text);
  const list = ai ?? parseInventoryText(text);
  const existing = await db.select({ id: inventory.id, dedupeKey: inventory.dedupeKey, vin: inventory.vin }).from(inventory);
  return Response.json({ vehicles: markDuplicates(list, existing), engine: ai ? "ai" : "rules" });
}
