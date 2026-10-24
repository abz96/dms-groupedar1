import { eq } from "drizzle-orm";
import type { ReactNode } from "react";
import { db } from "@/db";
import { deals } from "@/db/schema";
import { computeDeal, customerLabel, FREQ_LABEL, leaseConfig, money, normalizeDeal, vehicleLabel, type DealProduct } from "@/lib/deal";
import { translate } from "@/lib/i18n-server";
import { ensureSchema, getLenders, getSettings } from "@/lib/server";

type Lang = "fr" | "en";
const DICT: Record<string, [string, string]> = {
  billTitle: ["CONTRAT DE VENTE D'UN VÉHICULE", "VEHICLE BILL OF SALE"],
  warrantyTitle: ["CONTRAT DE GARANTIE PROLONGÉE", "EXTENDED WARRANTY CONTRACT"],
  tireTitle: ["CONTRAT DE PROTECTION PNEUS ET JANTES", "TIRE & RIM PROTECTION CONTRACT"],
  accTitle: ["FACTURE — ACCESSOIRES ET PROTECTIONS", "INVOICE — ACCESSORIES & PROTECTION"],
  fiTitle: ["CONTRAT — PLANS DE PROTECTION (PRODUITS F&A)", "PROTECTION PLANS CONTRACT (F&I PRODUCTS)"],
  contractNo: ["N° de contrat", "Contract #"],
  dealNo: ["N° de dossier", "Deal #"],
  date: ["Date", "Date"],
  seller: ["VENDEUR (COMMERÇANT)", "SELLER (DEALER)"],
  buyer: ["ACHETEUR", "BUYER"],
  coBuyer: ["Co-acheteur", "Co-buyer"],
  name: ["Nom", "Name"],
  address: ["Adresse", "Address"],
  phone: ["Téléphone", "Phone"],
  email: ["Courriel", "Email"],
  dealerNo: ["N° de commerçant", "Dealer #"],
  gst: ["N° TPS/TVH", "GST/HST #"],
  qst: ["N° TVQ", "QST #"],
  vehicle: ["VÉHICULE", "VEHICLE"],
  year: ["Année", "Year"],
  make: ["Marque", "Make"],
  model: ["Modèle", "Model"],
  trim: ["Version", "Trim"],
  vin: ["NIV", "VIN"],
  stock: ["N° de stock", "Stock #"],
  kms: ["Kilométrage", "Odometer"],
  colour: ["Couleur", "Colour"],
  condition: ["État", "Condition"],
  new: ["Neuf", "New"],
  used: ["Usagé", "Used"],
  demo: ["Démonstrateur", "Demo"],
  price: ["PRIX ET MODALITÉS", "PRICE & TERMS"],
  vehiclePrice: ["Prix du véhicule (PDSF + options)", "Vehicle price (MSRP + options)"],
  freight: ["Transport et préparation", "Freight & PDI"],
  dealerFees: ["Frais de concession", "Dealer fees"],
  accessories: ["Accessoires", "Accessories"],
  discount: ["Rabais", "Discount"],
  luxury: ["Taxe fédérale sur les produits de luxe", "Federal luxury tax"],
  tireTax: ["Droit environnemental sur les pneus neufs", "New tire environmental fee"],
  fi: ["Produits de protection (F&A)", "Protection products (F&I)"],
  subtotal: ["Sous-total", "Subtotal"],
  rebate: ["Remise du fabricant (avant taxes)", "Manufacturer rebate (pre-tax)"],
  tradeAllow: ["Valeur du véhicule d'échange", "Trade-in allowance"],
  taxable: ["Montant taxable", "Taxable amount"],
  totalTaxes: ["TOTAL TAXES INCLUSES", "TOTAL INCLUDING TAXES"],
  lienPayout: ["Solde dû sur l'échange (remboursé par le commerçant)", "Trade lien payout (paid by dealer)"],
  rmNonTax: ["Remise du fabricant (non taxable)", "Manufacturer rebate (non-taxable)"],
  rebateTaxIncl: ["Remise (taxes incluses)", "Rebate (tax included)"],
  deposit: ["Acompte versé", "Deposit paid"],
  cashDown: ["Comptant à la livraison", "Cash down"],
  deliveryFees: ["Frais à la livraison", "Delivery fees"],
  balance: ["SOLDE À PAYER / À FINANCER", "BALANCE DUE / TO BE FINANCED"],
  finTerms: ["MODALITÉS DE FINANCEMENT", "FINANCING TERMS"],
  leaseTerms: ["MODALITÉS DE LOCATION", "LEASE TERMS"],
  cashTerms: ["PAIEMENT COMPTANT", "CASH PAYMENT"],
  lender: ["Prêteur", "Lender"],
  term: ["Terme", "Term"],
  months: ["mois", "months"],
  rate: ["Taux annuel", "Annual rate"],
  payment: ["Paiement", "Payment"],
  nPayments: ["Nombre de paiements", "Number of payments"],
  financed: ["Montant financé", "Amount financed"],
  borrowing: ["Coût d'emprunt", "Cost of borrowing"],
  obligation: ["Obligation totale", "Total obligation"],
  capCost: ["Coût capitalisé", "Capitalized cost"],
  residual: ["Valeur résiduelle", "Residual value"],
  kmYear: ["Km / année", "Km / year"],
  excessKm: ["Km excédentaire", "Excess km"],
  taxesIncl: ["taxes incluses", "taxes included"],
  product: ["PRODUIT", "PRODUCT"],
  plan: ["Plan", "Plan"],
  code: ["Code", "Code"],
  coverage: ["Durée de couverture", "Coverage term"],
  years: ["ans", "years"],
  year1: ["an", "year"],
  start: ["Début de la couverture", "Coverage start"],
  end: ["Fin de la couverture", "Coverage end"],
  startKm: ["Kilométrage au départ", "Starting odometer"],
  deductible: ["Franchise", "Deductible"],
  perClaim: ["par réclamation", "per claim"],
  retail: ["Prix du contrat", "Contract price"],
  description: ["Description", "Description"],
  qty: ["Qté", "Qty"],
  unit: ["Prix unitaire", "Unit price"],
  amount: ["Montant", "Amount"],
  total: ["TOTAL", "TOTAL"],
  none: ["Aucun article de ce type sur ce dossier.", "No item of this type on this deal."],
  noneHint: ["Ajoutez-le dans le dossier (Achat → Gar. Prol. / Produits F&A / Accessoires), puis revenez à ce document.", "Add it in the deal (Purchase → Ext. Warranty / F&I products / Accessories), then return to this document."],
  conditions: ["CONDITIONS", "TERMS & CONDITIONS"],
  sigBuyer: ["Signature de l'acheteur", "Buyer signature"],
  sigCoBuyer: ["Signature du co-acheteur", "Co-buyer signature"],
  sigDealer: ["Signature du représentant du commerçant", "Dealer representative signature"],
  salesperson: ["Conseiller", "Salesperson"],
  fiManager: ["Directeur F&A", "F&I manager"],
  page: ["Document généré par Groupe Dar DMS", "Document generated by Groupe Dar DMS"],
  copy: ["Copie client", "Customer copy"],
  installedBy: ["Installé par le commerçant avant la livraison", "Installed by the dealer prior to delivery"],
  ack: ["L'acheteur reconnaît avoir reçu une copie du présent document.", "The buyer acknowledges receiving a copy of this document."],
};

