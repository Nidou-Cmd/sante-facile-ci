# FUNDING DOSSIER — SANTÉ FACILE
### Telemedicine · e-Prescription · Pharmacy delivery · Insurance — Côte d'Ivoire
*Version 1.0 — 14 July 2026 — English master document for international grants & accelerators (Fuzé / i3 / Tony Elumelu / GSMA / Villgro)*

---

## ⚠️ HOW TO USE (read before submitting)

1. **No dossier can "guarantee" a grant** — juries decide. This document brings you to the **standard of the most demanding funders**; the winning play is **targeted volume**: apply to 5-8 well-matched programs (see §14 in the French master).
2. **[TO COMPLETE]** fields are personal (identity, legal entity, CV). A generic file is spotted instantly.
3. Figures marked **(assumption)** are reasoned estimates — validate with an accountant before any bank submission.
4. Match the executive summary to each funder's language: "health equity / access to care" (i3, ODESS), "digital innovation & jobs" (Fuzé, GSMA), "African founder impact" (TEF).
5. Recommended sequence: **incorporate + apply for the Ivorian Startup Act label first** (credibility + tax exemptions), then grants, then bank credit after first revenue.

---

## 1. EXECUTIVE SUMMARY (1 page — adapt per funder)

**Santé Facile** is an Ivorian digital health platform that brings **the doctor and the pharmacy to the patient**: video teleconsultation, a priority emergency button, an electronic prescription automatically routed to the nearest partner pharmacy, real-time medicine delivery tracking, and integrated insurance coverage — all in a single French-language app built for mobile and low-bandwidth conditions.

**The problem.** Côte d'Ivoire has roughly **1 doctor per 5,700 people**, with about 43% of health resources concentrated in Abidjan (to be confirmed with latest Ministry data). Seeing a doctor often means hours of travel and waiting; self-medication is widespread; over 21 million people are enrolled in universal health coverage (CMU) yet fewer than 4% actively used their card in 2025 — the missing link is a **simple, trusted access channel**.

**The solution — already built.** Unlike most applications stuck at "idea" stage, Santé Facile is **100% developed and tested**: 11 functional modules, 5 user roles, health-grade security (strict per-role data isolation, medical documents encrypted in transit with signed, expiring access), **80 automated checks passing** on real infrastructure, version-controlled and auditable source code. The product can onboard its first users **today**.

**Business model.** Free for patients at sign-up (adoption first), revenue from **commission on validated transactions** (pharmacies, insurers), then B2B2C offerings (employers, mutuals). Mobile money (Wave, Orange Money, MTN) integrated during the pilot.

**The ask.** **[AMOUNT per funder]** to finance a 12-month pilot in Abidjan and secondary cities: 2-3 partner pharmacies and 1 insurer, 5 verified doctors, legal compliance (lawyer, data authority ARTCI), mobile money integration, and acquisition of the first 2,000 patients.

**Impact.** Care access without travel (SDG 3), digital and delivery jobs for youth (SDG 8), health-system digitalization (SDG 9) — with measurable indicators from the pilot (§8).

---

## 2. PROJECT IDENTITY

| Item | Value |
|---|---|
| Trade name | Santé Facile |
| Tagline | "The doctor and the pharmacy come to you — never wait in line again" |
| Founder | **[TO COMPLETE: name, DOB, nationality]** |
| Contact | **[TO COMPLETE: phone, email]** — code repository: github.com/Nidou-Cmd/sante-facile-ci (private; jury access on request) |
| Legal entity | **[TO COMPLETE — recommended: Ivorian LLC (SARL/SAS), CEPICI registration]** |
| Registration (RCCM) | **[TO COMPLETE after incorporation]** |
| Head office | **[TO COMPLETE — Abidjan]** |
| Stage | Product finished and tested; pre-commercial launch (pilot to be financed) |
| Sector | Digital health (telemedicine, pharma-tech, insur-tech) |
| Target label | Ivorian "Startup" label → 3-year tax exemptions |

> ✅ **Key jury differentiator #1: the product exists.** Most applications fund development yet to come; Santé Facile requests **deployment** funding, de-risking the use of funds.

---

