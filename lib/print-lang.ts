import { cookies } from "next/headers";

export async function resolvePrintLang(q?: string): Promise<"fr" | "en"> {
  if (q === "fr" || q === "en") return q;
  return (await cookies()).get("lang")?.value === "en" ? "en" : "fr";
}