const BILL_TERMS: [string, string][] = [
  [
    "Le commerçant déclare que le véhicule décrit ci-dessus est libre de toute dette, charge ou sûreté, sauf indication contraire. La propriété du véhicule est transférée à l'acheteur au paiement complet du prix ou à l'acceptation du financement par le prêteur.",
    "The dealer declares that the vehicle described above is free of any debt, charge or security interest unless otherwise stated. Ownership transfers to the buyer upon full payment or upon approval of financing by the lender.",
  ],
  [
    "L'acheteur déclare avoir examiné le véhicule et l'accepte dans l'état où il se trouve, sous réserve des garanties légales et de la garantie du fabricant applicables.",
    "The buyer declares having examined the vehicle and accepts it in its present condition, subject to applicable legal warranties and the manufacturer's warranty.",
  ],
  [
    "Le véhicule d'échange est accepté sous réserve d'une nouvelle inspection à la livraison. L'acheteur garantit l'exactitude du solde dû déclaré et demeure responsable de toute différence.",
    "The trade-in is accepted subject to re-inspection at delivery. The buyer guarantees the accuracy of the declared lien payout and remains responsible for any difference.",
  ],
  [
    "Les frais d'immatriculation de la SAAQ ne sont pas inclus. Le présent contrat est assujetti à la Loi sur la protection du consommateur du Québec.",
    "SAAQ registration fees are not included. This contract is subject to the Québec Consumer Protection Act.",
  ],
];
const WARRANTY_TERMS: [string, string][] = [
  [
    "Le présent contrat couvre les réparations des composantes mécaniques et électriques admissibles à la suite d'une panne survenant pendant la période de couverture, selon les conditions du plan choisi.",
    "This contract covers repairs of eligible mechanical and electrical components following a breakdown occurring during the coverage period, according to the terms of the selected plan.",
  ],
  [
    "Sont exclus : l'entretien régulier, l'usure normale, les dommages causés par un accident, un abus, une négligence ou une modification non autorisée, ainsi que les pièces d'usure (freins, essuie-glaces, ampoules, etc.).",
    "Excluded: regular maintenance, normal wear, damage caused by accident, abuse, neglect or unauthorized modification, and wear items (brakes, wipers, bulbs, etc.).",
  ],
  [
    "Le propriétaire doit faire effectuer l'entretien recommandé par le fabricant et conserver les preuves d'entretien. Toute réclamation doit être autorisée avant le début des réparations.",
    "The owner must have the manufacturer-recommended maintenance performed and keep proof of service. Every claim must be authorized before repairs begin.",
  ],
  [
    "Le contrat peut être annulé en tout temps; le remboursement est calculé au prorata de la période non utilisée, moins des frais d'administration. Le contrat est transférable à un nouveau propriétaire.",
    "The contract may be cancelled at any time; the refund is prorated on the unused period, less administration fees. The contract is transferable to a new owner.",
  ],
];
const TIRE_TERMS: [string, string][] = [
  [
    "Le présent contrat couvre la réparation ou le remplacement des pneus et jantes d'origine endommagés par un danger routier (nids-de-poule, clous, débris, etc.) pendant la période de couverture.",
    "This contract covers repair or replacement of the original tires and rims damaged by a road hazard (potholes, nails, debris, etc.) during the coverage period.",
  ],
  [
    "Sont exclus : l'usure normale de la bande de roulement, le vandalisme, le vol, les dommages esthétiques, les accidents de la route et les dommages causés par une utilisation hors route ou en compétition.",
    "Excluded: normal tread wear, vandalism, theft, cosmetic damage, road accidents and damage caused by off-road or racing use.",
  ],
  [
    "Les pneus de remplacement sont d'une qualité équivalente. La pose, l'équilibrage et la valve sont inclus. Le service routier est offert 24 h / 24 en cas de crevaison.",
    "Replacement tires are of equivalent quality. Mounting, balancing and valve stem are included. 24/7 roadside assistance is provided for flat tires.",
  ],
  [
    "Le contrat peut être annulé; le remboursement est calculé au prorata de la période non utilisée, moins des frais d'administration.",
    "The contract may be cancelled; the refund is prorated on the unused period, less administration fees.",
  ],
];
const FI_TERMS: [string, string][] = [
  [
    "Les produits de protection énumérés sont facultatifs. Leur achat n'est pas une condition à l'obtention du financement ou de la location du véhicule.",
    "The protection products listed are optional. Purchasing them is not a condition for obtaining financing or a lease on the vehicle.",
  ],
  [
    "Chaque produit est régi par les modalités, limites et exclusions de son certificat ou de sa police, remis à l'acheteur. En cas de divergence, le certificat prévaut.",
    "Each product is governed by the terms, limits and exclusions of its certificate or policy, provided to the buyer. In case of discrepancy, the certificate prevails.",
  ],
  [
    "Les produits d'assurance (crédit, remplacement, écart GAP) peuvent être résiliés dans les 10 jours suivant la signature sans frais; par la suite, le remboursement est calculé au prorata, moins les frais applicables.",
    "Insurance products (creditor, replacement, GAP) may be cancelled within 10 days of signing at no charge; thereafter, the refund is prorated, less applicable fees.",
  ],
  [
    "En cas de remboursement anticipé ou de résiliation du contrat de financement ou de location, l'acheteur peut demander l'annulation des produits et le remboursement de la portion non utilisée.",
    "If the finance or lease contract is paid off early or terminated, the buyer may request cancellation of the products and a refund of the unused portion.",
  ],
];
const ACC_TERMS: [string, string][] = [
  [
    "Les accessoires et protections énumérés sont installés ou appliqués par le commerçant avant la livraison du véhicule et font partie intégrante de la présente transaction.",
    "The accessories and protections listed are installed or applied by the dealer prior to delivery and form part of this transaction.",
  ],
  [
    "Les accessoires sont couverts par la garantie de leur fabricant. Les produits de protection sont régis par les conditions de leur programme respectif.",
    "Accessories are covered by their manufacturer's warranty. Protection products are governed by the terms of their respective program.",
  ],
];