## 3. THE PROBLEM (sources to re-verify before submission)

1. **Medical deserts** — ~1 doctor per 5,700 people; resources concentrated in Abidjan; in peri-urban and secondary cities a consultation costs a full day of travel and waiting.
2. **CMU paradox** — mass enrollment (>21M) but very low real usage (<4% in 2025): the system needs trusted channels that "bring" care to users.
3. **Self-medication & informal circuits** — a large share of medicine purchases happen without a prescription (regional studies ~25%), with major health risks.
4. **Pharmacy friction** — finding the on-duty pharmacy, checking stock, travelling there; the cultural "pharmacie de garde" reflex is strong but not digitized.
5. **Underused insurance** — policyholders often ignore their rights; paper processes discourage claims.

**Opportunity window** — near-universal mobile money (Wave dominant), a supportive National Telemedicine Plan (2021) *(exact scope to be validated by counsel)*, and no competitor integrating **consultation + pharmacy + delivery + insurance** in a single journey.

## 4. THE SOLUTION — PRODUCT ALREADY BUILT & TESTED

**6-step patient journey**: free sign-up → address & GPS → video consultation (or 🚨 priority emergency taken by the first available doctor) → e-prescription **automatically** sent to the nearest pharmacy (distance computed in-database) → live delivery tracking (preparing → en route → delivered, named courier) → one-tap insurance claim.

**11 delivered modules**: 5-role authentication · geolocated profile + preferred pharmacy · booking & real-time emergency queue · embedded video · e-prescription · pharmacy dashboard (orders + stock) · real-time delivery · insurer workspace (eligibility, coverage, reimbursements) · secure medical messaging + documents · FR assistance chatbot · full admin with **system settings editable without a developer** (emergency numbers, fees, legal texts, mobile money).

**Verifiable technical proof (Annex A)**:
- **80 automated checks passing** on real infrastructure (role sign-ups, anti-fraud security, proximity calculation accurate to ~100 m, order→delivery chain, full insurance cycle, notifications).
- Health-grade security: strict per-role isolation (RLS), professional accounts verified by admin before visibility, private medical documents via signed expiring links, timestamped consent, emergency fallback surfacing rescue numbers (SAMU 185) after 4 minutes without a doctor.
- Data-light: ~115 KB compressed first load, basic offline mode, built for entry-level Android on 3G.
- Near-zero infrastructure cost at launch (serverless): funds go to **the field**, not servers.

## 5. MARKET & COMPETITION

**Primary market**: Greater Abidjan (~6M) then secondary cities (Bouaké, San-Pedro, Korhogo). Year-1 targets: connected urban patients with remote dependents; employers (staff health); ~1,400 pharmacies nationwide *(to confirm)*; private insurers and mutuals (NSIA, SanlamAllianz, MUGEF-CI, SUNU).

**Competition** (analyzed July 2026): Umed/ADES, Medico, Orange Santé/DabaDoc, Docteur à Domicile, Hayadoc. **Differentiation**: (1) only integrated consultation→pharmacy→delivery→insurance journey; (2) focus on **underserved zones / peripheries** rather than saturated central Abidjan; (3) "insurer/CMU interface" architecture ready (email eligibility check already working).

**Regional expansion**: multi-country architecture ready (emergency numbers, legal texts and settings editable per country in-database) — Senegal, Burkina Faso, Benin in phase 3.

## 6. BUSINESS MODEL

| Stream | Mechanism | When |
|---|---|---|
| Pharmacy commission | % on each prescription delivered via the platform (rate configurable, 2% default — to negotiate) | Pilot |
| Insurer commission / fee | % or fee per digitally validated coverage | Pilot |
| Premium consultation | Share of paid consultations (doctor sets the fee) | Pilot+ |
| B2B2C employers / NGOs | Staff-health subscription | Year 2 |
| Never | Data sales, targeted health advertising | — |

Collection via mobile money (Wave first, then Orange Money / MTN MoMo). Patients never pay for sign-up or basic matching (adoption first — the CMU-paradox lesson).

## 7. TRACTION & MILESTONES (full honesty)

