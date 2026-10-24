"use client";

import { useEffect, useMemo, useState } from "react";
import { useT } from "@/lib/i18n";

export interface StaffLite {
  id: number;
  name: string;
  position: string;
  department?: string;
  active?: boolean;
}

let cache: Promise<StaffLite[]> | null = null;
function loadStaff(): Promise<StaffLite[]> {
  if (!cache) {
    cache = fetch("/api/staff")
      .then((r) => (r.ok ? r.json() : []))
      .then((l: StaffLite[]) => l.filter((x) => x.active !== false))
      .catch(() => {
        cache = null;
        return [];
      });
  }
  return cache;
}

export function useStaffList() {
  const [list, setList] = useState<StaffLite[]>([]);
  useEffect(() => {
    let alive = true;
    void loadStaff().then((l) => alive && setList(l));
    return () => {
      alive = false;
    };
  }, []);
  return list;
}

/** Department order: sales-facing first */
const DEPT_ORDER = ["Ventes", "Direction", "Finance", "Inventaire", "Administration", "Service", "Carrosserie", "Esthétique"];

/**
 * Dropdown of employees (from the Staff list), grouped by department.
 * `prefer` puts the given departments first (e.g. Finance for the F&I manager).
 */
export default function StaffSelect({
  value,
  onChange,
  className = "",
  prefer,
  placeholder,
}: {
  value: string;
  onChange: (name: string) => void;
  className?: string;
  prefer?: string[];
  placeholder?: string;
}) {
  const t = useT();
  const list = useStaffList();
  const groups = useMemo(() => {
    const order = [...(prefer ?? []), ...DEPT_ORDER.filter((d) => !prefer?.includes(d))];
    const m = new Map<string, StaffLite[]>();
    for (const s of list) {
      const d = s.department || "—";
      if (!m.has(d)) m.set(d, []);
      m.get(d)!.push(s);
    }
    return [...m.entries()].sort((a, b) => {
      const ia = order.indexOf(a[0]);
      const ib = order.indexOf(b[0]);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    });
  }, [list, prefer]);
  const known = list.some((s) => s.name === value);

  return (
    <select className={`fld ${className}`} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">{placeholder ?? `— ${t("Choisir un employé")} —`}</option>
      {value && !known && <option value={value}>{value}</option>}
      {groups.map(([dept, people]) => (
        <optgroup key={dept} label={t(dept)}>
          {people.map((s) => (
            <option key={s.id} value={s.name}>
              {s.name}{s.position ? ` — ${t(s.position)}` : ""}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}
