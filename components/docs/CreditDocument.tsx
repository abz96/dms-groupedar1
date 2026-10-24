import type { ReactNode } from "react";
import { annualIncome, maskSin, OPT, optLabel, type CreditData, type Person } from "@/lib/credit";
import { money, type DealerSettings } from "@/lib/deal";

type Lang = "fr" | "en";

/** Printable credit application (2 pages). */
export default function CreditDocument({ data, appNumber, s, lang, status }: { data: CreditData; appNumber: string; s: DealerSettings; lang: Lang; status?: string }) {
  const T = (fr: string, en: string) => (lang === "fr" ? fr : en);
  const loc = lang === "fr" ? "fr-CA" : "en-CA";
  const today = new Date().toLocaleDateString(loc, { year: "numeric", month: "long", day: "numeric" });
  const n = (v: string) => (v && !isNaN(Number(v)) ? money(Number(v)) : v);
  const sheet = { minHeight: "11in", display: "flex", flexDirection: "column" as const, fontSize: 10 };

  const Sec = ({ title, children }: { title: string; children: ReactNode }) => (
    <div style={{ border: "1.5px solid #00263d", marginTop: 7 }}>
      <div style={{ background: "#00263d", color: "#fff", fontWeight: 700, fontSize: 10, padding: "2px 6px", letterSpacing: 0.4 }}>{title}</div>
      <div style={{ padding: "4px 6px" }}>{children}</div>
    </div>
  );
  const Cell = ({ label, value, span = 1 }: { label: string; value?: ReactNode; span?: number }) => (
    <div style={{ gridColumn: `span ${span} / span ${span}`, borderBottom: "1px solid #9fb3c4", minHeight: 26, padding: "1px 2px" }}>
      <div style={{ fontSize: 7.5, color: "#3c5266", textTransform: "uppercase", letterSpacing: 0.3 }}>{label}</div>
      <div style={{ fontSize: 10, fontWeight: 700 }}>{value || "\u00a0"}</div>
    </div>
  );
  const G = ({ cols = 6, children }: { cols?: number; children: ReactNode }) => (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, 1fr)`, columnGap: 8, rowGap: 3 }}>{children}</div>
  );
  const person = (p: Person) => (
    <G>
      <Cell label={T("Titre", "Title")} value={optLabel(OPT.title, p.title, lang)} />
      <Cell label={T("Prénom", "First name")} value={p.firstName} span={2} />
      <Cell label={T("Nom", "Last name")} value={p.lastName} span={2} />
      <Cell label={T("Date de naissance", "Date of birth")} value={p.dob} />
      <Cell label={T("NAS", "SIN")} value={maskSin(p.sin)} />
      <Cell label={T("État civil", "Marital status")} value={optLabel(OPT.marital, p.maritalStatus, lang)} />
      <Cell label={T("Pers. à charge", "Dependents")} value={p.dependents} />
      <Cell label={T("Permis de conduire", "Driver's licence")} value={[p.licenseNo, p.licenseProv].filter(Boolean).join(" · ")} span={3} />
      <Cell label={T("Courriel", "Email")} value={p.email} span={2} />
      <Cell label={T("Cellulaire", "Mobile")} value={p.mobile} />
      <Cell label={T("Tél. maison", "Home phone")} value={p.homePhone} />
      <Cell label={T("Tél. travail", "Work phone")} value={p.workPhone} span={2} />
    </G>
  );
  const address = (p: Person) => (
    <G>
      <Cell label={T("Adresse", "Address")} value={[p.address, p.unit ? `${T("app.", "unit")} ${p.unit}` : ""].filter(Boolean).join(", ")} span={3} />
      <Cell label={T("Ville", "City")} value={p.city} />
      <Cell label={T("Province", "Province")} value={p.province} />
      <Cell label={T("Code postal", "Postal code")} value={p.postal} />
      <Cell label={T("Résidence", "Residence")} value={optLabel(OPT.residence, p.residenceType, lang)} />
      <Cell label={T("Loyer / hypothèque", "Rent / mortgage")} value={p.housingPayment ? `${n(p.housingPayment)} / ${T("mois", "mo")}` : ""} />
      <Cell label={T("Depuis", "Time at address")} value={p.yearsAtAddress || p.monthsAtAddress ? `${p.yearsAtAddress || 0} ${T("an(s)", "yr(s)")} ${p.monthsAtAddress || 0} ${T("mois", "mo")}` : ""} />
      <Cell label={T("Propriétaire / créancier", "Landlord / mortgagee")} value={p.landlord} span={3} />
      <Cell label={T("Adresse précédente", "Previous address")} value={p.prevAddress} span={5} />
      <Cell label={T("Années", "Years")} value={p.prevYears} />
    </G>
  );
  const employment = (p: Person) => (
    <G>
      <Cell label={T("Statut", "Status")} value={optLabel(OPT.employment, p.employmentType, lang)} />
      <Cell label={T("Employeur", "Employer")} value={p.employer} span={3} />
      <Cell label={T("Poste", "Occupation")} value={p.occupation} span={2} />
      <Cell label={T("Adresse de l'employeur", "Employer address")} value={p.employerAddress} span={3} />
      <Cell label={T("Tél. employeur", "Employer phone")} value={p.employerPhone} />
      <Cell label={T("Ancienneté", "Time employed")} value={p.yearsEmployed || p.monthsEmployed ? `${p.yearsEmployed || 0} ${T("an(s)", "yr(s)")} ${p.monthsEmployed || 0} ${T("mois", "mo")}` : ""} span={2} />
      <Cell label={T("Revenu brut", "Gross income")} value={p.grossIncome ? `${n(p.grossIncome)} (${optLabel(OPT.incomeFreq, p.incomeFrequency, lang)})` : ""} span={2} />
      <Cell label={T("Autre revenu / source", "Other income / source")} value={[p.otherIncome ? n(p.otherIncome) : "", p.otherIncomeSource].filter(Boolean).join(" · ")} span={2} />
      <Cell label={T("Revenu annuel total", "Total annual income")} value={annualIncome(p) ? money(annualIncome(p) + (Number(p.otherIncome) || 0)) : ""} span={2} />
      <Cell label={T("Employeur précédent", "Previous employer")} value={p.prevEmployer} span={5} />
      <Cell label={T("Années", "Years")} value={p.prevYearsEmployed} />
    </G>
  );
  const Header = ({ page }: { page: number }) => (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "3px solid #0071bc", paddingBottom: 5 }}>
      <div>
        <div style={{ fontSize: 16, fontWeight: 800, color: "#00263d" }}>{s.dealerName}</div>
        <div style={{ fontSize: 9 }}>{s.legalName} · {s.address}</div>
        <div style={{ fontSize: 8.5, color: "#3c5266" }}>{T("Tél.", "Tel.")} {s.tel}{s.email ? ` · ${s.email}` : ""}</div>
      </div>
      <div style={{ textAlign: "right" }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: "#0071bc" }}>{T("DEMANDE DE CRÉDIT", "CREDIT APPLICATION")}</div>
        <div style={{ fontSize: 9, marginTop: 2 }}>
          {T("N° de demande", "Application #")} <b>{appNumber || "________"}</b>
          {status ? ` · ${optLabel(OPT.status, status, lang)}` : ""}
        </div>
        <div style={{ fontSize: 9 }}>{today} · {T("Page", "Page")} {page} / 2</div>
      </div>
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
    <>
      <div className="sheet shadow-2xl mt-6" style={sheet}>
        <Header page={1} />
        <Sec title={`1. ${T("DEMANDEUR PRINCIPAL", "PRIMARY APPLICANT")}`}>{person(data.applicant)}</Sec>
        <Sec title={`2. ${T("ADRESSE ET LOGEMENT", "ADDRESS & HOUSING")}`}>{address(data.applicant)}</Sec>
        <Sec title={`3. ${T("EMPLOI ET REVENUS", "EMPLOYMENT & INCOME")}`}>{employment(data.applicant)}</Sec>
        <Sec title={`4. ${T("VÉHICULE ET FINANCEMENT DEMANDÉ", "VEHICLE & FINANCING REQUESTED")}`}>
          <G>
            <Cell label={T("Véhicule", "Vehicle")} value={data.vehicle} span={3} />
            <Cell label={T("NIV", "VIN")} value={data.vin} span={2} />
            <Cell label={T("Type", "Type")} value={optLabel(OPT.dealType, data.dealType, lang)} />
            <Cell label={T("Prix de vente", "Selling price")} value={n(data.price)} />
            <Cell label={T("Comptant", "Down payment")} value={n(data.downPayment)} />
            <Cell label={T("Valeur d'échange", "Trade-in value")} value={n(data.tradeIn)} />
            <Cell label={T("Solde dû sur l'échange", "Trade lien")} value={n(data.lienPayout)} />
            <Cell label={T("Taxes", "Taxes")} value={n(data.taxes)} />
            <Cell label={T("Quotation #", "Quotation #")} value={data.quoteNumber} />
            <Cell label={T("Prêteur", "Lender")} value={data.lender} span={2} />
            <Cell label={T("Terme (mois)", "Term (months)")} value={data.termRequested} />
            <Cell label={T("Taux", "Rate")} value={data.rate ? `${data.rate} %` : ""} />
            <Cell label={T("Paiement", "Payment")} value={n(data.payment)} />
            <Cell label={T("MONTANT À FINANCER", "AMOUNT TO FINANCE")} value={n(data.amountRequested)} span={2} />
          </G>
        </Sec>
        <Sec title={`5. ${T("SITUATION FINANCIÈRE", "FINANCIAL INFORMATION")}`}>
          <G>
            <Cell label={T("Institution financière", "Bank")} value={data.bank} span={2} />
            <Cell label={T("Succursale", "Branch")} value={data.bankBranch} />
            <Cell label={T("Type de compte", "Account type")} value={optLabel(OPT.account, data.accountType, lang)} />
            <Cell label={T("Dettes ($/mois)", "Debts ($/month)")} value={n(data.monthlyDebts)} span={2} />
            <Cell label={T("Cartes de crédit (solde)", "Credit cards (balance)")} value={n(data.creditCards)} span={2} />
            <Cell label={T("Autres prêts (solde)", "Other loans (balance)")} value={n(data.otherLoans)} span={2} />
            <Cell label={T("Faillite / proposition", "Bankruptcy / proposal")} value={data.bankruptcy === "yes" ? `${T("Oui", "Yes")} — ${data.bankruptcyDetails}` : T("Non", "No")} span={2} />
          </G>
        </Sec>
        <Sec title={`6. ${T("RÉFÉRENCES PERSONNELLES", "PERSONAL REFERENCES")}`}>
          <G>
            <Cell label={T("Référence 1", "Reference 1")} value={data.ref1Name} span={3} />
            <Cell label={T("Téléphone", "Phone")} value={data.ref1Phone} span={2} />
            <Cell label={T("Lien", "Relationship")} value={data.ref1Relation} />
            <Cell label={T("Référence 2", "Reference 2")} value={data.ref2Name} span={3} />
            <Cell label={T("Téléphone", "Phone")} value={data.ref2Phone} span={2} />
            <Cell label={T("Lien", "Relationship")} value={data.ref2Relation} />
          </G>
        </Sec>
        <div style={{ marginTop: "auto", paddingTop: 6, fontSize: 8, color: "#3c5266", display: "flex", justifyContent: "space-between" }}>
          <span>{T("Initiales du demandeur", "Applicant initials")} <span style={{ display: "inline-block", width: 46, height: 16, border: "1px solid #000", verticalAlign: "middle", marginLeft: 6 }} /></span>
          <span>{appNumber} · Groupe Dar DMS</span>
        </div>
      </div>

      <div className="sheet shadow-2xl mt-6" style={sheet}>
        <Header page={2} />
        <Sec title={`7. ${T("CO-DEMANDEUR", "CO-APPLICANT")}${data.hasCoApplicant && data.coRelation ? ` — ${data.coRelation}` : ""}`}>
          {data.hasCoApplicant ? (
            <>
              {person(data.coApplicant)}
              <div style={{ height: 4 }} />
              {address(data.coApplicant)}
              <div style={{ height: 4 }} />
              {employment(data.coApplicant)}
            </>
          ) : (
            <div style={{ fontSize: 9.5, color: "#3c5266", padding: "4px 0" }}>{T("Aucun co-demandeur.", "No co-applicant.")}</div>
          )}
        </Sec>
        <Sec title={`8. ${T("AUTORISATION ET CONSENTEMENT", "AUTHORIZATION & CONSENT")}`}>
          <div style={{ fontSize: 8.6, lineHeight: 1.35 }}>
            <p style={{ margin: "0 0 4px" }}>
              {T(
                "Je certifie que les renseignements fournis dans la présente demande sont exacts et complets. J'autorise le commerçant, ses prêteurs et leurs cessionnaires à obtenir mon dossier de crédit auprès d'agences d'évaluation du crédit (Equifax, TransUnion), à vérifier mon emploi, mes revenus et mes références, et à échanger ces renseignements entre eux aux fins de l'évaluation, de l'octroi et de la gestion du crédit demandé.",
                "I certify that the information provided in this application is true and complete. I authorize the dealer, its lenders and their assignees to obtain my credit report from credit reporting agencies (Equifax, TransUnion), to verify my employment, income and references, and to exchange this information among themselves for the purpose of evaluating, granting and administering the credit requested.",
              )}
            </p>
            <p style={{ margin: "0 0 4px" }}>
              {T(
                "Ces renseignements seront conservés pendant la durée de la relation d'affaires et selon les exigences légales, conformément à la Loi sur la protection des renseignements personnels dans le secteur privé (Québec). Je peux en demander l'accès ou la rectification par écrit.",
                "This information will be retained for the duration of the business relationship and as required by law, in accordance with applicable privacy legislation. I may request access to or correction of it in writing.",
              )}
            </p>
            <p style={{ margin: 0 }}>
              {T("Consentement obtenu le", "Consent obtained on")} : <b>{data.consent ? data.consentDate || today : "____ / ____ / ________"}</b>
            </p>
          </div>
        </Sec>
        <Sec title={`9. ${T("DOCUMENTS À FOURNIR", "SUPPORTING DOCUMENTS")}`}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2, fontSize: 9 }}>
            {[
              T("Permis de conduire valide", "Valid driver's licence"),
              T("2 talons de paie récents", "2 recent pay stubs"),
              T("Lettre d'emploi", "Employment letter"),
              T("Avis de cotisation (travailleur autonome)", "Notice of assessment (self-employed)"),
              T("Spécimen de chèque", "Void cheque"),
              T("Preuve de résidence (facture)", "Proof of address (utility bill)"),
              T("Preuve d'assurance automobile", "Proof of auto insurance"),
              T("Relevé de paiement du véhicule d'échange", "Trade-in payout statement"),
            ].map((x) => (
              <div key={x}>☐ {x}</div>
            ))}
          </div>
        </Sec>
        {data.notes && (
          <Sec title={`10. ${T("NOTES", "NOTES")}`}>
            <div style={{ fontSize: 9.5, whiteSpace: "pre-wrap" }}>{data.notes}</div>
          </Sec>
        )}
        <Sec title={T("SIGNATURES", "SIGNATURES")}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
            <Sig label={`${T("Demandeur", "Applicant")} — ${`${data.applicant.firstName} ${data.applicant.lastName}`.trim()}`} />
            <Sig label={`${T("Co-demandeur", "Co-applicant")}${data.hasCoApplicant ? ` — ${`${data.coApplicant.firstName} ${data.coApplicant.lastName}`.trim()}` : ""}`} />
            <Sig label={T("Représentant du commerçant", "Dealer representative")} />
            <Sig label={T("Directeur F&A", "F&I manager")} />
          </div>
        </Sec>
        <div style={{ marginTop: "auto", paddingTop: 6, fontSize: 8, color: "#3c5266", textAlign: "right" }}>{appNumber} · Groupe Dar DMS</div>
      </div>
    </>
  );
}