| Done to date ✅ | To be financed 🎯 |
|---|---|
| Complete product (11 modules) | Incorporation + Startup Act label |
| 80 automated checks passing on real infra | Compliance: health/ARTCI counsel, validated T&Cs |
| Production database deployed & operational | 2-3 pharmacies + 1 insurer + 5 doctors signed |
| Documented market/competition analysis | Wave/OM/MTN payment integration |
| P0→P3 roadmap & pilot plan written | First 2,000 patients (field + digital) |
| Private, auditable code repository | 12 months of measured pilot operations |

## 8. SOCIAL IMPACT & KPIs (grant language)

- **SDG 3 (health)**: time-to-doctor cut from hours to <15 minutes; continuity of care for chronic patients; safe emergency triage (integrated rescue numbers).
- **SDG 8 (jobs)**: direct jobs (team), indirect (partner couriers, ~1 per active pharmacy), extra income for doctors and pharmacies.
- **SDG 9 / 5**: digitization of an essential service; easier access to care for women (discreet at-home consultations).

**Pilot KPIs (measured by the platform itself)**: % emergencies taken <4 min · % prescriptions delivered <24 h · consultations/month · active patients · NPS · share of women users · districts covered.

## 9. TEAM

| Role | Name | Profile |
|---|---|---|
| Founder / CEO | **[TO COMPLETE]** | **[TO COMPLETE: background, link to health/tech — 5 lines on WHY you]** |
| Medical advisor | **[TO RECRUIT — doctor registered with the Medical Board; essential credibility for any health file]** | |
| Pilot operations lead | **[TO RECRUIT via funding]** | |
| Product/engineering | Delivered (product shipped); maintenance outsourced at controlled cost | |

> Jury tip: one letter of support from a doctor, a pharmacy or a mutual is worth more than 10 pages of business plan. Target before submission: **2 letters of intent** (template in the French master, Annex E).

## 10. 18-MONTH OPERATING PLAN

| Quarter | Objectives |
|---|---|
| Q1 | Incorporation, Startup Act label, counsel (T&Cs/ARTCI/PNT), Wave Business account, 2 letters of intent |
| Q2 | Sign 2-3 pharmacies + 5 doctors + 1 insurer; payment integration; purge test data; closed pilot (500 patients) |
| Q3 | Open pilot in peri-urban Abidjan (2,000 patients); measure KPIs; product tuning |
| Q4 | Extend to secondary cities; apply to ODESS / HealthTech Hub (traction acquired); first recurring revenue |
| Q5-Q6 | B2B2C employers; CMU/CNAM discussions; prepare raise or SGPME-guaranteed bank credit |

## 11. 3-YEAR FINANCIAL PROJECTIONS (explicit assumptions — refine with an accountant)

**Assumptions (all adjustable)**: avg prescription basket 8,000 XOF (assumption); negotiated commission 5% (assumption — 2% default configured); premium consultation 3,000 XOF of which 500 to platform (assumption); patient growth 2,000 (Y1) → 12,000 (Y2) → 40,000 (Y3); delivered prescriptions per active patient/month: 0.4.

| XOF | Year 1 (pilot) | Year 2 | Year 3 |
|---|---|---|---|
| Active patients (end) | 2,000 | 12,000 | 40,000 |
| Prescriptions delivered | ~4,800 | ~40,000 | ~150,000 |
| Pharmacy commission revenue | ~1.9M | ~16M | ~60M |
| Consultation revenue | ~1.2M | ~10M | ~35M |
| Insurer / B2B revenue | 0.5M | 8M | 30M |
| **Total revenue** | **~3.6M** | **~34M** | **~125M** |
| Costs (team, field, marketing, infra, legal) | ~24M | ~40M | ~75M |
| **Result** | **-20.4M** | **-6M** | **+50M** |

*(1 EUR ≈ 656 XOF, fixed peg. 25M XOF ≈ €38,000 ≈ $41,000 — verify FX at submission.)*
**Break-even: during Year 3** (median assumptions). Requested non-dilutive funding covers the Year 1-2 trough — precisely its purpose.

## 12. FUNDING REQUEST & USE OF FUNDS

