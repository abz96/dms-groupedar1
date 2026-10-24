import type { ReactNode } from "react";
import { CONDITIONS, creditMetrics, maskSin, num, scoreBand, suggestDecision, type CreditData } from "@/lib/credit";
import { money, type DealerSettings } from "@/lib/deal";

type Lang = "fr" | "en";

const STAMP: Record<string, { fr: string; en: string; color: string; bg: string }> = {
  approved: { fr: "APPROUVÉ", en: "APPROVED", color: "#1e7b45", bg: "#e7f6ec" },
  conditional: { fr: "APPROBATION CONDITIONNELLE", en: "CONDITIONAL APPROVAL", color: "#a0620a", bg: "#fff4e0" },
  declined: { fr: "REFUSÉ", en: "DECLINED", color: "#b42318", bg: "#fdecec" },
  "": { fr: "EN ATTENTE DE DÉCISION", en: "DECISION PENDING", color: "#5a7086", bg: "#f1f4f7" },
};

/** Credit decision / approval notice (one page). */
export default function CreditApprovalDocument({ data, appNumber, s, lang }: { data: CreditData; appNumber: string; s: DealerSettings; lang: Lang }) {
  const T = (fr: string, en: string) => (lang === "fr" ? fr : en);
  const loc = lang === "fr" ? "fr-CA" : "en-CA";
  const m = creditMetrics(data);
  const sug = suggestDecision(data, m);
  const score = num(data.bureau.score);
  const band = scoreBand(score);
  const dec = data.decision;
  const st = STAMP[dec.status] ?? STAMP[""];
  const pct = (n: number) => (n >= 999 ? "—" : `${n.toFixed(1)} %`);
  const today = new Date().toLocaleDateString(loc, { year: "numeric", month: "long", day: "numeric" });
  const name = `${data.applicant.firstName} ${data.applicant.lastName}`.trim() || "________________";

  const Sec = ({ title, children }: { title: string; children: ReactNode }) => (
    <div style={{ border: "1.5px solid #00263d", marginTop: 8 }}>
      <div style={{ background: "#00263d", color: "#fff", fontWeight: 700, fontSize: 10, padding: "2px 6px", letterSpacing: 0.4 }}>{title}</div>
      <div style={{ padding: "5px 7px" }}>{children}</div>
    </div>
  );
  const KV = ({ rows, cols = 2 }: { rows: [string, ReactNode][]; cols?: number }) => (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, 1fr)`, columnGap: 14, rowGap: 2, fontSize: 10 }}>
      {rows.map(([k, v]) => (
        <div key={k} style={{ display: "flex", gap: 6, borderBottom: "1px dotted #b9c7d3", padding: "1.5px 0" }}>
          <span style={{ color: "#3c5266" }}>{k}</span>
          <span style={{ fontWeight: 700, marginLeft: "auto", textAlign: "right" }}>{v || "—"}</span>
        </div>
      ))}
    </div>
  );
  const Sig = ({ label }: { label: string }) => (
    <div>
      <div style={{ height: 24 }} />
      <div style={{ borderTop: "1px solid #000", fontSize: 9, paddingTop: 1 }}><b>{label}</b></div>
      <div style={{ fontSize: 8, color: "#3c5266" }}>{T("Date", "Date")} : ____ / ____ / ________</div>
    </div>
  );

  return (
    <div className="sheet shadow-2xl mt-6" style={{ minHeight: "11in", display: "flex", flexDirection: "column", fontSize: 10 }}>
      {/* header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "3px solid #0071bc", paddingBottom: 5 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 800, color: "#00263d" }}>{s.dealerName}</div>
          <div style={{ fontSize: 9 }}>{s.legalName} · {s.address}</div>
          <div style={{ fontSize: 8.5, color: "#3c5266" }}>{T("Tél.", "Tel.")} {s.tel} · {T("N° commerçant", "Dealer #")} {s.dealerNumber}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: "#0071bc" }}>{T("AVIS DE DÉCISION DE CRÉDIT", "CREDIT DECISION NOTICE")}</div>
          <div style={{ fontSize: 9, marginTop: 2 }}>
            {T("Demande", "Application")} <b>{appNumber}</b>
            {data.quoteNumber ? <> · {T("Quotation", "Quotation")} <b>#{data.quoteNumber}</b></> : null}
          </div>
          <div style={{ fontSize: 9 }}>{today}</div>
        </div>
      </div>

      {/* stamp */}
      <div style={{ marginTop: 10, border: `3px solid ${st.color}`, background: st.bg, color: st.color, textAlign: "center", padding: "8px 0" }}>
        <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: 3 }}>{lang === "fr" ? st.fr : st.en}</div>
        {dec.decidedBy && (
          <div style={{ fontSize: 9.5, fontWeight: 600 }}>
            {T("Décision rendue par", "Decision by")} {dec.decidedBy}
            {dec.decidedAt ? ` · ${new Date(dec.decidedAt).toLocaleString(loc, { dateStyle: "medium", timeStyle: "short" })}` : ""}
          </div>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <Sec title={T("DEMANDEUR", "APPLICANT")}>
          <KV
            cols={1}
            rows={[
              [T("Nom", "Name"), name],
              [T("Naissance", "Date of birth"), data.applicant.dob],
              ["NAS / SIN", maskSin(data.applicant.sin)],
              [T("Adresse", "Address"), [data.applicant.address, data.applicant.city, data.applicant.province].filter(Boolean).join(", ")],
              [T("Employeur", "Employer"), data.applicant.employer],
              [T("Co-demandeur", "Co-applicant"), data.hasCoApplicant ? `${data.coApplicant.firstName} ${data.coApplicant.lastName}`.trim() : T("Aucun", "None")],
            ]}
          />
        </Sec>
        <Sec title={T("FINANCEMENT DEMANDÉ", "FINANCING REQUESTED")}>
          <KV
            cols={1}
            rows={[
              [T("Véhicule", "Vehicle"), data.vehicle],
              [T("Type", "Type"), data.dealType === "lease" ? T("Location", "Lease") : T("Financement", "Finance")],
              [T("Prix de vente", "Selling price"), money(num(data.price))],
              [T("Comptant / échange", "Down / trade"), `${money(num(data.downPayment))} / ${money(num(data.tradeIn))}`],
              [T("Montant à financer", "Amount to finance"), <b key="a" style={{ fontSize: 11 }}>{money(m.amountFinanced)}</b>],
              [T("Prêteur · terme · taux", "Lender · term · rate"), [data.lender, data.termRequested ? `${data.termRequested} ${T("mois", "mo")}` : "", data.rate ? `${data.rate} %` : ""].filter(Boolean).join(" · ")],
            ]}
          />
        </Sec>
      </div>

      <Sec title={T("SOMMAIRE DU DOSSIER EQUIFAX", "EQUIFAX FILE SUMMARY")}>
        <div style={{ display: "grid", gridTemplateColumns: "150px 1fr", gap: 10, alignItems: "center" }}>
          <div style={{ border: `2px solid ${score ? band.color : "#9fb3c4"}`, textAlign: "center", padding: "6px 0" }}>
            <div style={{ fontSize: 8.5, color: "#3c5266", fontWeight: 700 }}>EQUIFAX RISK SCORE 2.0</div>
            <div style={{ fontSize: 30, fontWeight: 900, color: score ? band.color : "#9fb3c4", lineHeight: 1.1 }}>{score || "—"}</div>
            <div style={{ fontSize: 9.5, fontWeight: 800, color: score ? band.color : "#9fb3c4" }}>{score ? (lang === "fr" ? band.fr : band.en) : ""}</div>
          </div>
          <KV
            cols={3}
            rows={[
              [T("Dossier depuis", "File since"), data.bureau.fileSince],
              [T("Date du rapport", "Report date"), data.bureau.pulledAt],
              [T("Comptes", "Trades"), String(m.tradeCount)],
              [T("Demandes (12 m)", "Inquiries (12m)"), String(m.inquiries12)],
              [T("Recouvrements", "Collections"), String(m.openCollections)],
              [T("Dossiers publics", "Public records"), String(m.activePublic + m.dischargedPublic)],
              [T("Retards 30/60/90", "Lates 30/60/90"), `${m.late30} / ${m.late60} / ${m.late90}`],
              [T("Util. renouvelable", "Revolving util."), `${m.revolvingUtil.toFixed(0)} %`],
              [T("Référence", "Reference"), data.bureau.reference],
            ]}
          />
        </div>
      </Sec>

      <Sec title={T("RATIOS ET CAPACITÉ DE PAIEMENT", "RATIOS & PAYMENT CAPACITY")}>
        <KV
          cols={3}
          rows={[
            [T("Revenu mensuel", "Monthly income"), money(m.monthlyIncome)],
            [T("Taxes", "Taxes"), money(m.taxes)],
            [T("Équité négative", "Negative equity"), money(m.negativeEquity)],
            [T("Valeur Black Book", "Black Book value"), money(m.bookValue)],
            ["LTV", pct(m.ltv)],
            [`${T("Paiement est.", "Est. payment")} @${m.testRate.toFixed(2)} %`, money(m.estPayment)],
            ["PTI", pct(m.pti)],
            ["TDS", pct(m.tds)],
            [T("Financement max. suggéré", "Suggested max financing"), sug.maxFinance ? money(sug.maxFinance) : "—"],
          ]}
        />
      </Sec>

      {dec.status === "conditional" && (
        <Sec title={T("CONDITIONS À REMPLIR AVANT LA LIVRAISON", "CONDITIONS TO BE MET BEFORE DELIVERY")}>
          <table style={{ width: "100%", fontSize: 10 }}>
            <tbody>
              {(dec.conditions.length ? dec.conditions : ["—"]).map((k) => {
                const c = CONDITIONS.find((x) => x[0] === k);
                return (
                  <tr key={k}>
                    <td style={{ padding: "2px 0" }}>
                      ☐ {c ? (lang === "fr" ? c[1] : c[2]) : k}
                      {k === "higher_down" && dec.requiredDown ? <b> : {money(num(dec.requiredDown))}</b> : null}
                    </td>
                    <td style={{ width: 160, borderBottom: "1px solid #000", fontSize: 8, color: "#3c5266", verticalAlign: "bottom" }}>{T("Reçu / vérifié", "Received / verified")}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Sec>
      )}

      {dec.status && dec.status !== "declined" && (
        <Sec title={T("MODALITÉS APPROUVÉES", "APPROVED TERMS")}>
          <KV
            cols={4}
            rows={[
              [T("Montant approuvé", "Approved amount"), dec.approvedAmount ? money(num(dec.approvedAmount)) : ""],
              [T("Taux", "Rate"), dec.approvedRate ? `${dec.approvedRate} %` : ""],
              [T("Terme", "Term"), dec.approvedTerm ? `${dec.approvedTerm} ${T("mois", "mo")}` : ""],
              [T("Prêteur", "Lender"), dec.lender],
            ]}
          />
          <div style={{ fontSize: 8.5, color: "#3c5266", marginTop: 3 }}>
            {T("Approbation valide 30 jours, sous réserve de la vérification des documents et de l'approbation finale du prêteur.", "Approval valid for 30 days, subject to document verification and final lender approval.")}
          </div>
        </Sec>
      )}

      {(dec.notes || dec.status === "declined") && (
        <Sec title={dec.status === "declined" ? T("MOTIFS DU REFUS", "REASONS FOR DECLINE") : T("NOTES", "NOTES")}>
          <div style={{ fontSize: 10, whiteSpace: "pre-wrap" }}>{dec.notes || sug.reasons.map((r) => `• ${lang === "fr" ? r[0] : r[1]}`).join("\n")}</div>
          {dec.status === "declined" && (
            <div style={{ fontSize: 8.5, color: "#3c5266", marginTop: 4 }}>
              {T(
                "Cette décision est fondée en tout ou en partie sur les renseignements obtenus d'Equifax Canada Co., C.P. 190, succursale Jean-Talon, Montréal (Québec) H1S 2Z2, 1 800 465-7166. Vous avez le droit de connaître et de faire corriger les renseignements contenus dans votre dossier de crédit.",
                "This decision is based in whole or in part on information obtained from Equifax Canada Co., Box 190, Jean-Talon Station, Montréal, QC H1S 2Z2, 1-800-465-7166. You have the right to know and correct the information in your credit file.",
              )}
            </div>
          )}
        </Sec>
      )}

      <div style={{ marginTop: "auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 22, marginTop: 10 }}>
          <Sig label={`${T("Directeur F&A / gestionnaire", "F&I manager / manager")}${dec.decidedBy ? ` — ${dec.decidedBy}` : ""}`} />
          <Sig label={`${T("Accusé de réception — demandeur", "Acknowledged — applicant")} — ${name}`} />
        </div>
        <div style={{ fontSize: 7.8, color: "#7a8ea0", marginTop: 8, display: "flex", justifyContent: "space-between" }}>
          <span>{T("Document confidentiel — usage interne et prêteur seulement.", "Confidential — internal and lender use only.")}</span>
          <span>{appNumber} · Groupe Dar DMS</span>
        </div>
      </div>
    </div>
  );
}
