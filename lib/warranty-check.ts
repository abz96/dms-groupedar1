/** OEM factory warranty (Canada, new vehicles) + VIN helpers. Values are indicative — confirm with the manufacturer. */

export interface OemCoverage {
  years: number;
  /** null = unlimited km */
  km: number | null;
}
export interface OemWarranty {
  basic: OemCoverage;
  powertrain: OemCoverage;
  powertrainLabel?: string;
  roadside?: OemCoverage;
  note?: string;
}

const w = (by: number, bk: number | null, py: number, pk: number | null, extra: Partial<OemWarranty> = {}): OemWarranty => ({
  basic: { years: by, km: bk },
  powertrain: { years: py, km: pk },
  ...extra,
});

export const OEM_WARRANTIES: Record<string, OemWarranty> = {
  ACURA: w(4, 80000, 5, 100000),
  "ALFA ROMEO": w(4, 80000, 4, 80000),
  "ASTON MARTIN": w(3, null, 3, null),
  AUDI: w(4, 80000, 4, 80000),
  BENTLEY: w(3, null, 3, null),
  BMW: w(4, 80000, 4, 80000),
  BUICK: w(3, 60000, 5, 160000),
  CADILLAC: w(4, 80000, 6, 110000),
  CHEVROLET: w(3, 60000, 5, 160000),
  CHRYSLER: w(3, 60000, 5, 100000),
  DODGE: w(3, 60000, 5, 100000),
  FERRARI: w(3, null, 3, null),
  FIAT: w(3, 60000, 5, 100000),
  FORD: w(3, 60000, 5, 100000),
  GENESIS: w(5, 100000, 5, 100000),
  GMC: w(3, 60000, 5, 160000),
  HONDA: w(3, 60000, 5, 100000),
  HYUNDAI: w(5, 100000, 5, 100000),
  INFINITI: w(4, 100000, 6, 110000),
  JAGUAR: w(4, 80000, 4, 80000),
  JEEP: w(3, 60000, 5, 100000),
  KIA: w(5, 100000, 5, 100000),
  LAMBORGHINI: w(3, null, 3, null),
  "LAND ROVER": w(4, 80000, 4, 80000),
  LEXUS: w(4, 80000, 6, 110000),
  LINCOLN: w(4, 80000, 6, 110000),
  LUCID: w(4, 80000, 8, 160000, { powertrainLabel: "Batterie & groupe motopropulseur" }),
  MASERATI: w(4, 80000, 4, 80000),
  MAZDA: w(3, null, 5, null),
  MCLAREN: w(3, null, 3, null),
  "MERCEDES-BENZ": w(4, 80000, 4, 80000),
  MINI: w(4, 80000, 4, 80000),
  MITSUBISHI: w(5, 100000, 10, 160000),
  NISSAN: w(3, 60000, 5, 100000),
  POLESTAR: w(4, 80000, 8, 160000, { powertrainLabel: "Batterie haute tension" }),
  PORSCHE: w(4, 80000, 4, 80000),
  RAM: w(3, 60000, 5, 100000),
  RIVIAN: w(5, 100000, 8, 175000, { powertrainLabel: "Batterie & groupe motopropulseur" }),
  "ROLLS-ROYCE": w(4, null, 4, null),
  SUBARU: w(3, 60000, 5, 100000),
  TESLA: w(4, 80000, 8, 160000, { powertrainLabel: "Batterie & groupe motopropulseur", note: "Model S/X : batterie 8 ans / 240 000 km." }),
  TOYOTA: w(3, 60000, 5, 100000),
  VOLKSWAGEN: w(4, 80000, 5, 100000),
  VOLVO: w(4, 80000, 4, 80000),
};