**Reference scenario: 25,000,000 XOF (~€38,000 / ~$41,000)** — the detailed 24-month, 3-scenario cash-flow plan mobilizes 40.5M XOF in total (personal contribution + sequenced grants), including a 1.5M XOF prudence reserve validated by stress test (see `PLAN-TRESORERIE-24-MOIS.md`) — adjustable per funder:

| Line | Amount (XOF) | % |
|---|---|---|
| Pilot team (2 people × 12 months: ops + field) | 9.0M | 36% |
| Legal compliance (health counsel, ARTCI, partner contracts) | 3.0M | 12% |
| Mobile money integration + dedicated video server | 3.5M | 14% |
| Patient acquisition & field activation (peripheries, pharmacies) | 5.5M | 22% |
| Pilot partner incentives (doctors, pharmacy training) | 2.5M | 10% |
| Infrastructure, tools, contingency (10%) | 1.5M | 6% |

Variants: **funder ≤ 10M XOF** (FONSTI, TEF) → prioritize compliance + payment + one-district mini-pilot. **Funder ≥ 30M** (Boost Capital, Fuzé, i3) → full scenario + secondary cities from Q3.

## 13. RISKS & MITIGATION

| Risk | Mitigation |
|---|---|
| Regulatory (telemedicine, e-prescription) | Counsel from Q1; product designed "compliance-first" (consent, emergencies, traceability); early dialogue with Ministry/Boards |
| Slow adoption (CMU paradox) | Free for patients, physical presence in partner pharmacies, WhatsApp, built-in trust onboarding |
| Funded competition (Orange, etc.) | Integrated pharmacy+insurance journey + underserved zones; speed (product already built) |
| Partner dependency | "Pluggable" architecture: adding a pharmacy = 1 record; no single point of failure |
| Cash flow | Non-dilutive funding first; minimal fixed costs (near-free infra) |

## 14. INTERNATIONAL FUNDERS SHORTLIST (matched to this project)

- **Fuzé (Digital Africa / AFD)** — €20k-100k, tech startup <18 months, African founder. **Apply now** (age window). digital-africa.co/fuze
- **i3 – Investing in Innovation** — $50k (early) to $225k (growth), African healthtech with a validated solution, African-owned. i3africa.org — *your exact profile.*
- **Tony Elumelu Foundation** — seed grant + training + mentorship, African entrepreneur, 0-3-year venture; opens January. tonyelumelufoundation.org
- **ODESS Prize (Fondation Pierre Fabre)** — e-health in the Global South, **pilot stage minimum**; apply Oct-Nov after pilot launch. odess.io
- **HealthTech Hub Africa (Novartis Foundation)** — post-revenue healthtech, public-sector link; annual cohorts. thehealthtech.org
- **Villgro Africa / GSMA Innovation Fund** — early-stage health / mobile-for-impact; watch for calls.

Amounts and deadlines are sourced but **re-verify on each official website at submission time**.

## 15. ANNEX — INTERNATIONAL SUBMISSION CHECKLIST

Common pack (prepare once): founder ID · 1-page CV · product screenshots · **2-min demo video (strongly recommended)** · 10-slide pitch deck (EN) · this dossier · professional bank details · [after incorporation] registration certificate, tax & social-security attestations.

International-specific: English executive summary & deck (this document + the deck) · cap table (African founder majority) · metrics in USD/EUR · light data room (GitHub access + test report) · clear articulation of impact and unit economics · references / letters of intent.

Jury Q&A: *"What if Orange copies you?"* → our edge is the integrated journey through delivery and insurance, plus zones they don't prioritize; we complement operators (mobile money). *"Why you?"* → **[personal answer TO COMPLETE — decisive]**. *"Regulatory?"* → compliance-first product, Q1 legal budget, no real consultation before validation. *"Your numbers?"* → assumptions shown, model configurable; the pilot exists precisely to validate them.

---
*Prepared 14/07/2026. Market & funder sources: documented research (Agence Emploi Jeunes, FONSTI, Orange POESAM, Digital Africa, i3, Fondation Pierre Fabre, SGPME, CI banking guides 2026). Re-verify every amount and deadline on the official site before applying. No content herein constitutes legal or medical advice.*
