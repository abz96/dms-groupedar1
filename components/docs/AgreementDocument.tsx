import { eq } from "drizzle-orm";
import type { ReactNode } from "react";
import { db } from "@/db";
import { deals } from "@/db/schema";
import { computeDeal, customerLabel, FREQ_LABEL, leaseConfig, money, normalizeDeal, PERIODS, productGroups, vehicleLabel } from "@/lib/deal";
import { translate } from "@/lib/i18n-server";
import { getLenders, getSettings } from "@/lib/server";

type Lang = "fr" | "en";
type Pair = [string, string];

const LEASE_TERMS: Pair[] = [
  ["Propriété. Le locateur demeure propriétaire du véhicule pendant toute la durée de la location. Le locataire n'acquiert aucun droit de propriété, sauf s'il exerce l'option d'achat.", "Ownership. The lessor remains the owner of the vehicle throughout the lease. The lessee acquires no ownership rights unless the purchase option is exercised."],
  ["Paiements. Le locataire s'engage à verser chaque paiement à la date prévue, par prélèvement préautorisé. Le premier paiement est exigible à la livraison.", "Payments. The lessee agrees to make each payment on its due date by pre-authorized debit. The first payment is due at delivery."],
  ["Utilisation. Le véhicule doit être utilisé de façon prudente, conformément aux lois, et ne peut être sous-loué, exporté hors du Canada ou utilisé à des fins commerciales sans consentement écrit.", "Use. The vehicle must be used prudently and lawfully and may not be sublet, exported outside Canada or used commercially without written consent."],
  ["Entretien. Le locataire doit faire effectuer l'entretien recommandé par le fabricant et conserver les preuves d'entretien. Il assume les frais de réparation non couverts par une garantie.", "Maintenance. The lessee must have the manufacturer-recommended maintenance performed and keep proof of service. The lessee bears repair costs not covered by a warranty."],
  ["Assurance. Le locataire doit maintenir une assurance responsabilité civile d'au moins 1 000 000 $ et une assurance des dommages (collision et risques multiples) désignant le locateur comme bénéficiaire.", "Insurance. The lessee must maintain liability insurance of at least $1,000,000 and physical damage insurance (collision and comprehensive) naming the lessor as loss payee."],
  ["Kilométrage. Le kilométrage annuel autorisé est indiqué à la section 3. Tout kilométrage excédentaire à la fin de la location sera facturé au taux indiqué, taxes en sus.", "Mileage. The annual allowance is shown in section 3. Any excess mileage at lease end will be charged at the stated rate, plus taxes."],
  ["Usure excessive. À la fin de la location, le locataire est responsable des dommages dépassant l'usure normale (bosses, rayures profondes, pneus usés sous 4/32 po, vitres fissurées, intérieur taché ou brûlé).", "Excess wear. At lease end, the lessee is responsible for damage beyond normal wear (dents, deep scratches, tires below 4/32 in., cracked glass, stained or burnt interior)."],
  ["Résiliation anticipée. Le locataire peut mettre fin à la location en tout temps en payant les paiements échus, l'indemnité de résiliation prévue par la Loi sur la protection du consommateur et les frais applicables.", "Early termination. The lessee may terminate the lease at any time by paying overdue payments, the termination indemnity provided by the Consumer Protection Act and applicable fees."],
  ["Option d'achat. À la fin du terme, le locataire peut acheter le véhicule au prix de l'option d'achat indiqué, plus les taxes et frais d'immatriculation.", "Purchase option. At the end of the term, the lessee may purchase the vehicle at the stated purchase-option price, plus taxes and registration fees."],
  ["Défaut. En cas de défaut de paiement, le locateur doit transmettre un avis écrit de 30 jours avant d'exercer son droit de reprise, conformément à la loi.", "Default. In the event of payment default, the lessor must send 30 days' written notice before exercising its right of repossession, as required by law."],
  ["Publicité des droits. Les droits du locateur sont publiés au Registre des droits personnels et réels mobiliers (RDPRM). Les frais de publication sont à la charge du locataire.", "Registration. The lessor's rights are registered at the Register of Personal and Movable Real Rights (RDPRM/PPSA). Registration fees are payable by the lessee."],
  ["Cession. Le locateur peut céder le présent contrat à une institution financière sans le consentement du locataire, qui en sera avisé par écrit.", "Assignment. The lessor may assign this contract to a financial institution without the lessee's consent; the lessee will be notified in writing."],
];

