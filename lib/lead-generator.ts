/** Realistic Greater-Montréal lead generator (names, phones, addresses). */

export type Region = "montreal" | "westisland" | "laval" | "southshore" | "northshore";

export const REGION_LABEL: Record<Region, string> = {
  montreal: "Montréal",
  westisland: "Ouest-de-l'Île",
  laval: "Laval",
  southshore: "Rive-Sud",
  northshore: "Rive-Nord",
};

const AREA: Record<Region, string[]> = {
  montreal: ["514", "514", "438", "438", "263"],
  westisland: ["514", "514", "438"],
  laval: ["450", "450", "579", "354"],
  southshore: ["450", "450", "579", "354"],
  northshore: ["450", "450", "579", "354"],
};

/** [city, street, FSA, civic min, civic max, apartments likely] */
type Street = [string, string, string, number, number, boolean];
const STREETS: Record<Region, Street[]> = {
  montreal: [
    ["Montréal", "Rue Fleury Est", "H2C", 1000, 2900, true],
    ["Montréal", "Boulevard Saint-Michel", "H1Z", 7000, 9800, true],
    ["Montréal", "Rue Jean-Talon Est", "H1S", 4500, 7900, true],
    ["Montréal", "Rue Sherbrooke Est", "H1L", 8000, 9900, true],
    ["Montréal", "Avenue Papineau", "H2G", 5000, 6800, true],
    ["Montréal", "Rue Beaubien Est", "H2S", 100, 2400, true],
    ["Montréal", "Boulevard Henri-Bourassa Est", "H1H", 3000, 5500, true],
    ["Montréal", "Rue Notre-Dame Ouest", "H4C", 2500, 4500, true],
    ["Montréal", "Avenue de Monkland", "H4A", 4800, 6400, true],
    ["Montréal", "Rue Saint-Denis", "H2J", 4000, 5600, true],
    ["Montréal", "Boulevard Gouin Ouest", "H4J", 9000, 12000, false],
    ["Montréal", "Rue Wellington", "H4G", 3500, 5200, true],
    ["Montréal", "Boulevard LaSalle", "H8P", 7000, 9500, true],
    ["Montréal", "Avenue Somerled", "H4V", 5500, 7300, true],
    ["Montréal", "Boulevard Maurice-Duplessis", "H1G", 5000, 7900, false],
    ["Montréal", "Rue Bélanger", "H1T", 4000, 6500, true],
    ["Montréal", "Boulevard Décarie", "H4L", 1100, 2600, true],
    ["Montréal", "Rue de Salaberry", "H3M", 2000, 4500, false],
  ],
  westisland: [
    ["Dollard-des-Ormeaux", "Boulevard des Sources", "H9B", 3000, 4800, false],
    ["Dollard-des-Ormeaux", "Rue Lake", "H9B", 1, 400, false],
    ["Pointe-Claire", "Avenue Cartier", "H9S", 1, 300, false],
    ["Kirkland", "Boulevard Saint-Charles", "H9H", 2800, 3900, false],
    ["Montréal (Pierrefonds)", "Boulevard de Pierrefonds", "H9H", 15000, 19000, true],
    ["Beaconsfield", "Boulevard Beaconsfield", "H9W", 1, 500, false],
    ["Dorval", "Avenue Dorval", "H9S", 300, 900, true],
    ["Montréal (Saint-Laurent)", "Boulevard Thimens", "H4R", 1500, 3800, true],
  ],
  laval: [
    ["Laval", "Boulevard Notre-Dame", "H7W", 3000, 5200, true],
    ["Laval", "Boulevard Saint-Martin Ouest", "H7S", 1000, 2900, true],
    ["Laval", "Boulevard des Laurentides", "H7M", 3000, 5500, false],
    ["Laval", "Boulevard Sainte-Rose", "H7L", 1, 2500, false],
    ["Laval", "Boulevard de la Concorde Est", "H7E", 1, 3000, true],
    ["Laval", "Boulevard Dagenais Ouest", "H7P", 1, 4500, false],
    ["Laval", "Rue Principale", "H7X", 400, 1800, false],
    ["Laval", "Boulevard Lévesque Est", "H7C", 3000, 7500, false],
  ],
  southshore: [
    ["Longueuil", "Chemin de Chambly", "J4H", 100, 1500, true],
    ["Longueuil", "Rue Saint-Charles Ouest", "J4H", 100, 900, true],
    ["Brossard", "Boulevard Rome", "J4W", 4000, 7900, true],
    ["Brossard", "Boulevard Taschereau", "J4Z", 8000, 9800, true],
    ["Longueuil (Saint-Hubert)", "Boulevard Cousineau", "J3Y", 3000, 6500, false],
    ["Boucherville", "Boulevard de Mortagne", "J4B", 100, 1600, false],
    ["Saint-Lambert", "Avenue Victoria", "J4P", 100, 800, true],
    ["La Prairie", "Boulevard Taschereau", "J5R", 400, 1600, false],
    ["Châteauguay", "Boulevard d'Anjou", "J6K", 100, 1000, false],
    ["Sainte-Julie", "Boulevard Armand-Frappier", "J3E", 100, 2400, false],
    ["Candiac", "Boulevard Montcalm Nord", "J5R", 1, 300, false],
    ["Saint-Bruno-de-Montarville", "Boulevard Seigneurial Ouest", "J3V", 100, 1800, false],
  ],
  northshore: [
    ["Terrebonne", "Boulevard des Seigneurs", "J6W", 1000, 3500, false],
    ["Terrebonne", "Montée Masson", "J6W", 100, 2500, false],
    ["Repentigny", "Boulevard Iberville", "J6A", 100, 1200, true],
    ["Blainville", "Boulevard du Curé-Labelle", "J7C", 900, 1600, false],
    ["Boisbriand", "Boulevard de la Grande-Allée", "J7G", 600, 4000, false],
    ["Mirabel", "Boulevard de Saint-Canut", "J7N", 13000, 16000, false],
    ["Saint-Eustache", "Rue Saint-Eustache", "J7R", 100, 800, true],
    ["Mascouche", "Chemin Sainte-Marie", "J7K", 100, 2900, false],
    ["Sainte-Thérèse", "Rue Blainville Est", "J7E", 1, 400, true],
    ["Saint-Jérôme", "Rue De Martigny Ouest", "J7Y", 100, 900, true],
    ["Rosemère", "Boulevard Labelle", "J7A", 100, 500, false],
  ],
};