/** World Manufacturer Identifier → make (fallback when the online decoder is unavailable) */
const WMI: Record<string, string> = {
  "5YJ": "TESLA", "7SA": "TESLA", LRW: "TESLA", XP7: "TESLA",
  "1HG": "HONDA", "2HG": "HONDA", "5FN": "HONDA", "5J6": "HONDA", "2HK": "HONDA", "19X": "HONDA", "JHM": "HONDA", "19U": "ACURA", "5J8": "ACURA", JH4: "ACURA",
  "2T3": "TOYOTA", "4T1": "TOYOTA", "5TD": "TOYOTA", "5TF": "TOYOTA", JTD: "TOYOTA", JTE: "TOYOTA", JTM: "TOYOTA", JTN: "TOYOTA", "2T1": "TOYOTA", "4T3": "TOYOTA",
  JTH: "LEXUS", JTJ: "LEXUS", "2T2": "LEXUS", "58A": "LEXUS",
  WBA: "BMW", WBS: "BMW", WBY: "BMW", "5UX": "BMW", "5YM": "BMW", WMW: "MINI",
  WDD: "MERCEDES-BENZ", WDC: "MERCEDES-BENZ", W1K: "MERCEDES-BENZ", W1N: "MERCEDES-BENZ", W1V: "MERCEDES-BENZ", "4JG": "MERCEDES-BENZ", "55S": "MERCEDES-BENZ",
  WAU: "AUDI", WA1: "AUDI", WUA: "AUDI", TRU: "AUDI",
  WP0: "PORSCHE", WP1: "PORSCHE", ZHW: "LAMBORGHINI", ZFF: "FERRARI", ZAM: "MASERATI", ZN6: "MASERATI", ZAR: "ALFA ROMEO", ZAS: "ALFA ROMEO",
  SAL: "LAND ROVER", SAJ: "JAGUAR", SCB: "BENTLEY", SCA: "ROLLS-ROYCE", SBM: "MCLAREN", SCF: "ASTON MARTIN",
  "1FA": "FORD", "1FM": "FORD", "1FT": "FORD", "2FM": "FORD", "3FA": "FORD", "1LN": "LINCOLN", "5LM": "LINCOLN",
  "1G1": "CHEVROLET", "1GC": "CHEVROLET", "2G1": "CHEVROLET", "3GN": "CHEVROLET", "1GN": "CHEVROLET", "1GT": "GMC", "3GT": "GMC", "1GK": "GMC", "1G6": "CADILLAC", "1GY": "CADILLAC", "1G4": "BUICK", "KL4": "BUICK",
  "1C4": "JEEP", "1J4": "JEEP", "1C6": "RAM", "3C6": "RAM", "2C3": "DODGE", "1C3": "CHRYSLER", "2C4": "CHRYSLER",
  KMH: "HYUNDAI", "5NM": "HYUNDAI", "5NP": "HYUNDAI", KM8: "HYUNDAI", KNA: "KIA", KND: "KIA", "5XY": "KIA", "5XX": "KIA", KMT: "GENESIS",
  JM1: "MAZDA", JM3: "MAZDA", "3MZ": "MAZDA", JF1: "SUBARU", JF2: "SUBARU", "4S3": "SUBARU", "4S4": "SUBARU",
  "1N4": "NISSAN", "1N6": "NISSAN", "3N1": "NISSAN", "5N1": "NISSAN", JN1: "NISSAN", JN8: "NISSAN", JNK: "INFINITI", "5N3": "INFINITI",
  "3VW": "VOLKSWAGEN", WVW: "VOLKSWAGEN", WVG: "VOLKSWAGEN", "1V2": "VOLKSWAGEN", YV1: "VOLVO", YV4: "VOLVO", "7JR": "VOLVO",
  JA4: "MITSUBISHI", ML3: "MITSUBISHI", "7PD": "RIVIAN", "50E": "LUCID", LPS: "POLESTAR",
};

const YEAR_CODES = "ABCDEFGHJKLMNPRSTVWXY123456789";

export function normalizeVin(v: string) {
  return v.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function vinFormatError(vin: string): string | null {
  if (vin.length !== 17) return "Le NIV doit contenir 17 caractères.";
  if (/[IOQ]/.test(vin)) return "Le NIV ne peut pas contenir les lettres I, O ou Q.";
  return null;
}

/** North-American check digit (position 9). */
export function vinCheckDigitValid(vin: string): boolean {
  const map: Record<string, number> = { A: 1, B: 2, C: 3, D: 4, E: 5, F: 6, G: 7, H: 8, J: 1, K: 2, L: 3, M: 4, N: 5, P: 7, R: 9, S: 2, T: 3, U: 4, V: 5, W: 6, X: 7, Y: 8, Z: 9 };
  const weights = [8, 7, 6, 5, 4, 3, 2, 10, 0, 9, 8, 7, 6, 5, 4, 3, 2];
  let sum = 0;
  for (let i = 0; i < 17; i++) {
    const c = vin[i];
    const v = /\d/.test(c) ? Number(c) : map[c] ?? 0;
    sum += v * weights[i];
  }
  const r = sum % 11;
  return vin[8] === (r === 10 ? "X" : String(r));
}

/** Model year from position 10 (30-year cycle, choose the most recent plausible year). */
export function vinModelYear(vin: string, now = new Date()): number | null {
  const idx = YEAR_CODES.indexOf(vin[9]);
  if (idx < 0) return null;
  const maxYear = now.getFullYear() + 1;
  let y = 1980 + idx;
  while (y + 30 <= maxYear) y += 30;
  return y;
}

export function vinMakeFallback(vin: string): string | null {
  return WMI[vin.slice(0, 3)] ?? null;
}

export function oemWarrantyFor(make: string): OemWarranty | null {
  const m = make.toUpperCase().trim();
  if (OEM_WARRANTIES[m]) return OEM_WARRANTIES[m];
  if (m.startsWith("MERCEDES")) return OEM_WARRANTIES["MERCEDES-BENZ"];
  if (m.includes("ROVER")) return OEM_WARRANTIES["LAND ROVER"];
  if (m.includes("ROLLS")) return OEM_WARRANTIES["ROLLS-ROYCE"];
  return null;
}

export interface CoverageStatus {
  label: string;
  years: number;
  km: number | null;
  expiresOn: string;
  active: boolean;
  /** reason when expired: time | km */
  expiredBy: "time" | "km" | null;
  daysLeft: number;
  kmLeft: number | null;
}

export function coverageStatus(label: string, c: OemCoverage, start: Date, km: number | null, now = new Date()): CoverageStatus {
  const end = new Date(start);
  end.setFullYear(end.getFullYear() + c.years);
  const daysLeft = Math.ceil((end.getTime() - now.getTime()) / 86400000);
  const kmLeft = c.km === null || km === null ? null : c.km - km;
  const timeOk = daysLeft > 0;
  const kmOk = kmLeft === null || kmLeft > 0;
  return {
    label,
    years: c.years,
    km: c.km,
    expiresOn: end.toISOString().slice(0, 10),
    active: timeOk && kmOk,
    expiredBy: !timeOk ? "time" : !kmOk ? "km" : null,
    daysLeft,
    kmLeft,
  };
}
