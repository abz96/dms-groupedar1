import { eq } from "drizzle-orm";
import type { ReactNode } from "react";
import { db } from "@/db";
import { deals } from "@/db/schema";
import { computeDeal, leaseConfig, purchasedItems, customerLabel, FREQ_LABEL, money, normalizeDeal, vehicleLabel } from "@/lib/deal";
import { ensureSchema, getLenders, getSettings } from "@/lib/server";
import { translate } from "@/lib/i18n-server";
import { printT } from "@/lib/print-i18n";

/** Offer sheet (lease / finance / purchase) — one printable page. */
export default async function OfferSheet({ id, lang }: { id: number; lang: "fr" | "en" }) {
  await ensureSchema();
  const rows = await db.select().from(deals).where(eq(deals.id, Number(id)));
  const row = rows[0];
  if (!row) return null;
  const [lenders, s] = await Promise.all([getLenders(), getSettings()]);
  const d = normalizeDeal(row.data);
  const c = computeDeal(d, lenders, s.excessKmCharge, leaseConfig(s));
  const [o1, o2] = c.options;
  const p = d.pricing;
  const t = d.dealType;
  const tr = c.taxRate;
  const prov = c.prov;
  const purchased = purchasedItems(d);
  const L = printT(lang);
  const tax1Label = L(prov.hst ? "HST" : "GST");
  const tax2Label = L(prov.hst ? "PST" : prov.pstLabel);

  const title = L(t === "lease" ? "Offer to Lease" : t === "finance" ? "Offer to Finance" : "Offer to Purchase");
  const name = customerLabel(d) || "________________";
  const custAddr = [d.customer.address, d.customer.city, d.customer.province, d.customer.postal].filter(Boolean).join(" ");
  const today = new Date().toLocaleDateString(lang === "fr" ? "fr-CA" : "en-US", { timeZone: "America/Toronto" });

  // ---- Price disclosure (option 1) ----
  // when the discount is hidden, it is folded into the sale price instead of shown as an adjustment
  const hideRed = d.showReduction === false;
  const totalSale = p.basePrice + p.freight + p.adminFees - (hideRed ? p.reduction : 0);
  const optionsAcc = p.options + p.accessories;
  const totalList = totalSale + optionsAcc;
  let adjustment = 0;
  let cashRow = 0;
  let taxesRow = 0;
  let other = c.fiSubtotal + c.luxuryTax + (t === "cash" ? p.tireTax : 0);
  if (t === "lease") {
    adjustment = -((hideRed ? 0 : p.reduction) + d.cash.rebatePreTax + p.rmNonTax + d.cash.rebateTaxIncl / (1 + tr));
    cashRow = d.cash.cashDownPreTax + d.cash.cashDownTaxIncl / (1 + tr);
  } else {
    adjustment = -((hideRed ? 0 : p.reduction) + d.cash.rebatePreTax + d.cash.rebateTaxIncl + p.rmNonTax);
    cashRow = c.cashPaid + d.cash.deposit;
    taxesRow = t === "finance" ? c.totalTaxes - (c.tireWithTax - p.tireTax) : c.totalTaxes;
    other += d.cash.deliveryFees;
  }
  const difference = totalList + adjustment - c.tradeNet;
  const ppsa = 0; // RDPRM/PPSA is paid on delivery day (not financed)
  const financed = t === "lease" ? o1.capCost : t === "finance" ? o1.amountFinanced : c.soldeDu;
  const otherIncludesAll: [string, number][] = (
    [
      ...d.products.map((x) => [`${lang === "fr" ? x.name : translate("en", x.name)}${x.term ? ` (${x.term} ${L("yrs")})` : ""}`, x.price] as [string, number]),
      [L("Luxury Tax"), c.luxuryTax],
      [L("Tire Tax"), t === "cash" ? p.tireTax : 0],
      [L("Delivery Fees"), t === "lease" ? 0 : d.cash.deliveryFees],
    ] as [string, number][]
  ).filter(([, v]) => v);
  // 5 printed slots — merge the rest into the last one
  const otherIncludes: [string, number][] =
    otherIncludesAll.length <= 5
      ? otherIncludesAll
      : [...otherIncludesAll.slice(0, 4), [L("Other"), otherIncludesAll.slice(4).reduce((a, [, v]) => a + v, 0)]];

  const both = (f: (o: typeof o1, i: 0 | 1) => ReactNode): [ReactNode, ReactNode] => [f(o1, 0), f(o2, 1)];
  const lenderName = (i: 0 | 1) => {
    const n = c.options[i].lender?.name;
    return n ? <span style={{ fontSize: n.length > 26 ? 8.5 : 10 }}>{n}</span> : "—";
  };
  const rate = (i: 0 | 1) => `${d.options[i].rate.toFixed(2)}% / ${d.options[i].rate.toFixed(2)}%`;

  const TermRow = ({ l, v, b, hl }: { l: ReactNode; v: [ReactNode, ReactNode]; b?: boolean; hl?: boolean }) => (
    <tr className={b ? "font-bold" : ""} style={{ fontSize: b ? 12 : 11 }}>
      <td className="c">{l}</td>
      <td className="c ctr" style={hl ? { background: "#fff59d" } : undefined}>{v[0]}</td>
      <td className="c ctr">{v[1]}</td>
    </tr>
  );
  const UpRow = ({ l, v, b, u }: { l: string; v: [ReactNode, ReactNode]; b?: boolean; u?: boolean }) => (
    <tr className={b ? "font-bold" : ""} style={{ fontSize: 11 }}>
      <td className="r" style={{ padding: "1px 8px" }}>{l}</td>
      <td className="r" style={{ padding: "1px 8px", textDecoration: u ? "underline" : undefined }}>{v[0]}</td>
      <td className="r" style={{ padding: "1px 8px", textDecoration: u ? "underline" : undefined }}>{v[1]}</td>
    </tr>
  );
  const PD = ({ l, v, extra }: { l: string; v: ReactNode; extra?: ReactNode }) => (
    <tr>
      <td className="c r font-bold" style={{ width: "38%" }}>{l}</td>
      <td className="c r" style={{ width: "20%" }}>{v}</td>
      <td className="c" style={{ width: "30%" }}>{extra}</td>
      <td className="c r" style={{ width: "12%" }} />
    </tr>
  );

  return (
      <div className="sheet offer-sheet shadow-2xl mt-6" style={{ height: "11in", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* ===== Header ===== */}
        <div className="bx">
          <table>
            <tbody>
              <tr>
                <td style={{ padding: "3px 4px", fontSize: 15, fontWeight: 700, width: "52%" }}>
                  {s.dealerName} <span style={{ fontWeight: 700 }}>{s.legalName ? `(${s.legalName})` : ""}</span>
                </td>
                <td style={{ fontSize: 13 }}>{L("Tel:")} {s.tel}</td>
                <td className="r" style={{ fontSize: 13, paddingRight: 4 }}>{L("Fax:")} {s.fax}</td>
              </tr>
              <tr>
                <td style={{ padding: "0 4px 3px", fontSize: 13 }}>{s.address}</td>
                <td style={{ fontSize: 11 }}>{L("Dealer #:")} <b>{s.dealerNumber}</b></td>
                <td className="r" style={{ fontSize: 10, paddingRight: 4, lineHeight: 1.1 }}>
                  {s.qstNumber && <div>{L("QST#:")} {s.qstNumber}</div>}
                  <div>{L("GST/HST#:")} <b style={{ fontSize: 12 }}>{s.gstNumber}</b></div>
                </td>
              </tr>
            </tbody>
          </table>
          <table style={{ borderTop: "1px solid #000" }}>
            <tbody>
              <tr>
                <td style={{ padding: "2px 4px", fontSize: 12, width: "48%" }}>
                  {title} {L("prepared for:")} <i>{name}</i>
                </td>
                <td style={{ fontSize: 11 }}>{custAddr}</td>
                <td className="r font-bold" style={{ fontSize: 13, paddingRight: 4 }}>{today}</td>
              </tr>
              <tr>
                <td style={{ padding: "2px 4px", fontSize: 12 }}>
                  {L("Prepared By:")} <i>{d.salesperson || "________________"}</i>
                </td>
                <td style={{ fontSize: 11 }}>
                  {L("Home:")} {d.customer.homePhone} &nbsp;&nbsp;&nbsp; {L("Mobile:")} {d.customer.mobile}
                </td>
                <td className="r" style={{ fontSize: 13, paddingRight: 4 }}>
                  #: <b>{row.dealNumber}</b>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* ===== Vehicle ===== */}
        <div style={{ display: "flex", gap: 10, marginTop: 2 }}>
          <div className="bx" style={{ width: "46%" }}>
            <table>
              <tbody>
                <tr>
                  <td colSpan={2} style={{ padding: "1px 4px", fontWeight: 700, fontSize: 12, borderBottom: "1.5px solid #000" }}>
                    {vehicleLabel(d) || L("Vehicle")}
                  </td>
                  <td className="r font-bold" style={{ fontSize: 12, paddingRight: 4, borderBottom: "1.5px solid #000" }}>{d.vehicle.stock}</td>
                </tr>
                {(
                  [
                    [L("Ext. Colour:"), d.vehicle.extColor],
                    [L("Int. Colour:"), d.vehicle.intColor],
                    [L("Total KMS:"), d.vehicle.kms ? `${d.vehicle.kms}${d.vehicle.condition === "NEUF" ? ` ${L("(anticipated)")}` : ""}` : ""],
                    [L("Warranty:"), d.vehicle.warranty],
                    [L("In-Serv. Date:"), d.vehicle.inServiceDate],
                    [L("VIN:"), d.vehicle.vin],
                    [L("Status:"), d.vehicle.condition === "NEUF" ? L("New") : d.vehicle.condition === "DÉMO" ? L("Demo") : L("Used")],
                    [L("Sp. Status:"), d.vehicle.spStatus],
                  ] as [string, string][]
                ).map(([l, v], i) => (
                  <tr key={l} style={{ fontSize: 12, lineHeight: 1.15 }}>
                    <td className="c r font-bold" style={{ width: "35%" }}>{l}</td>
                    <td className="c" style={{ width: "40%" }}>{v}</td>
                    {i === 0 && (
                      <td rowSpan={8} className="c ctr" style={{ verticalAlign: "top", fontSize: 11 }}>
                        <div className="font-bold" style={{ fontSize: 12 }}>{L("Body Style")}</div>
                        <div>{d.vehicle.bodyStyle}</div>
                        <div style={{ height: 60 }} />
                        <div className="font-bold" style={{ fontSize: 12 }}>{L("Transmission")}</div>
                        <div>{d.vehicle.transmission}</div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ flex: 1, fontWeight: 700, fontSize: 10.5, lineHeight: 1.25, whiteSpace: "pre-wrap" }}>
            {d.vehicle.description}
            {purchased.length > 0 && (
              <div style={{ marginTop: 6 }}>
                <div style={{ textDecoration: "underline" }}>{L("Purchased by customer:")}</div>
                {purchased.map((a, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", maxWidth: 330 }}>
                    <span>
                      {lang === "fr" ? a.name : translate("en", a.name)}
                      {a.detail ? ` — ${a.detail} ${L("yrs")}` : ""}
                    </span>
                    <span>{money(a.price)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ===== Body ===== */}
        <div style={{ display: "flex", gap: 22, marginTop: 14, flex: 1, minHeight: 0 }}>
          {/* Left column */}
          <div style={{ width: "49%", display: "flex", flexDirection: "column" }}>
            <div className="bx" style={{ borderBottom: "none", marginTop: 26 }}>
              <div style={{ padding: "1px 3px", fontSize: 12, borderBottom: "1px solid #000" }}>
                {L("Comments, Promises,")}
                <br />
                {L("Restrictions, Limitations and Conditions:")}
              </div>
              <div style={{ padding: "1px 3px", fontSize: 9.5, minHeight: 60, maxHeight: 92, overflow: "hidden", fontWeight: 600, whiteSpace: "pre-wrap" }}>{d.comments}</div>
            </div>
            <div className="bx" style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
              <table>
                <tbody>
                  <tr className="font-bold italic" style={{ fontSize: 13 }}>
                    <td className="c" style={{ width: "54%" }}>{L(t === "lease" ? "LEASING TERMS:" : t === "finance" ? "FINANCING TERMS:" : "PURCHASE TERMS:")}</td>
                    <td className="c ctr">OPT 1</td>
                    <td className="c ctr">{t === "cash" ? "" : "OPT 2"}</td>
                  </tr>
                  {t === "lease" && (
                    <>
                      <TermRow l={L("Leasing Company:")} v={[lenderName(0), lenderName(1)]} />
                      <TermRow l={L("Interest Rate: / APR:")} v={[rate(0), rate(1)]} />
                      <TermRow l={L("Payment Type:")} v={both((_, i) => L(FREQ_LABEL[d.options[i].frequency]))} />
                      <TermRow l={L("Term:")} v={both((_, i) => d.options[i].term)} hl />
                      <TermRow l={L("TOTAL KMs at Lease End:")} v={both((o) => o.totalKms)} />
                      <TermRow l={L("Cash Downpayment:")} v={both(() => money(d.cash.cashDownPreTax + d.cash.cashDownTaxIncl))} />
                      <TermRow l={`${L("Residual:")} (${o1.residualPct}%, ${o2.residualPct}%)`} v={both((o) => money(o.residual))} />
                      <TermRow l={L("LEASE PAYMENT:")} v={both((o) => `${money(o.payment)}*`)} b />
                      <TermRow l={<span style={{ paddingLeft: 18 }}>{tax1Label}:</span>} v={both((o) => money(o.gstOnPayment))} />
                      <TermRow l={<span style={{ paddingLeft: 18 }}>{tax2Label}:</span>} v={both((o) => money(o.pstOnPayment))} />
                      <TermRow l={L("TOTAL PAYMENT:")} v={both((o) => money(o.totalPayment))} b hl />
                    </>
                  )}
                  {t === "finance" && (
                    <>
                      <TermRow l={L("Lender:")} v={[lenderName(0), lenderName(1)]} />
                      <TermRow l={L("Interest Rate: / APR:")} v={[rate(0), rate(1)]} />
                      <TermRow l={L("Payment Type:")} v={both((_, i) => L(FREQ_LABEL[d.options[i].frequency]))} />
                      <TermRow l={L("Term (months):")} v={both((_, i) => d.options[i].term)} hl />
                      <TermRow l={L("No. of Payments:")} v={both((o) => o.n)} />
                      <TermRow l={L("Cash Downpayment:")} v={both(() => money(c.cashPaid))} />
                      <TermRow l={L("Amount Financed:")} v={both((o) => money(o.amountFinanced))} />
                      <TermRow l={<span style={{ paddingLeft: 18 }}>{L("Taxes incl.")} ({tax1Label}/{tax2Label}):</span>} v={both(() => money(c.totalTaxes))} />
                      <TermRow l={L("TOTAL PAYMENT:")} v={both((o) => money(o.payment))} b hl />
                    </>
                  )}
                  {t === "cash" && (
                    <>
                      <TermRow l={L("Purchase Price (before tax):")} v={[money(c.achatTotal), ""]} />
                      <TermRow l={L("Less Trade Value:")} v={[money(-c.tradeCredit), ""]} />
                      <TermRow l={L("Taxable Amount:")} v={[money(c.taxable), ""]} />
                      <TermRow l={`${tax1Label}:`} v={[money(prov.hst ? c.hst : c.gst), ""]} />
                      <TermRow l={`${tax2Label}:`} v={[money(c.pst), ""]} />
                      <TermRow l={L("TOTAL PRICE:")} v={[money(c.cashTotal), ""]} b hl />
                    </>
                  )}
                </tbody>
              </table>
              <div style={{ borderTop: "1.5px solid #000", padding: "0 3px", flex: 1, display: "flex", flexDirection: "column" }}>
                <div className="font-bold italic" style={{ fontSize: 13 }}>{L("UPFRONT PAYMENTS:")}</div>
                <table>
                  <tbody>
                    {t === "cash" ? (
                      <>
                        <UpRow l={L("Cash Down (taxes incl.):")} v={[money(c.cashPaid), ""]} />
                        <UpRow l={L("Rebates / Manufacturer:")} v={[money(d.cash.rebateTaxIncl + p.rmNonTax), ""]} />
                        <UpRow l={L("Less Customer Deposit ():")} v={[money(d.cash.deposit), ""]} />
                        <UpRow l={L("Balance Due on Delivery")} v={[money(c.soldeDu), ""]} b />
                      </>
                    ) : (
                      <>
                        {t === "lease" && <UpRow l={L("Security Deposit:")} v={both((o) => money(o.deliverySecurityDeposit))} />}
                        <UpRow l={L("PPSA due on Delivery:")} v={both((o) => money(o.deliveryRegistration))} />
                        <UpRow l={L("Tire Tax due on Delivery:")} v={both((o) => money(o.deliveryTireTax))} />
                        {c.options.some((o) => o.deliveryCashDown) && <UpRow l={L(t === "lease" ? "Cash Down (taxes incl.):" : "Cash Down (taxes incl.):")} v={both((o) => money(o.deliveryCashDown))} />}
                        {c.options.some((o) => o.deliveryProducts) && <UpRow l={L("Products paid on delivery (taxes incl.):")} v={both((o) => money(o.deliveryProducts))} />}
                        <UpRow l={L("SUBTOTAL:")} v={both((o) => money(o.dueOnDelivery + o.depositApplied - o.deliveryFirstPayment))} b />
                        <UpRow l={L("Less Customer Deposit ():")} v={both((o) => money(o.depositApplied))} />
                        {t === "lease" && <UpRow l={L("1st Payment (first month)")} v={both((o) => money(o.deliveryFirstPayment))} u />}
                        <UpRow l={L("Due on Delivery:")} v={both((o) => money(o.dueOnDelivery))} b />
                      </>
                    )}
                  </tbody>
                </table>
                <div style={{ flex: 1, minHeight: 8 }} />
                <table style={{ borderTop: "1.5px solid #000" }}>
                  <tbody>
                    {t !== "cash" ? (
                      <>
                        <UpRow l={L(t === "lease" ? "Implicit Finance Charge" : "Cost of Borrowing")} v={both((o) => money(o.costOfBorrowing))} />
                        <UpRow l={L(t === "lease" ? "Total Lease Cost" : "Total Obligation")} v={both((o) => money(o.totalObligation))} />
                      </>
                    ) : (
                      <UpRow l={L("Total Purchase Price")} v={[money(c.cashTotal), ""]} />
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            <div style={{ fontSize: 11, padding: "3px 4px" }}>
              {t === "lease" && <div>{L("Excess mileage charge at lease end:")} {Math.round(s.excessKmCharge * 100)} {L("cents/km.")}</div>}
              <div>{L("Vehicle licensing fees not included")}</div>
            </div>
          </div>

          {/* Right column */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
            <div className="bx">
              <div className="ctr font-bold" style={{ fontSize: 13, borderBottom: "1px solid #000" }}>{L("PRICE DISCLOSURE")}</div>
              <table style={{ fontSize: 10.5 }}>
                <tbody>
                  <PD l={L("For Option:")} v={<span className="ctr block">1</span>} extra={<b>{L("'Other' Includes:")}</b>} />
                  <PD l={L("Total Sale Price:")} v={money(totalSale)} extra={otherIncludes[0] ? `${otherIncludes[0][0]}: ${money(otherIncludes[0][1])}` : ""} />
                  <PD l={L("Options (see above):")} v={money(optionsAcc)} extra={otherIncludes[1] ? `${otherIncludes[1][0]}: ${money(otherIncludes[1][1])}` : ""} />
                  <PD l={L("Total List:")} v={money(totalList)} extra={otherIncludes[2] ? `${otherIncludes[2][0]}: ${money(otherIncludes[2][1])}` : ""} />
                  <PD l={L("Adjustment:")} v={money(adjustment, true)} extra={otherIncludes[3] ? `${otherIncludes[3][0]}: ${money(otherIncludes[3][1])}` : ""} />
                  <PD l={L("Trade Downpayment:")} v={money(c.tradeNet)} extra={otherIncludes[4] ? `${otherIncludes[4][0]}: ${money(otherIncludes[4][1])}` : ""} />
                  <PD l={L("DIFFERENCE:")} v={money(difference)} />
                  {t !== "lease" && <PD l={L("Taxes:")} v={money(taxesRow)} />}
                  {cashRow !== 0 && <PD l={L("Less Cash Down / Deposit:")} v={money(-cashRow, true)} />}
                  {t !== "cash" && <PD l={L("Filing/PPSA Fees:")} v={money(ppsa)} />}
                  <tr>
                    <td className="c r font-bold">{L("Other:")}</td>
                    <td className="c r">{money(other)}</td>
                    <td className="c r">&lt;&lt;&lt; &nbsp;&nbsp;&nbsp; {L("Total:")}</td>
                    <td className="c r">{money(other)}</td>
                  </tr>
                  <PD l={L(t === "cash" ? "Balance Due:" : "Financed Amount:")} v={money(financed)} />
                </tbody>
              </table>
            </div>

            <div className="bx" style={{ marginTop: 10 }}>
              <div style={{ fontSize: 11.5, padding: "1px 3px", borderBottom: "1px solid #000" }}>{L("TRADE DISCLOSURE:")}</div>
              <table style={{ fontSize: 10.5 }}>
                <tbody>
                  {(
                    [
                      [L("Year Make Model"), d.trade.description, null],
                      [L("VIN"), d.trade.vin, null],
                      [L("KMs"), d.trade.kms, null],
                      [L("Colour"), d.trade.colour, null],
                      [L("Lien/Cashback pay to"), d.trade.lienHolder, null],
                      [L("Lien / Cashback"), "", d.trade.lien],
                      [L("Assigned Value(s)"), "", c.tradeCredit],
                      [L("Trade Downpayment"), "", Math.max(0, c.tradeNet)],
                      [L("Payable To Customer"), "", 0],
                      [L("Refinanced Equity"), "", Math.min(0, c.tradeNet)],
                    ] as [string, string, number | null][]
                  ).map(([l, v, n], i) => (
                    <tr key={l}>
                      <td className="c r font-bold" style={{ width: "40%" }}>{l}</td>
                      <td className={`c ${n !== null ? "r font-bold" : ""}`} style={{ width: "22%" }}>{n !== null ? money(n) : v}</td>
                      {i === 0 && <td className="c" rowSpan={1} style={{ borderBottom: "none" }} />}
                      {i === 1 && (
                        <td rowSpan={10} className="c" style={{ fontSize: 8, verticalAlign: "top", lineHeight: 1.2, borderTop: "none" }}>
                          {L("TRADE_DECL")}
                          <br />X__________
                        </td>
                      )}
                    </tr>
                  ))}
                  <tr>
                    <td className="c">&nbsp;</td>
                    <td className="c" />
                  </tr>
                </tbody>
              </table>
            </div>

            <div style={{ fontSize: 8.4, lineHeight: 1.18, marginTop: 8 }}>
              <p className="font-semibold">
                {L("P_PRICES")}
                {L(prov.code === "QC" ? "P_SAAQ" : "P_OMVIC")}
              </p>
              <p className="font-semibold" style={{ marginTop: 5 }}>
                {L("P_READ")}
                <br />
                {L("P_PRIVACY")} X__________
              </p>
              <p className="font-semibold" style={{ marginTop: 5 }}>
                {L(t === "lease" ? "OFFER_LEASE" : t === "finance" ? "OFFER_FINANCE" : "OFFER_PURCHASE")}
              </p>
            </div>

            <div style={{ marginTop: "auto", paddingTop: 6, fontSize: 11.5 }}>
              <div>X</div>
              <div style={{ borderTop: "1px solid #000" }} className="font-bold">
                {name} &nbsp;&nbsp;&nbsp; <span className="font-semibold">({d.customer.email || s.email})</span>
              </div>
              <div style={{ marginTop: 6 }}>X</div>
              <div style={{ borderTop: "1px solid #000" }} className="font-bold">{L("Dealer Acceptance / Reg.#")}</div>
              <div className="r" style={{ fontSize: 8, marginTop: 3 }}>Copyright {new Date().getFullYear()} GROUPE DAR DMS</div>
            </div>
          </div>
        </div>
      </div>
  );
}