/** Name pools by community (weights reflect Greater Montréal) */
const NAMES: { w: number; male: string[]; female: string[]; last: string[] }[] = [
  {
    w: 55,
    male: ["Jean-François", "Mathieu", "Maxime", "Alexandre", "Gabriel", "Samuel", "Olivier", "Simon", "Philippe", "Étienne", "Marc-André", "Sébastien", "Vincent", "Félix", "Louis", "William", "Jérémie", "Patrick", "Martin", "Éric", "Francis", "Nicolas", "Charles", "Guillaume", "Antoine", "Kevin"],
    female: ["Marie-Ève", "Julie", "Catherine", "Isabelle", "Geneviève", "Mélanie", "Valérie", "Émilie", "Audrey", "Stéphanie", "Chloé", "Camille", "Léa", "Sarah", "Annie", "Josée", "Karine", "Nathalie", "Véronique", "Marie-Pier", "Andréanne", "Jessica", "Noémie", "Roxanne"],
    last: ["Tremblay", "Gagnon", "Roy", "Côté", "Bouchard", "Gauthier", "Morin", "Lavoie", "Fortin", "Gagné", "Ouellet", "Pelletier", "Bélanger", "Lévesque", "Bergeron", "Leblanc", "Paquette", "Girard", "Simard", "Boucher", "Caron", "Beaulieu", "Cloutier", "Dubé", "Poirier", "Fournier", "Lapointe", "Leclerc", "Lefebvre", "Poulin", "Thibault", "St-Pierre", "Nadeau", "Landry", "Bédard", "Grenier", "Lessard", "Bernier", "Michaud", "Hébert", "Desjardins", "Couture", "Lachance", "Parent", "Gosselin", "Proulx", "Beaudoin", "Demers", "Perreault", "Charbonneau", "Lalonde", "Labelle"],
  },
  { w: 8, male: ["Marco", "Giovanni", "Luca", "Antonio", "Dominic", "Stefano", "Matteo"], female: ["Elena", "Giulia", "Francesca", "Maria", "Alessia", "Sabrina"], last: ["Rossi", "Russo", "Ferraro", "Esposito", "Romano", "Colombo", "DiMaio", "Ricci", "Lombardi", "Bianchi", "Iannuzzi", "Mancini"] },
  { w: 5, male: ["Nikos", "Dimitri", "Kostas", "Georgios", "Yannis"], female: ["Eleni", "Sofia", "Katerina", "Despina"], last: ["Papadopoulos", "Georgiou", "Konstantinou", "Nikolaidis", "Karamanlis", "Vlachos"] },
  { w: 10, male: ["Mohamed", "Karim", "Ahmad", "Youssef", "Omar", "Rami", "Samir", "Walid", "Mehdi"], female: ["Yasmine", "Rania", "Fatima", "Nour", "Leila", "Amira", "Sara", "Ines"], last: ["Haddad", "Khoury", "Benali", "Saleh", "Mansour", "Bouzid", "El-Amine", "Hamdan", "Chaker", "Nassar", "Belkacem", "Daher"] },
  { w: 7, male: ["Jean-Robert", "Wilson", "Ricardo", "Frantz", "Steeve", "Kervens"], female: ["Widelande", "Nadège", "Roseline", "Mirlande", "Sabine", "Daphnée"], last: ["Joseph", "Pierre-Louis", "Jean-Baptiste", "Dorvil", "Charles", "Augustin", "Saint-Fleur", "Désir"] },
  { w: 6, male: ["Minh", "Wei", "Thanh", "Jun", "Kevin", "David"], female: ["Linh", "Mei", "Thu", "Anh", "Jenny", "Vivian"], last: ["Nguyen", "Tran", "Pham", "Le", "Chen", "Li", "Wong", "Zhang"] },
  { w: 4, male: ["Raj", "Arjun", "Harpreet", "Vikram", "Imran"], female: ["Priya", "Simran", "Anjali", "Ayesha"], last: ["Patel", "Singh", "Sharma", "Gill", "Ahmed", "Rahman"] },
  { w: 5, male: ["Carlos", "Diego", "Joao", "Miguel", "Andrés"], female: ["Ana", "Gabriela", "Mariana", "Lucia", "Fernanda"], last: ["Silva", "Santos", "Gonzalez", "Rodriguez", "Ferreira", "Martinez", "Pereira"] },
];

