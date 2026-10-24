/** Permission roles (value → French label). Admin-level roles have full access. */
export const ROLES: Record<string, { label: string; full: boolean }> = {
  owner: { label: "Super Admin / Propriétaire", full: true },
  admin: { label: "Administrateur", full: true },
  sales_manager: { label: "Directeur des ventes", full: true },
  finance: { label: "Directeur financier", full: false },
  sales: { label: "Représentant des ventes", full: false },
  appraiser: { label: "Évaluateur", full: false },
  inventory: { label: "Gestionnaire d'inventaire", full: false },
  service: { label: "Service", full: false },
  administration: { label: "Administration", full: false },
};
export const ROLE_KEYS = Object.keys(ROLES);
export const normalizeRole = (r: unknown) => {
  const v = String(r ?? "");
  if (v === "staff") return "sales";
  return ROLE_KEYS.includes(v) ? v : "sales";
};
export const DEPARTMENTS = ["Direction", "Ventes", "Finance", "Service", "Inventaire", "Carrosserie", "Esthétique", "Administration"];