const FINANCE_TERMS: Pair[] = [
  ["Réserve de propriété. Le vendeur demeure propriétaire du véhicule jusqu'au paiement complet du prix. La propriété est transférée à l'acheteur au dernier paiement.", "Retention of title. The seller remains the owner of the vehicle until the price is paid in full. Ownership transfers to the buyer upon the final payment."],
  ["Paiements. L'acheteur s'engage à verser chaque paiement à la date prévue, par prélèvement préautorisé, au cessionnaire désigné.", "Payments. The buyer agrees to make each payment on its due date by pre-authorized debit to the designated assignee."],
  ["Paiement anticipé. L'acheteur peut payer en tout temps le solde, en tout ou en partie, sans pénalité. Le coût d'emprunt est alors réduit en proportion.", "Prepayment. The buyer may pay the balance at any time, in whole or in part, without penalty. The cost of borrowing is reduced proportionally."],
  ["Taux et coût d'emprunt. Le taux de crédit annuel et le coût d'emprunt indiqués à la section 3 sont fixes pour toute la durée du contrat.", "Rate and cost of borrowing. The annual credit rate and cost of borrowing shown in section 3 are fixed for the entire term."],
  ["Assurance. L'acheteur doit maintenir une assurance responsabilité civile et une assurance des dommages désignant le cessionnaire comme bénéficiaire jusqu'au paiement complet.", "Insurance. The buyer must maintain liability and physical damage insurance naming the assignee as loss payee until paid in full."],
  ["Utilisation et entretien. L'acheteur doit entretenir le véhicule, ne pas le vendre ni l'exporter hors du Canada sans le consentement écrit du cessionnaire avant le paiement complet.", "Use and maintenance. The buyer must maintain the vehicle and may not sell it or export it outside Canada without the assignee's written consent before full payment."],
  ["Frais de retard. Un paiement en retard porte intérêt au taux du contrat. Des frais raisonnables peuvent s'appliquer pour un paiement refusé par l'institution financière.", "Late charges. A late payment bears interest at the contract rate. Reasonable fees may apply for a payment refused by the financial institution."],
  ["Défaut et reprise. En cas de défaut, le cessionnaire doit transmettre un avis écrit de 30 jours. Si l'acheteur a payé au moins la moitié de l'obligation totale, la reprise exige l'autorisation du tribunal.", "Default and repossession. In the event of default, the assignee must send 30 days' written notice. If the buyer has paid at least half of the total obligation, repossession requires court authorization."],
  ["Publicité des droits. La réserve de propriété est publiée au RDPRM. Les frais de publication sont à la charge de l'acheteur.", "Registration. The retention of title is registered at the RDPRM/PPSA. Registration fees are payable by the buyer."],
  ["Cession. Le vendeur peut céder le présent contrat au prêteur indiqué; l'acheteur effectuera alors tous les paiements au cessionnaire.", "Assignment. The seller may assign this contract to the named lender; the buyer will then make all payments to the assignee."],
  ["Garanties légales. Le présent contrat n'affecte en rien les garanties légales de qualité et de sécurité prévues par la Loi sur la protection du consommateur.", "Legal warranties. This contract does not affect the legal warranties of quality and safety provided by the Consumer Protection Act."],
  ["Loi applicable. Le présent contrat est régi par les lois du Québec, notamment la Loi sur la protection du consommateur et le Code civil du Québec.", "Governing law. This contract is governed by the laws of Québec, including the Consumer Protection Act and the Civil Code of Québec."],
];

const ACKS: Pair[] = [
  ["J'ai lu et compris toutes les pages du présent contrat et j'en ai reçu une copie complète.", "I have read and understood every page of this contract and received a complete copy."],
  ["Les produits facultatifs (garantie, protections, assurances) m'ont été présentés comme optionnels et ne sont pas une condition du financement.", "Optional products (warranty, protections, insurance) were presented to me as optional and are not a condition of financing."],
  ["J'ai examiné le véhicule et je l'accepte dans l'état décrit; la lecture de l'odomètre est exacte à ma connaissance.", "I have inspected the vehicle and accept it in the described condition; the odometer reading is accurate to my knowledge."],
  ["Les renseignements fournis dans ma demande de crédit sont exacts et complets.", "The information provided in my credit application is accurate and complete."],
  ["J'autorise le prélèvement préautorisé des paiements dans le compte bancaire désigné.", "I authorize pre-authorized debit of the payments from the designated bank account."],
  ["Je m'engage à fournir une preuve d'assurance avant la prise de possession du véhicule.", "I agree to provide proof of insurance before taking possession of the vehicle."],
];