const EMAIL_DOMAINS = ["gmail.com", "gmail.com", "gmail.com", "hotmail.com", "hotmail.com", "outlook.com", "videotron.ca", "icloud.com", "yahoo.ca", "live.ca", "bell.net"];
export const LEAD_SOURCES = ["Site Web", "Facebook", "Marketplace", "AutoTrader", "Kijiji", "Walk-in", "Téléphone", "Référence", "Instagram", "Google"];

const POSTAL_LETTERS = "ABCEGHJKLMNPRSTVWXYZ";

export type Rng = () => number;
/** Small seedable PRNG (mulberry32) */
export function makeRng(seed = Date.now() ^ Math.floor(Math.random() * 1e9)): Rng {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const pick = <T,>(r: Rng, a: T[]): T => a[Math.floor(r() * a.length)];
export const between = (r: Rng, min: number, max: number) => min + r() * (max - min);
export const int = (r: Rng, min: number, max: number) => Math.floor(between(r, min, max + 1));
export function weighted<T extends string>(r: Rng, w: Record<T, number>): T {
  const entries = Object.entries(w) as [T, number][];
  const total = entries.reduce((a, [, v]) => a + v, 0);
  let x = r() * total;
  for (const [k, v] of entries) if ((x -= v) < 0) return k;
  return entries[0][0];
}

const ascii = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z]/g, "");

export function makePhone(r: Rng, region: Region, fictional = false) {
  const area = pick(r, AREA[region]);
  let exch: number;
  do exch = int(r, 200, 989);
  while (exch % 100 === 11 || exch === 555 || exch === 911);
  const line = fictional ? `01${int(r, 0, 9)}${int(r, 0, 9)}` : String(int(r, 1000, 9999));
  return `${area}-${fictional ? "555" : exch}-${line}`;
}

export function makeIdentity(r: Rng, region: Region, fictional = false) {
  const total = NAMES.reduce((a, g) => a + g.w, 0);
  let x = r() * total;
  let grp = NAMES[0];
  for (const g of NAMES) {
    if ((x -= g.w) < 0) {
      grp = g;
      break;
    }
  }
  const female = r() < 0.48;
  const firstName = pick(r, female ? grp.female : grp.male);
  const lastName = pick(r, grp.last);
  const [city, street, fsa, cmin, cmax, apts] = pick(r, STREETS[region]);
  const civic = int(r, cmin, cmax);
  const apt = apts && r() < 0.45 ? `, app. ${int(r, 1, 12)}` : "";
  const postal = `${fsa} ${int(r, 0, 9)}${pick(r, POSTAL_LETTERS.split(""))}${int(r, 0, 9)}`;
  const f = ascii(firstName.split(/[\s-]/)[0]);
  const l = ascii(lastName);
  const style = int(r, 0, 4);
  const handle =
    style === 0 ? `${f}.${l}` : style === 1 ? `${f}${l}${int(r, 1, 99)}` : style === 2 ? `${f[0]}${l}` : style === 3 ? `${f}_${l}` : `${l}.${f}${int(r, 70, 99)}`;
  return {
    firstName,
    lastName,
    mobile: makePhone(r, region, fictional),
    email: `${handle}@${pick(r, EMAIL_DOMAINS)}`,
    address: `${civic} ${street}${apt}`,
    city,
    province: "QC",
    postal,
  };
}

/** Round a desired payment the way customers say it (e.g. 800, 795, 450, 225). */
export function customerRound(r: Rng, v: number) {
  if (v >= 1000) return Math.round(v / 50) * 50 - (r() < 0.3 ? 1 : 0);
  if (v >= 300) return Math.round(v / 25) * 25 - (r() < 0.25 ? 5 : 0);
  return Math.max(25, Math.round(v / 5) * 5);
}