export const DOC_KEYS = ["bill-of-sale", "warranty", "tire-rim", "fi-products", "accessories"] as const;

/** One printable deal document. With skipEmpty, returns null when the deal has nothing for it. */
export default async function DealDocument({ id, doc, lang, skipEmpty }: { id: number; doc: string; lang: Lang; skipEmpty?: boolean }) {
  if (!(DOC_KEYS as readonly string[]).includes(doc)) return null;
  await ensureSchema();
  const rows = await db.select().from(deals).where(eq(deals.id, Number(id)));
  const row = rows[0];
  if (!row) return null;
  const [lenders, s] = await Promise.all([getLenders(), getSettings()]);
  const d = normalizeDeal(row.data);
  const c = computeDeal(d, lenders, s.excessKmCharge, leaseConfig(s));
  const L = (k: string) => DICT[k]?.[lang === "fr" ? 0 : 1] ?? k;
  const T = (pair: [string, string]) => pair[lang === "fr" ? 0 : 1];
  const pn = (n: string) => (lang === "fr" ? n : translate("en", n));
  const loc = lang === "fr" ? "fr-CA" : "en-CA";
  const prov = c.prov;
  const gstR = (prov.hst ? 0 : prov.gst) / 100;
  const pstR = (prov.hst ? prov.hst : prov.pst) / 100;
  const gstLbl = lang === "fr" ? (prov.hst ? "TVH" : "TPS") : prov.hst ? "HST" : "GST";
  const pstLbl = lang === "fr" ? (prov.pstLabel === "QST" ? "TVQ" : prov.pstLabel) : prov.pstLabel;
  const today = new Date();
  const startDate = d.vehicle.delivery ? new Date(d.vehicle.delivery + "T12:00:00") : today;
  const fmtDate = (x: Date) => x.toLocaleDateString(loc, { year: "numeric", month: "long", day: "numeric" });
  const buyer = customerLabel(d) || "________________________";
  const custAddr = [d.customer.address, d.customer.city, d.customer.province, d.customer.postal].filter(Boolean).join(", ");
  const cond = d.vehicle.condition === "NEUF" ? L("new") : d.vehicle.condition === "DÉMO" ? L("demo") : L("used");
  const o1 = c.options[0];
  const yrs = (n?: number) => (n ? `${n} ${n > 1 ? L("years") : L("year1")}` : "—");

  const prefix: Record<string, string> = { "bill-of-sale": "BS", warranty: "WR", "tire-rim": "TR", "fi-products": "FI", accessories: "AC" };
  const contractNo = `${prefix[doc]}-${row.dealNumber}`;
  const title =
    doc === "bill-of-sale" ? L("billTitle") : doc === "warranty" ? L("warrantyTitle") : doc === "tire-rim" ? L("tireTitle") : doc === "fi-products" ? L("fiTitle") : L("accTitle");

  /* ---------------- shared blocks ---------------- */
  const Box = ({ title, children }: { title: string; children: ReactNode }) => (
    <div style={{ border: "1.5px solid #00263d", marginTop: 8 }}>
      <div style={{ background: "#00263d", color: "#fff", fontWeight: 700, fontSize: 10.5, padding: "2px 6px", letterSpacing: 0.5 }}>{title}</div>
      <div style={{ padding: "4px 6px" }}>{children}</div>
    </div>
  );
  const KV = ({ rows }: { rows: [string, ReactNode][] }) => (
    <table style={{ width: "100%", fontSize: 10.5 }}>
      <tbody>
        {rows.map(([k, v]) => (
          <tr key={k}>
            <td style={{ color: "#3c5266", padding: "1px 6px 1px 0", whiteSpace: "nowrap", width: "38%" }}>{k}</td>
            <td style={{ fontWeight: 600, padding: "1px 0" }}>{v || "—"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
  const Line = ({ label, value, bold, neg, big }: { label: string; value: number; bold?: boolean; neg?: boolean; big?: boolean }) =>
    !value && !bold ? null : (
      <tr style={{ fontWeight: bold ? 700 : 400, fontSize: big ? 12.5 : 10.5, background: big ? "#e6f1fa" : undefined }}>
        <td style={{ padding: "2px 6px", borderBottom: "1px solid #d5e0e9" }}>{label}</td>
        <td style={{ padding: "2px 6px", borderBottom: "1px solid #d5e0e9", textAlign: "right", whiteSpace: "nowrap" }}>{money(neg ? -Math.abs(value) : value, true)}</td>
      </tr>
    );
  const Header = (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "3px solid #0071bc", paddingBottom: 6 }}>
      <div>
        <div style={{ fontSize: 18, fontWeight: 800, color: "#00263d" }}>{s.dealerName}</div>
        <div style={{ fontSize: 10 }}>{s.legalName}</div>
        <div style={{ fontSize: 10 }}>{s.address}</div>
        <div style={{ fontSize: 10 }}>
          {L("phone")} : {s.tel}
          {s.email ? ` · ${s.email}` : ""}
        </div>
        <div style={{ fontSize: 9, color: "#3c5266" }}>
          {L("dealerNo")} {s.dealerNumber} · {L("gst")} {s.gstNumber}
          {s.qstNumber ? ` · ${L("qst")} ${s.qstNumber}` : ""}
        </div>
      </div>
      <div style={{ textAlign: "right" }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: "#0071bc", maxWidth: 300 }}>{title}</div>
        <table style={{ fontSize: 10, marginLeft: "auto", marginTop: 4 }}>
          <tbody>
            <tr><td style={{ paddingRight: 6, color: "#3c5266" }}>{L("contractNo")}</td><td style={{ fontWeight: 700 }}>{contractNo}</td></tr>
            <tr><td style={{ paddingRight: 6, color: "#3c5266" }}>{L("dealNo")}</td><td style={{ fontWeight: 700 }}>{row.dealNumber}</td></tr>
            <tr><td style={{ paddingRight: 6, color: "#3c5266" }}>{L("date")}</td><td style={{ fontWeight: 700 }}>{fmtDate(today)}</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  );
  const Parties = (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
      <Box title={L("buyer")}>
        <KV
          rows={[
            [L("name"), buyer],
            [L("address"), custAddr],
            [L("phone"), d.customer.mobile || d.customer.homePhone],
            [L("email"), d.customer.email],
            ...(d.customer.coBuyer ? ([[L("coBuyer"), d.customer.coBuyer]] as [string, ReactNode][]) : []),
          ]}
        />
      </Box>
      <Box title={L("vehicle")}>
        <KV
          rows={[
            [`${L("year")} / ${L("make")} / ${L("model")}`, vehicleLabel(d)],
            [L("vin"), <span key="v" style={{ fontFamily: "monospace", letterSpacing: 1 }}>{d.vehicle.vin}</span>],
            [L("stock"), d.vehicle.stock],
            [L("kms"), d.vehicle.kms ? `${Number(d.vehicle.kms).toLocaleString(loc)} km` : ""],
            [`${L("colour")} / ${L("condition")}`, [d.vehicle.extColor, cond].filter(Boolean).join(" · ")],
          ]}
        />
      </Box>
    </div>
  );
  const Terms = ({ list }: { list: [string, string][] }) => (
    <Box title={L("conditions")}>
      <ol style={{ fontSize: 8.8, lineHeight: 1.3, paddingLeft: 14, margin: 0 }}>
        {list.map((x, i) => (
          <li key={i} style={{ marginBottom: 2 }}>{T(x)}</li>
        ))}
      </ol>
    </Box>
  );
  const Signatures = ({ fi }: { fi?: boolean }) => (
    <div style={{ marginTop: 18 }}>
      <div style={{ fontSize: 9, marginBottom: 14 }}>{L("ack")}</div>
      <div style={{ display: "grid", gridTemplateColumns: d.customer.coBuyer ? "1fr 1fr 1fr" : "1fr 1fr", gap: 24 }}>
        <div><div style={{ borderTop: "1px solid #000", paddingTop: 2, fontSize: 9.5 }}>{L("sigBuyer")} — {buyer}</div></div>
        {d.customer.coBuyer && <div><div style={{ borderTop: "1px solid #000", paddingTop: 2, fontSize: 9.5 }}>{L("sigCoBuyer")}</div></div>}
        <div>
          <div style={{ borderTop: "1px solid #000", paddingTop: 2, fontSize: 9.5 }}>{L("sigDealer")}</div>
          <div style={{ fontSize: 9, color: "#3c5266" }}>
            {fi && d.fiManager ? `${L("fiManager")} : ${d.fiManager}` : d.salesperson ? `${L("salesperson")} : ${d.salesperson}` : ""}
          </div>
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 8, color: "#7a8ea0", marginTop: 14 }}>
        <span>{L("page")}</span>
        <span>{L("copy")}</span>
      </div>
    </div>
  );
  const Empty = (
    <div style={{ border: "2px dashed #9fb3c4", padding: 24, marginTop: 14, textAlign: "center", color: "#3c5266" }}>
      <div style={{ fontSize: 13, fontWeight: 700 }}>{L("none")}</div>
      <div style={{ fontSize: 10.5, marginTop: 4 }}>{L("noneHint")}</div>
    </div>
  );

  /* ---------------- product contract (warranty / tire-rim) ---------------- */
  const planSection = (p: DealProduct) => (p.code ? s.protectionPlans.find((x) => x.code === p.code)?.section : undefined);
  const productsFor = (kind: "warranty" | "tireRim") =>
    d.products.filter((p) => p.price > 0 && (p.id === kind || planSection(p) === kind));

  const ProductContract = ({ list, terms }: { list: DealProduct[]; terms: [string, string][] }) => (
    <>
      {list.map((p, i) => {
        const end = new Date(startDate);
        if (p.term) end.setFullYear(end.getFullYear() + p.term);
        const gst = Math.round(p.price * gstR * 100) / 100;
        const pst = Math.round(p.price * pstR * 100) / 100;
        return (
          <div key={i}>
            <Box title={`${L("product")}${list.length > 1 ? ` ${i + 1}` : ""}`}>
              <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 10 }}>
                <KV
                  rows={[
                    [L("plan"), <span key="n" style={{ fontSize: 12 }}>{pn(p.name)}</span>],
                    [L("code"), p.code ?? "—"],
                    [L("coverage"), yrs(p.term)],
                    [L("start"), fmtDate(startDate)],
                    [L("end"), p.term ? fmtDate(end) : "—"],
                    [L("startKm"), d.vehicle.kms ? `${Number(d.vehicle.kms).toLocaleString(loc)} km` : "—"],
                    [L("deductible"), `${money(0)} ${L("perClaim")}`],
                  ]}
                />
                <table style={{ width: "100%", borderCollapse: "collapse", alignSelf: "start" }}>
                  <tbody>
                    <Line label={L("retail")} value={p.price} bold />
                    {prov.hst ? <Line label={`${gstLbl} ${prov.hst}%`} value={pst} /> : <><Line label={`${gstLbl} ${prov.gst}%`} value={gst} /><Line label={`${pstLbl} ${prov.pst}%`} value={pst} /></>}
                    <Line label={L("total")} value={p.price + gst + pst} bold big />
                  </tbody>
                </table>
              </div>
            </Box>
          </div>
        );
      })}
      <Terms list={terms} />
      <Signatures fi />
    </>
  );

  /* ---------------- render by type ---------------- */
  let body: ReactNode = null;
  let empty = false;
  if (doc === "bill-of-sale") {
    const p = d.pricing;
    body = (
      <>
        <Box title={L("seller")}>
          <KV rows={[[L("name"), `${s.dealerName} ${s.legalName ? `(${s.legalName})` : ""}`], [L("address"), s.address], [L("salesperson"), d.salesperson]]} />
        </Box>
        {Parties}
        <div style={{ display: "grid", gridTemplateColumns: "1.25fr 1fr", gap: 8 }}>
          <Box title={L("price")}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <tbody>
                <Line label={L("vehiclePrice")} value={p.basePrice + p.options} bold />
                <Line label={L("freight")} value={p.freight} />
                <Line label={L("dealerFees")} value={p.adminFees} />
                <Line label={L("accessories")} value={p.accessories} />
                <Line label={L("discount")} value={p.reduction} neg />
                <Line label={L("luxury")} value={c.luxuryTax} />
                <Line label={L("tireTax")} value={p.tireTax} />
                <Line label={L("fi")} value={c.fiSubtotal} />
                <Line label={L("subtotal")} value={c.achatTotal} bold />
                <Line label={L("rebate")} value={d.cash.rebatePreTax} neg />
                <Line label={L("tradeAllow")} value={c.tradeCredit} neg />
                <Line label={L("taxable")} value={c.taxable} bold />
                {prov.hst ? <Line label={`${gstLbl} ${prov.hst}%`} value={c.hst} /> : <><Line label={`${gstLbl} ${prov.gst}%`} value={c.gst} /><Line label={`${pstLbl} ${prov.pst}%`} value={c.pst} /></>}
                <Line label={L("totalTaxes")} value={c.cashTotal} bold />
                <Line label={L("lienPayout")} value={d.trade.lien} />
                <Line label={L("rmNonTax")} value={p.rmNonTax} neg />
                <Line label={L("rebateTaxIncl")} value={d.cash.rebateTaxIncl} neg />
                <Line label={L("deposit")} value={d.cash.deposit} neg />
                <Line label={L("cashDown")} value={c.cashPaid} neg />
                <Line label={L("deliveryFees")} value={d.cash.deliveryFees} />
                <Line label={L("balance")} value={c.soldeDu} bold big />
              </tbody>
            </table>
          </Box>
          <div>
            <Box title={d.dealType === "lease" ? L("leaseTerms") : d.dealType === "finance" ? L("finTerms") : L("cashTerms")}>
              {d.dealType === "cash" ? (
                <KV rows={[[L("balance"), money(c.soldeDu)]]} />
              ) : d.dealType === "finance" ? (
                <KV
                  rows={[
                    [L("lender"), o1.lender?.name ?? "—"],
                    [L("term"), `${d.options[0].term} ${L("months")}`],
                    [L("rate"), `${d.options[0].rate.toFixed(2)} %`],
                    [L("payment"), `${money(o1.payment)} — ${FREQ_LABEL[d.options[0].frequency]}`],
                    [L("nPayments"), String(o1.n)],
                    [L("financed"), money(o1.amountFinanced)],
                    [L("borrowing"), money(o1.costOfBorrowing)],
                    [L("obligation"), money(o1.totalObligation)],
                  ]}
                />
              ) : (
                <KV
                  rows={[
                    [L("lender"), o1.lender?.name ?? "—"],
                    [L("term"), `${d.options[0].term} ${L("months")}`],
                    [L("rate"), `${d.options[0].rate.toFixed(2)} %`],
                    [L("payment"), `${money(o1.totalPayment)} ${L("taxesIncl")} — ${FREQ_LABEL[d.options[0].frequency]}`],
                    [L("capCost"), money(o1.capCost)],
                    [L("residual"), `${money(o1.residual)} (${o1.residualPct}%)`],
                    [L("kmYear"), `${d.options[0].kmPerYear.toLocaleString(loc)} km`],
                    [L("excessKm"), `${(s.excessKmCharge ?? 0).toFixed(2)} $/km`],
                  ]}
                />
              )}
            </Box>
            {(d.trade.description || d.trade.value > 0) && (
              <Box title={L("tradeAllow")}>
                <KV
                  rows={[
                    [L("vehicle"), d.trade.description],
                    [L("vin"), d.trade.vin],
                    [L("kms"), d.trade.kms],
                    [L("tradeAllow"), money(c.tradeCredit)],
                    [L("lienPayout"), money(d.trade.lien)],
                  ]}
                />
              </Box>
            )}
          </div>
        </div>
        <Terms list={BILL_TERMS} />
        <Signatures />
      </>
    );
  } else if (doc === "fi-products") {
    const list = d.products.filter((p) => {
      const sec = planSection(p);
      return p.price > 0 && p.id !== "warranty" && p.id !== "tireRim" && sec !== "warranty" && sec !== "tireRim";
    });
    empty = !list.length;
    body = (
      <>
        {Parties}
        {list.length ? <ProductContract list={list} terms={FI_TERMS} /> : Empty}
      </>
    );
  } else if (doc === "warranty" || doc === "tire-rim") {
    const list = productsFor(doc === "warranty" ? "warranty" : "tireRim");
    empty = !list.length;
    body = (
      <>
        {Parties}
        {list.length ? <ProductContract list={list} terms={doc === "warranty" ? WARRANTY_TERMS : TIRE_TERMS} /> : Empty}
      </>
    );
  } else {
    // accessories invoice: accessory items + accessory/cosmetic/anti-theft plans
    const items: { name: string; price: number }[] = d.accessoryItems.filter((a) => a.price > 0 || a.name);
    if (!items.length && d.pricing.accessories > 0) items.push({ name: L("accessories"), price: d.pricing.accessories });
    empty = !items.length;
    const sub = items.reduce((a, x) => a + x.price, 0);
    const gst = Math.round(sub * gstR * 100) / 100;
    const pst = Math.round(sub * pstR * 100) / 100;
    body = (
      <>
        {Parties}
        {items.length ? (
          <>
            <Box title={L("accessories")}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10.5 }}>
                <thead>
                  <tr style={{ background: "#e6f1fa" }}>
                    <th style={{ textAlign: "left", padding: "3px 6px" }}>{L("description")}</th>
                    <th style={{ textAlign: "center", padding: "3px 6px", width: 50 }}>{L("qty")}</th>
                    <th style={{ textAlign: "right", padding: "3px 6px", width: 100 }}>{L("unit")}</th>
                    <th style={{ textAlign: "right", padding: "3px 6px", width: 100 }}>{L("amount")}</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((x, i) => (
                    <tr key={i}>
                      <td style={{ padding: "3px 6px", borderBottom: "1px solid #d5e0e9" }}>{x.name}</td>
                      <td style={{ padding: "3px 6px", borderBottom: "1px solid #d5e0e9", textAlign: "center" }}>1</td>
                      <td style={{ padding: "3px 6px", borderBottom: "1px solid #d5e0e9", textAlign: "right" }}>{money(x.price)}</td>
                      <td style={{ padding: "3px 6px", borderBottom: "1px solid #d5e0e9", textAlign: "right" }}>{money(x.price)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <table style={{ width: 280, marginLeft: "auto", marginTop: 6, borderCollapse: "collapse" }}>
                <tbody>
                  <Line label={L("subtotal")} value={sub} bold />
                  {prov.hst ? <Line label={`${gstLbl} ${prov.hst}%`} value={pst} /> : <><Line label={`${gstLbl} ${prov.gst}%`} value={gst} /><Line label={`${pstLbl} ${prov.pst}%`} value={pst} /></>}
                  <Line label={L("total")} value={sub + gst + pst} bold big />
                </tbody>
              </table>
              <div style={{ fontSize: 9.5, marginTop: 4, color: "#3c5266" }}>{L("installedBy")}</div>
            </Box>
            <Terms list={ACC_TERMS} />
            <Signatures />
          </>
        ) : (
          Empty
        )}
      </>
    );
  }

  if (skipEmpty && empty) return null;
  return (
    <div className="sheet shadow-2xl mt-6" style={{ fontSize: 10.5 }}>
      {Header}
      {body}
    </div>
  );
}