export default async function AgreementDocument({ id, kind, lang }: { id: number; kind: "lease" | "finance"; lang: Lang }) {
  const row = (await db.select().from(deals).where(eq(deals.id, id)))[0];
  if (!row) return null;
  const [lenders, s] = await Promise.all([getLenders(), getSettings()]);
  const d = normalizeDeal(row.data);
  d.dealType = kind; // render the requested agreement even if the deal is set to the other type
  const c = computeDeal(d, lenders, s.excessKmCharge, leaseConfig(s));
  const o = c.options[0];
  const opt = d.options[0];
  const T = (p: Pair) => p[lang === "fr" ? 0 : 1];
  const loc = lang === "fr" ? "fr-CA" : "en-CA";
  const fmtDate = (x: Date) => x.toLocaleDateString(loc, { year: "numeric", month: "long", day: "numeric" });
  const today = new Date();
  const start = d.vehicle.delivery ? new Date(d.vehicle.delivery + "T12:00:00") : today;
  const periods = PERIODS[opt.frequency] ?? 12;
  const addPeriods = (base: Date, n: number) => {
    const x = new Date(base);
    if (periods === 12) x.setMonth(x.getMonth() + n);
    else x.setDate(x.getDate() + n * (periods === 26 ? 14 : 7));
    return x;
  };
  const firstDate = kind === "lease" ? start : addPeriods(start, 1);
  const lastDate = addPeriods(firstDate, Math.max(0, o.n - 1));
  const buyer = customerLabel(d) || "________________________";
  const addr = [d.customer.address, d.customer.city, d.customer.province, d.customer.postal].filter(Boolean).join(", ");
  const lender = o.lender?.name ?? "________________";
  const prov = c.prov;
  const pn = (n: string) => (lang === "fr" ? n : translate("en", n));
  const contractNo = `${kind === "lease" ? "LA" : "FA"}-${row.dealNumber}`;
  const title =
    kind === "lease"
      ? T(["CONTRAT DE LOCATION À LONG TERME D'UN VÉHICULE ROUTIER", "LONG-TERM MOTOR VEHICLE LEASE AGREEMENT"])
      : T(["CONTRAT DE VENTE À TEMPÉRAMENT — FINANCEMENT", "CONDITIONAL SALES CONTRACT — FINANCING AGREEMENT"]);
  const pod = { warranty: false, tireRim: false, accessories: false, fi: false, ...(d.payOnDelivery ?? {}) };
  const groups = productGroups(d);
  const residualPurchase = o.residual;

  /* ---------- building blocks ---------- */
  const Sec = ({ n, title, children }: { n: number; title: string; children: ReactNode }) => (
    <div style={{ border: "1.5px solid #00263d", marginTop: 7 }}>
      <div style={{ background: "#00263d", color: "#fff", fontWeight: 700, fontSize: 10, padding: "2px 6px", letterSpacing: 0.4 }}>
        {n}. {title}
      </div>
      <div style={{ padding: "4px 6px" }}>{children}</div>
    </div>
  );
  const Grid = ({ rows, cols = 2 }: { rows: [string, ReactNode][]; cols?: number }) => (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, 1fr)`, columnGap: 12, rowGap: 2, fontSize: 9.8 }}>
      {rows.map(([k, v]) => (
        <div key={k} style={{ display: "flex", gap: 6, borderBottom: "1px dotted #b9c7d3", padding: "1px 0" }}>
          <span style={{ color: "#3c5266", whiteSpace: "nowrap" }}>{k}</span>
          <span style={{ fontWeight: 700, marginLeft: "auto", textAlign: "right" }}>{v || "—"}</span>
        </div>
      ))}
    </div>
  );
  const Line = ({ l, v, b, neg }: { l: string; v: number; b?: boolean; neg?: boolean }) => (
    <tr style={{ fontWeight: b ? 700 : 400, background: b ? "#e6f1fa" : undefined }}>
      <td style={{ padding: "1.5px 6px", borderBottom: "1px solid #d5e0e9" }}>{l}</td>
      <td style={{ padding: "1.5px 6px", borderBottom: "1px solid #d5e0e9", textAlign: "right", whiteSpace: "nowrap" }}>{money(neg ? -Math.abs(v) : v, true)}</td>
    </tr>
  );
  const Box = ({ label, value, sub }: { label: string; value: string; sub?: string }) => (
    <div style={{ border: "2px solid #00263d", padding: "4px 6px", textAlign: "center" }}>
      <div style={{ fontSize: 8.5, fontWeight: 700, textTransform: "uppercase", color: "#00263d", lineHeight: 1.1 }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 800, marginTop: 2 }}>{value}</div>
      {sub && <div style={{ fontSize: 7.8, color: "#3c5266", lineHeight: 1.1 }}>{sub}</div>}
    </div>
  );
  const Initials = () => <span style={{ display: "inline-block", width: 46, height: 16, border: "1px solid #000", marginLeft: 6, verticalAlign: "middle" }} />;
  const Sig = ({ label, sub }: { label: string; sub?: string }) => (
    <div>
      <div style={{ height: 22 }} />
      <div style={{ borderTop: "1px solid #000", fontSize: 9, paddingTop: 1 }}>
        <b>{label}</b>
        {sub ? ` — ${sub}` : ""}
      </div>
      <div style={{ fontSize: 8, color: "#3c5266" }}>{T(["Date", "Date"])} : ____ / ____ / ________</div>
    </div>
  );
  const Header = ({ page }: { page: number }) => (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "3px solid #0071bc", paddingBottom: 5 }}>
      <div>
        <div style={{ fontSize: 16, fontWeight: 800, color: "#00263d" }}>{s.dealerName}</div>
        <div style={{ fontSize: 9 }}>{s.legalName} · {s.address}</div>
        <div style={{ fontSize: 8.5, color: "#3c5266" }}>
          {T(["Tél.", "Tel."])} {s.tel} · {T(["N° commerçant", "Dealer #"])} {s.dealerNumber} · {T(["TPS", "GST"])} {s.gstNumber}
          {s.qstNumber ? ` · ${T(["TVQ", "QST"])} ${s.qstNumber}` : ""}
        </div>
      </div>
      <div style={{ textAlign: "right" }}>
        <div style={{ fontSize: 12.5, fontWeight: 800, color: "#0071bc", maxWidth: 330, lineHeight: 1.15 }}>{title}</div>
        <div style={{ fontSize: 9, marginTop: 3 }}>
          {T(["N° de contrat", "Contract #"])} <b>{contractNo}</b> · {T(["Dossier", "Deal"])} <b>{row.dealNumber}</b>
        </div>
        <div style={{ fontSize: 9 }}>
          {fmtDate(today)} · {T(["Page", "Page"])} {page} / 3
        </div>
      </div>
    </div>
  );
  const Footer = () => (
    <div style={{ marginTop: "auto", paddingTop: 6, display: "flex", justifyContent: "space-between", fontSize: 8, color: "#3c5266" }}>
      <span>
        {T(["Initiales de l'acheteur / locataire", "Buyer / lessee initials"])} <Initials />
        <span style={{ marginLeft: 14 }}>{T(["Co-acheteur", "Co-buyer"])}</span> <Initials />
      </span>
      <span>{contractNo} · Groupe Dar DMS</span>
    </div>
  );
  const sheet = { minHeight: "11in", display: "flex", flexDirection: "column" as const, fontSize: 10 };

  /* ---------- amounts ---------- */
  const p = d.pricing;
  const productLines = d.products.filter((x) => x.price > 0);
  const disclosure =
    kind === "lease" ? (
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 5 }}>
        <Box label={T(["Coût capitalisé", "Capitalized cost"])} value={money(o.capCost)} />
        <Box label={T(["Valeur résiduelle", "Residual value"])} value={money(o.residual)} sub={`${o.residualPct}% ${T(["du PDSF", "of MSRP"])}`} />
        <Box label={T(["Taux de location annuel", "Annual lease rate"])} value={`${opt.rate.toFixed(2)} %`} />
        <Box label={T(["Terme", "Term"])} value={`${opt.term} ${T(["mois", "months"])}`} sub={`${o.n} ${T(["paiements", "payments"])} — ${FREQ_LABEL[opt.frequency]}`} />
        <Box label={T(["Paiement (taxes incl.)", "Payment (tax incl.)"])} value={money(o.totalPayment)} sub={`${money(o.payment)} + ${T(["taxes", "taxes"])} ${money(o.taxOnPayment)}`} />
        <Box label={T(["Total des paiements", "Total of payments"])} value={money(o.totalLeaseCost)} />
        <Box label={T(["Frais de financement implicites", "Implicit finance charge"])} value={money(o.costOfBorrowing)} />
        <Box label={T(["Option d'achat (fin du terme)", "Purchase option (end of term)"])} value={money(residualPurchase)} sub={T(["taxes en sus", "plus taxes"])} />
      </div>
    ) : (
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 5 }}>
        <Box label={T(["Taux de crédit annuel", "Annual percentage rate"])} value={`${opt.rate.toFixed(2)} %`} />
        <Box label={T(["Montant financé", "Amount financed"])} value={money(o.amountFinanced)} />
        <Box label={T(["Coût d'emprunt", "Cost of borrowing"])} value={money(o.costOfBorrowing)} sub={T(["intérêts sur la durée", "interest over the term"])} />
        <Box label={T(["Obligation totale", "Total obligation"])} value={money(o.totalObligation)} sub={T(["total des paiements", "total of payments"])} />
        <Box label={T(["Paiement", "Payment"])} value={money(o.payment)} sub={FREQ_LABEL[opt.frequency]} />
        <Box label={T(["Nombre de paiements", "Number of payments"])} value={String(o.n)} sub={`${opt.term} ${T(["mois", "months"])}`} />
        <Box label={T(["Prix de vente total", "Total sale price"])} value={money(o.totalObligation + o.dueOnDelivery + c.tradeNet)} sub={T(["comptant + échange + obligation", "cash + trade + obligation"])} />
        <Box label={T(["Dû à la livraison", "Due on delivery"])} value={money(o.dueOnDelivery)} />
      </div>
    );

  return (
    <>
      {/* ============================== PAGE 1 ============================== */}
      <div className="sheet shadow-2xl mt-6" style={sheet}>
        <Header page={1} />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7 }}>
          <Sec n={1} title={T(["PARTIES", "PARTIES"])}>
            <Grid
              cols={1}
              rows={[
                [kind === "lease" ? T(["Locateur", "Lessor"]) : T(["Vendeur", "Seller"]), s.dealerName],
                [kind === "lease" ? T(["Locataire", "Lessee"]) : T(["Acheteur", "Buyer"]), buyer],
                [T(["Adresse", "Address"]), addr],
                [T(["Téléphone / courriel", "Phone / email"]), [d.customer.mobile || d.customer.homePhone, d.customer.email].filter(Boolean).join(" · ")],
                [T(["Co-signataire", "Co-signer"]), d.customer.coBuyer],
                [T(["Cessionnaire (prêteur)", "Assignee (lender)"]), lender],
              ]}
            />
          </Sec>
          <Sec n={2} title={T(["DESCRIPTION DU VÉHICULE", "VEHICLE DESCRIPTION"])}>
            <Grid
              cols={1}
              rows={[
                [T(["Année / marque / modèle", "Year / make / model"]), vehicleLabel(d)],
                [T(["NIV", "VIN"]), <span key="v" style={{ fontFamily: "monospace", letterSpacing: 0.8 }}>{d.vehicle.vin}</span>],
                [T(["N° de stock / couleur", "Stock # / colour"]), [d.vehicle.stock, d.vehicle.extColor].filter(Boolean).join(" · ")],
                [T(["Kilométrage à la livraison", "Odometer at delivery"]), d.vehicle.kms ? `${Number(d.vehicle.kms).toLocaleString(loc)} km` : ""],
                [T(["État", "Condition"]), d.vehicle.condition === "NEUF" ? T(["Neuf", "New"]) : d.vehicle.condition === "DÉMO" ? T(["Démonstrateur", "Demo"]) : T(["Usagé", "Used"])],
                [T(["Date de livraison prévue", "Scheduled delivery"]), fmtDate(start)],
              ]}
            />
          </Sec>
        </div>

        <Sec n={3} title={kind === "lease" ? T(["DIVULGATION — MODALITÉS DE LA LOCATION", "DISCLOSURE — LEASE TERMS"]) : T(["DIVULGATION — MODALITÉS DU CRÉDIT", "DISCLOSURE — CREDIT TERMS"])}>
          {disclosure}
          {kind === "lease" && (
            <div style={{ marginTop: 5 }}>
              <Grid
                cols={3}
                rows={[
                  [T(["Kilométrage annuel autorisé", "Annual km allowance"]), `${opt.kmPerYear.toLocaleString(loc)} km`],
                  [T(["Kilométrage total autorisé", "Total km allowed"]), `${o.totalKms.toLocaleString(loc)} km`],
                  [T(["Km excédentaire", "Excess km charge"]), `${(s.excessKmCharge ?? 0).toFixed(2)} $ / km`],
                  [T(["Dépôt de sécurité", "Security deposit"]), money(o.deliverySecurityDeposit)],
                  [T(["Premier paiement", "First payment"]), fmtDate(firstDate)],
                  [T(["Dernier paiement", "Last payment"]), fmtDate(lastDate)],
                ]}
              />
            </div>
          )}
        </Sec>

        <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 7 }}>
          <Sec n={4} title={kind === "lease" ? T(["CALCUL DU COÛT CAPITALISÉ", "CAPITALIZED COST CALCULATION"]) : T(["CALCUL DU MONTANT FINANCÉ", "AMOUNT FINANCED CALCULATION"])}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 9.5 }}>
              <tbody>
                <Line l={T(["Prix du véhicule (PDSF + options)", "Vehicle price (MSRP + options)"])} v={p.basePrice + p.options} />
                {p.freight > 0 && <Line l={T(["Transport et préparation", "Freight & PDI"])} v={p.freight} />}
                {p.adminFees > 0 && <Line l={T(["Frais de concession", "Dealer fees"])} v={p.adminFees} />}
                {p.reduction > 0 && <Line l={T(["Rabais", "Discount"])} v={p.reduction} neg />}
                {p.accessories > 0 && <Line l={`${T(["Accessoires", "Accessories"])}${pod.accessories ? ` (${T(["payés à la livraison", "paid at delivery"])})` : ""}`} v={p.accessories} />}
                {productLines.map((x, i) => (
                  <Line
                    key={i}
                    l={`${pn(x.name)}${x.term ? ` — ${x.term} ${T(["an(s)", "yr(s)"])}` : ""}${
                      (x.id === "warranty" && pod.warranty) || (x.id === "tireRim" && pod.tireRim) || (x.id !== "warranty" && x.id !== "tireRim" && pod.fi) ? ` (${T(["payé à la livraison", "paid at delivery"])})` : ""
                    }`}
                    v={x.price}
                  />
                ))}
                {c.luxuryTax > 0 && <Line l={T(["Taxe sur les produits de luxe", "Luxury tax"])} v={c.luxuryTax} />}
                {c.tradeCredit > 0 && <Line l={T(["Valeur d'échange", "Trade-in allowance"])} v={c.tradeCredit} neg />}
                {d.trade.lien > 0 && <Line l={T(["Solde dû sur l'échange", "Trade lien payout"])} v={d.trade.lien} />}
                {d.cash.rebatePreTax + p.rmNonTax + d.cash.rebateTaxIncl > 0 && <Line l={T(["Remises du fabricant", "Manufacturer rebates"])} v={d.cash.rebatePreTax + p.rmNonTax + d.cash.rebateTaxIncl} neg />}
                {o.deliveryCashDown > 0 && <Line l={T(["Comptant", "Cash down"])} v={o.deliveryCashDown} neg />}
                {kind === "finance" && <Line l={T(["Taxes (TPS/TVQ)", "Taxes (GST/QST)"])} v={c.totalTaxes} />}
                <Line l={kind === "lease" ? T(["COÛT CAPITALISÉ NET", "NET CAPITALIZED COST"]) : T(["MONTANT FINANCÉ", "AMOUNT FINANCED"])} v={kind === "lease" ? o.capCost : o.amountFinanced} b />
              </tbody>
            </table>
          </Sec>
          <Sec n={5} title={T(["MONTANT DÛ À LA LIVRAISON", "AMOUNT DUE AT DELIVERY"])}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 9.5 }}>
              <tbody>
                {kind === "lease" && <Line l={T(["Dépôt de sécurité (remboursable)", "Security deposit (refundable)"])} v={o.deliverySecurityDeposit} />}
                <Line l={T(["Frais RDPRM / PPSA", "RDPRM / PPSA fees"])} v={o.deliveryRegistration} />
                <Line l={T(["Droit environnemental — pneus", "Tire environmental fee"])} v={o.deliveryTireTax} />
                {o.deliveryCashDown > 0 && <Line l={T(["Comptant (taxes incl.)", "Cash down (tax incl.)"])} v={o.deliveryCashDown} />}
                {o.deliveryProducts > 0 && <Line l={T(["Produits payés à la livraison (taxes incl.)", "Products paid at delivery (tax incl.)"])} v={o.deliveryProducts} />}
                {o.depositApplied > 0 && <Line l={T(["Moins acompte versé", "Less deposit paid"])} v={o.depositApplied} neg />}
                {o.deliveryFirstPayment > 0 && <Line l={T(["Premier paiement (premier mois)", "First payment (first month)"])} v={o.deliveryFirstPayment} />}
                <Line l={T(["TOTAL DÛ À LA LIVRAISON", "TOTAL DUE AT DELIVERY"])} v={o.dueOnDelivery} b />
              </tbody>
            </table>
            <div style={{ fontSize: 8.5, color: "#3c5266", marginTop: 3 }}>
              {T(["Taxes", "Taxes"])} : {prov.hst ? `${T(["TVH", "HST"])} ${prov.hst}%` : `${T(["TPS", "GST"])} ${prov.gst}% · ${prov.pstLabel === "QST" ? T(["TVQ", "QST"]) : prov.pstLabel} ${prov.pst}%`}
            </div>
          </Sec>
        </div>

        <Sec n={6} title={T(["CALENDRIER DES PAIEMENTS", "PAYMENT SCHEDULE"])}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 9.5, textAlign: "center" }}>
            <thead>
              <tr style={{ background: "#e6f1fa" }}>
                {[T(["Nombre", "Number"]), T(["Fréquence", "Frequency"]), T(["Montant", "Amount"]), T(["Premier", "First"]), T(["Dernier", "Last"]), T(["Mode", "Method"])].map((h) => (
                  <th key={h} style={{ padding: 2, border: "1px solid #b9c7d3" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ padding: 2, border: "1px solid #b9c7d3" }}>{o.n}</td>
                <td style={{ padding: 2, border: "1px solid #b9c7d3" }}>{FREQ_LABEL[opt.frequency]}</td>
                <td style={{ padding: 2, border: "1px solid #b9c7d3", fontWeight: 700 }}>{money(kind === "lease" ? o.totalPayment : o.payment)}</td>
                <td style={{ padding: 2, border: "1px solid #b9c7d3" }}>{fmtDate(firstDate)}</td>
                <td style={{ padding: 2, border: "1px solid #b9c7d3" }}>{fmtDate(lastDate)}</td>
                <td style={{ padding: 2, border: "1px solid #b9c7d3" }}>{T(["Prélèvement préautorisé", "Pre-authorized debit"])}</td>
              </tr>
            </tbody>
          </table>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, fontSize: 8.8, marginTop: 4 }}>
            {[T(["Institution", "Institution"]), T(["Transit", "Transit"]), T(["N° de compte", "Account #"]), T(["Titulaire", "Account holder"])].map((x) => (
              <div key={x} style={{ borderBottom: "1px solid #000", paddingTop: 10 }}>{x} :</div>
            ))}
          </div>
        </Sec>
        <Footer />
      </div>

      {/* ============================== PAGE 2 ============================== */}
      <div className="sheet shadow-2xl mt-6" style={sheet}>
        <Header page={2} />
        <Sec n={7} title={T(["PRODUITS FACULTATIFS ET ASSURANCES", "OPTIONAL PRODUCTS & INSURANCE"])}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 9.5 }}>
            <thead>
              <tr style={{ background: "#e6f1fa" }}>
                <th style={{ textAlign: "left", padding: 2 }}>{T(["Produit", "Product"])}</th>
                <th style={{ padding: 2 }}>{T(["Terme", "Term"])}</th>
                <th style={{ padding: 2 }}>{T(["Mode de paiement", "Payment method"])}</th>
                <th style={{ textAlign: "right", padding: 2 }}>{T(["Prix", "Price"])}</th>
                <th style={{ padding: 2 }}>{T(["Accepté", "Accepted"])}</th>
              </tr>
            </thead>
            <tbody>
              {productLines.length === 0 && groups.accessories === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: 4, textAlign: "center", color: "#3c5266" }}>
                    {T(["Aucun produit facultatif — l'acheteur a refusé les produits offerts.", "No optional product — the buyer declined the products offered."])} <Initials />
                  </td>
                </tr>
              ) : (
                <>
                  {productLines.map((x, i) => {
                    const paid = (x.id === "warranty" && pod.warranty) || (x.id === "tireRim" && pod.tireRim) || (x.id !== "warranty" && x.id !== "tireRim" && pod.fi);
                    return (
                      <tr key={i} style={{ borderBottom: "1px solid #d5e0e9" }}>
                        <td style={{ padding: 2 }}>{pn(x.name)}{x.code ? ` (${x.code})` : ""}</td>
                        <td style={{ padding: 2, textAlign: "center" }}>{x.term ? `${x.term} ${T(["an(s)", "yr(s)"])}` : "—"}</td>
                        <td style={{ padding: 2, textAlign: "center" }}>{paid ? T(["Payé à la livraison", "Paid at delivery"]) : T(["Inclus au contrat", "Included in contract"])}</td>
                        <td style={{ padding: 2, textAlign: "right" }}>{money(x.price)}</td>
                        <td style={{ padding: 2, textAlign: "center" }}>☐ {T(["Oui", "Yes"])} <Initials /></td>
                      </tr>
                    );
                  })}
                  {groups.accessories > 0 && (
                    <tr style={{ borderBottom: "1px solid #d5e0e9" }}>
                      <td style={{ padding: 2 }}>{T(["Accessoires", "Accessories"])}</td>
                      <td style={{ padding: 2, textAlign: "center" }}>—</td>
                      <td style={{ padding: 2, textAlign: "center" }}>{pod.accessories ? T(["Payé à la livraison", "Paid at delivery"]) : T(["Inclus au contrat", "Included in contract"])}</td>
                      <td style={{ padding: 2, textAlign: "right" }}>{money(groups.accessories)}</td>
                      <td style={{ padding: 2, textAlign: "center" }}>☐ {T(["Oui", "Yes"])} <Initials /></td>
                    </tr>
                  )}
                </>
              )}
            </tbody>
          </table>
          <div style={{ marginTop: 5, fontSize: 9, fontWeight: 700 }}>{T(["Preuve d'assurance automobile (obligatoire)", "Proof of auto insurance (required)"])}</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, fontSize: 8.8 }}>
            {[T(["Assureur", "Insurer"]), T(["N° de police", "Policy #"]), T(["Courtier / agent", "Broker / agent"]), T(["Téléphone", "Phone"])].map((x) => (
              <div key={x} style={{ borderBottom: "1px solid #000", paddingTop: 10 }}>{x} :</div>
            ))}
          </div>
          <div style={{ fontSize: 8.5, marginTop: 3 }}>
            {T(["Franchise collision maximale : 1 000 $ · Responsabilité civile minimale : 1 000 000 $ · Bénéficiaire :", "Max. collision deductible: $1,000 · Min. liability: $1,000,000 · Loss payee:"])} <b>{lender}</b>
          </div>
        </Sec>

        <Sec n={8} title={T(["VÉHICULE D'ÉCHANGE", "TRADE-IN VEHICLE"])}>
          {d.trade.description || c.tradeCredit > 0 ? (
            <Grid
              rows={[
                [T(["Véhicule", "Vehicle"]), d.trade.description],
                [T(["NIV", "VIN"]), d.trade.vin],
                [T(["Kilométrage", "Odometer"]), d.trade.kms],
                [T(["Couleur", "Colour"]), d.trade.colour],
                [T(["Valeur accordée", "Allowance"]), money(c.tradeCredit)],
                [T(["Solde dû / créancier", "Lien / lienholder"]), `${money(d.trade.lien)}${d.trade.lienHolder ? ` · ${d.trade.lienHolder}` : ""}`],
              ]}
            />
          ) : (
            <div style={{ fontSize: 9.5, color: "#3c5266" }}>{T(["Aucun véhicule d'échange.", "No trade-in vehicle."])}</div>
          )}
          <div style={{ fontSize: 8.3, marginTop: 3 }}>
            {T(
              [
                "Le vendeur du véhicule d'échange déclare en être le propriétaire, que le véhicule n'a pas subi de dommages majeurs non déclarés, que le système de coussins gonflables est fonctionnel et que l'odomètre est exact. Il demeure responsable de tout solde supérieur à celui déclaré.",
                "The trade-in seller declares being its owner, that the vehicle has no undisclosed major damage, that the airbag system is functional and the odometer is accurate. The seller remains responsible for any balance above the declared amount.",
              ],
            )}
          </div>
        </Sec>

        <Sec n={9} title={T(["CONDITIONS GÉNÉRALES", "GENERAL TERMS & CONDITIONS"])}>
          <ol style={{ columnCount: 2, columnGap: 16, fontSize: 8.2, lineHeight: 1.25, paddingLeft: 14, margin: 0 }}>
            {(kind === "lease" ? LEASE_TERMS : FINANCE_TERMS).map((x, i) => (
              <li key={i} style={{ marginBottom: 3, breakInside: "avoid" }}>{T(x)}</li>
            ))}
          </ol>
        </Sec>
        <Footer />
      </div>

      {/* ============================== PAGE 3 ============================== */}
      <div className="sheet shadow-2xl mt-6" style={sheet}>
        <Header page={3} />
        {kind === "lease" ? (
          <Sec n={10} title={T(["FIN DE LA LOCATION", "END OF LEASE"])}>
            <Grid
              rows={[
                [T(["Option d'achat", "Purchase option price"]), `${money(residualPurchase)} + ${T(["taxes", "taxes"])}`],
                [T(["Date de fin prévue", "Scheduled end date"]), fmtDate(addPeriods(firstDate, o.n))],
                [T(["Kilométrage total autorisé", "Total km allowed"]), `${o.totalKms.toLocaleString(loc)} km`],
                [T(["Frais km excédentaire", "Excess km charge"]), `${(s.excessKmCharge ?? 0).toFixed(2)} $ / km`],
                [T(["Frais de disposition", "Disposition fee"]), money(0)],
                [T(["Dépôt de sécurité remboursable", "Refundable security deposit"]), money(o.deliverySecurityDeposit)],
              ]}
            />
            <div style={{ fontSize: 8.4, marginTop: 4, lineHeight: 1.25 }}>
              {T(
                [
                  "À la fin du terme, le locataire doit soit (a) retourner le véhicule au locateur avec les clés, manuels et accessoires d'origine, après une inspection conjointe, soit (b) exercer l'option d'achat. Le dépôt de sécurité est remboursé, moins toute somme due au locateur.",
                  "At the end of the term, the lessee must either (a) return the vehicle to the lessor with the keys, manuals and original accessories after a joint inspection, or (b) exercise the purchase option. The security deposit is refunded, less any amount owed to the lessor.",
                ],
              )}
            </div>
          </Sec>
        ) : (
          <Sec n={10} title={T(["DROITS DE L'ACHETEUR", "BUYER'S RIGHTS"])}>
            <div style={{ fontSize: 8.6, lineHeight: 1.3 }}>
              {T(
                [
                  "L'acheteur peut, en tout temps, payer par anticipation le solde de son obligation sans pénalité. En cas de défaut, le cessionnaire ne peut exiger le paiement immédiat du solde ni reprendre le véhicule sans avoir transmis un avis écrit de 30 jours. Lorsque l'acheteur a acquitté au moins la moitié de l'obligation totale et de l'acompte, le cessionnaire ne peut reprendre le véhicule sans la permission du tribunal. L'acheteur peut, dans les 2 jours suivant la réception de son exemplaire, résoudre le contrat de crédit accessoire selon les modalités prévues par la loi.",
                  "The buyer may prepay the balance of the obligation at any time without penalty. In the event of default, the assignee may not demand immediate payment of the balance or repossess the vehicle without sending 30 days' written notice. Once the buyer has paid at least half of the total obligation and down payment, the assignee may not repossess the vehicle without court permission. The buyer may, within 2 days of receiving their copy, cancel the ancillary credit contract as provided by law.",
                ],
              )}
            </div>
          </Sec>
        )}

        <Sec n={11} title={T(["RECONNAISSANCES DE L'ACHETEUR / LOCATAIRE", "BUYER / LESSEE ACKNOWLEDGMENTS"])}>
          <table style={{ width: "100%", fontSize: 9 }}>
            <tbody>
              {ACKS.map((x, i) => (
                <tr key={i}>
                  <td style={{ padding: "2px 0", verticalAlign: "middle" }}>{i + 1}. {T(x)}</td>
                  <td style={{ width: 70, textAlign: "right" }}><Initials /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Sec>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7 }}>
          <Sec n={12} title={T(["DÉCLARATION D'ODOMÈTRE", "ODOMETER STATEMENT"])}>
            <div style={{ fontSize: 8.8, lineHeight: 1.3 }}>
              {T(["Je déclare que l'odomètre indique", "I declare that the odometer reads"])} <b>{d.vehicle.kms ? `${Number(d.vehicle.kms).toLocaleString(loc)} km` : "________ km"}</b>{" "}
              {T(["et qu'à ma connaissance cette lecture reflète le kilométrage réel du véhicule.", "and to my knowledge this reading reflects the vehicle's actual mileage."])}
            </div>
            <div style={{ fontSize: 8.8, marginTop: 4 }}>☐ {T(["Kilométrage réel", "Actual mileage"])} &nbsp; ☐ {T(["Dépasse la limite mécanique", "Exceeds mechanical limit"])} &nbsp; ☐ {T(["Non réel", "Not actual"])}</div>
          </Sec>
          <Sec n={13} title={T(["ACCUSÉ DE RÉCEPTION DU VÉHICULE", "VEHICLE DELIVERY RECEIPT"])}>
            <div style={{ fontSize: 8.8, lineHeight: 1.35 }}>
              ☐ {T(["Clés (2) et télécommandes", "Keys (2) and remotes"])} &nbsp; ☐ {T(["Manuel du propriétaire", "Owner's manual"])}
              <br />☐ {T(["Plaques / immatriculation", "Plates / registration"])} &nbsp; ☐ {T(["Inspection avant livraison", "Pre-delivery inspection"])}
              <br />☐ {T(["Fonctionnement expliqué", "Features explained"])} &nbsp; ☐ {T(["Certificats des produits", "Product certificates"])}
            </div>
          </Sec>
        </div>

        <Sec n={14} title={T(["CONSENTEMENT — RENSEIGNEMENTS PERSONNELS", "CONSENT — PERSONAL INFORMATION"])}>
          <div style={{ fontSize: 8.3, lineHeight: 1.25 }}>
            {T(
              [
                "J'autorise le commerçant et le cessionnaire à obtenir des renseignements de crédit auprès d'agents de renseignements (Equifax, TransUnion), à les échanger aux fins de la présente transaction et à les conserver pendant la durée du contrat, conformément à la Loi sur la protection des renseignements personnels dans le secteur privé. Je peux retirer mon consentement par écrit, sous réserve des obligations contractuelles.",
                "I authorize the dealer and the assignee to obtain credit information from credit bureaus (Equifax, TransUnion), to exchange it for this transaction and to retain it for the term of the contract, in accordance with applicable privacy legislation. I may withdraw my consent in writing, subject to contractual obligations.",
              ],
            )}
          </div>
        </Sec>

        <Sec n={15} title={T(["SIGNATURES", "SIGNATURES"])}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
            <Sig label={kind === "lease" ? T(["Locataire", "Lessee"]) : T(["Acheteur", "Buyer"])} sub={buyer} />
            <Sig label={T(["Co-signataire", "Co-signer"])} sub={d.customer.coBuyer || undefined} />
            <Sig label={T(["Représentant du commerçant", "Dealer representative"])} sub={d.fiManager || d.salesperson || undefined} />
            <Sig label={T(["Témoin", "Witness"])} />
          </div>
          <div style={{ marginTop: 8, border: "1px dashed #00263d", padding: "4px 6px", fontSize: 8.4 }}>
            <b>{T(["CESSION", "ASSIGNMENT"])}</b> —{" "}
            {T(["Pour valeur reçue, le commerçant cède le présent contrat et ses droits sur le véhicule à", "For value received, the dealer assigns this contract and its rights in the vehicle to"])} <b>{lender}</b>.
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, marginTop: 2 }}>
              <Sig label={T(["Pour le commerçant", "For the dealer"])} sub={s.dealerName} />
              <Sig label={T(["Pour le cessionnaire", "For the assignee"])} sub={lender} />
            </div>
          </div>
        </Sec>
        <Footer />
      </div>
    </>
  );
}
