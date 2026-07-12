"""Phase 2 — tests nécessitant un admin : Modules 1(admin), 3(RDV), 5, 6, 7, 8.
Prérequis : admin1@santefacile.test promu admin (une ligne SQL)."""
import sys
from common import rest, rpc, signup_or_signin, check, summary

print("\n########## PHASE 2 — Modules 1(admin), 3(RDV), 5, 6, 7, 8 ##########\n")

tok = {}
uid = {}
for key in ("patient1", "medecin1", "pharma1", "assureur1", "admin1"):
    tok[key], uid[key] = signup_or_signin(key)

# Vérifie que l'admin est bien promu
st, prof = rest("GET", f"/profiles?id=eq.{uid['admin1']}&select=role", token=tok["admin1"])
admin_role = (prof or [{}])[0].get("role") if isinstance(prof, list) else None
if admin_role != "admin":
    print("❌ admin1 n'est pas encore promu 'admin'. Exécutez dans le SQL Editor :")
    print("   update public.profiles set role='admin', is_verified=true "
          "where email='admin1@santefacile.test';")
    sys.exit(2)
check("[M1-ADMIN] admin1 possède le rôle admin", admin_role == "admin")

# ---------------------------------------------------------------
# MODULE 1 (admin) — voir tous les profils + vérifier les pros
# ---------------------------------------------------------------
print("\n--- Module 1 : Espace admin ---")
st, allp = rest("GET", "/profiles?select=id,role,is_verified", token=tok["admin1"])
check("[M1-ADMIN] L'admin lit TOUS les profils (RLS admin)",
      isinstance(allp, list) and len(allp) >= 5, f"{len(allp) if isinstance(allp,list) else '?'} profils")

for key in ("medecin1", "pharma1", "assureur1"):
    st, _ = rest("PATCH", f"/profiles?id=eq.{uid[key]}", token=tok["admin1"],
                 body={"is_verified": True})
    st2, prof = rest("GET", f"/profiles?id=eq.{uid[key]}&select=is_verified", token=tok["admin1"])
    v = (prof or [{}])[0].get("is_verified") if isinstance(prof, list) else None
    check(f"[M1-ADMIN] Admin vérifie {key}", v is True, f"HTTP {st}")

# ---------------------------------------------------------------
# MODULE 3 — le médecin vérifié apparaît + RDV classique
# ---------------------------------------------------------------
print("\n--- Module 3 : Rendez-vous classique ---")
st, docs = rpc("list_verified_doctors", token=tok["patient1"])
check("[M3] Le médecin vérifié apparaît dans list_verified_doctors",
      isinstance(docs, list) and any(d["id"] == uid["medecin1"] for d in docs),
      f"{len(docs) if isinstance(docs,list) else '?'} médecin(s)")

st, appt = rest("POST", "/appointments", token=tok["patient1"],
                body={"patient_id": uid["patient1"], "medecin_id": uid["medecin1"],
                      "patient_name": "Aya Koné", "medecin_name": "Dr Jean Kouassi",
                      "scheduled_at": "2026-07-20T09:00:00Z", "reason": "Consultation de suivi (test)"},
                extra_headers={"Prefer": "return=representation"})
appt_row = (appt or [{}])[0] if isinstance(appt, list) else {}
check("[M3] Patient réserve un RDV avec le médecin", bool(appt_row.get("id")), f"HTTP {st}")
if appt_row.get("id"):
    st, _ = rest("PATCH", f"/appointments?id=eq.{appt_row['id']}", token=tok["medecin1"],
                 body={"status": "confirme"})
    check("[M3] Le médecin confirme le RDV", st in (200, 204))

# ---------------------------------------------------------------
# MODULE 6(fiche) — la pharmacie crée sa fiche géolocalisée
# ---------------------------------------------------------------
print("\n--- Module 6 : Fiche officine + routage ---")
st, ph = rest("POST", "/pharmacies", token=tok["pharma1"],
              body={"owner_profile_id": uid["pharma1"], "name": "Pharmacie de Cocody (test réel)",
                    "address_line": "Bd Latrille", "commune": "Cocody", "city": "Abidjan",
                    "lat": 5.3451, "lng": -3.9881, "phone": "+225270000000", "is_active": True},
              extra_headers={"Prefer": "return=representation,resolution=merge-duplicates"})
ph_row = (ph or [{}])[0] if isinstance(ph, list) else {}
if not ph_row.get("id"):
    st2, ph2 = rest("GET", f"/pharmacies?owner_profile_id=eq.{uid['pharma1']}&select=id", token=tok["pharma1"])
    ph_row = (ph2 or [{}])[0] if isinstance(ph2, list) else {}
check("[M6] La pharmacie crée sa fiche géolocalisée", bool(ph_row.get("id")), f"HTTP {st}")

# la fiche vérifiée apparaît dans la recherche de proximité du patient
st, near = rpc("nearest_pharmacies", token=tok["patient1"], body={"p_lat": 5.3450, "p_lng": -3.9880, "p_limit": 10})
check("[M6] La fiche (compte vérifié) apparaît chez le patient",
      isinstance(near, list) and any(p["id"] == ph_row.get("id") for p in near))

# patient1 choisit cette pharmacie comme préférée → routage e-prescription
rest("PATCH", f"/patient_profiles?id=eq.{uid['patient1']}", token=tok["patient1"],
     body={"preferred_pharmacy_id": ph_row.get("id")})

# ---------------------------------------------------------------
# MODULE 5 — e-prescription (routage auto vers la pharmacie)
# ---------------------------------------------------------------
print("\n--- Module 5 : e-Prescription ---")
st, sel = rpc("select_pharmacy_for_patient", token=tok["medecin1"], body={"p_patient": uid["patient1"]})
sel_row = sel[0] if isinstance(sel, list) and sel else {}
check("[M5] select_pharmacy_for_patient renvoie la pharmacie préférée",
      sel_row.get("pharmacy_id") == ph_row.get("id"), f"→ {sel_row.get('pharmacy_name')}")

st, pres = rest("POST", "/prescriptions", token=tok["medecin1"],
                body={"patient_id": uid["patient1"], "medecin_id": uid["medecin1"],
                      "pharmacy_id": ph_row.get("id"), "patient_name": "Aya Koné",
                      "medecin_name": "Dr Jean Kouassi", "pharmacy_name": sel_row.get("pharmacy_name", ""),
                      "diagnosis": "Paludisme simple (test)"},
                extra_headers={"Prefer": "return=representation"})
pres_row = (pres or [{}])[0] if isinstance(pres, list) else {}
check("[M5] Le médecin vérifié émet une ordonnance", bool(pres_row.get("id")), f"HTTP {st}")

if pres_row.get("id"):
    st, _ = rest("POST", "/prescription_items", token=tok["medecin1"],
                 body=[{"prescription_id": pres_row["id"], "medication_name": "Artéméther-Luméfantrine 80/480",
                        "dosage": "1 comprimé", "frequency": "matin et soir", "duration": "3 jours"},
                       {"prescription_id": pres_row["id"], "medication_name": "Paracétamol 500 mg",
                        "dosage": "1 comprimé", "frequency": "si fièvre", "duration": "5 jours"}])
    check("[M5] Ajout des médicaments à l'ordonnance", st in (200, 201))
    # la pharmacie destinataire voit l'ordonnance
    st, seen = rest("GET", f"/prescriptions?id=eq.{pres_row['id']}&select=id", token=tok["pharma1"])
    check("[M5] La pharmacie destinataire reçoit l'ordonnance (RLS)",
          isinstance(seen, list) and len(seen) == 1)

# Sécurité : un patient ne peut pas émettre d'ordonnance
st, bad = rest("POST", "/prescriptions", token=tok["patient1"],
               body={"patient_id": uid["patient1"], "medecin_id": uid["patient1"], "diagnosis": "fraude"},
               extra_headers={"Prefer": "return=representation"})
check("[M5-SEC] Un patient ne peut PAS émettre d'ordonnance (RLS)", st not in (200, 201), f"HTTP {st}")

# ---------------------------------------------------------------
# MODULE 6/7 — préparation → livraison → suivi
# ---------------------------------------------------------------
print("\n--- Module 6/7 : Commande & livraison ---")
if pres_row.get("id"):
    st, deliv = rest("POST", "/sante_deliveries", token=tok["pharma1"],
                     body={"prescription_id": pres_row["id"], "pharmacy_id": ph_row["id"],
                           "patient_id": uid["patient1"]},
                     extra_headers={"Prefer": "return=representation"})
    deliv_row = (deliv or [{}])[0] if isinstance(deliv, list) else {}
    check("[M7] Pharmacie déclenche la préparation (livraison créée)",
          deliv_row.get("status") == "preparation", f"HTTP {st}")
    rest("PATCH", f"/prescriptions?id=eq.{pres_row['id']}", token=tok["pharma1"],
         body={"status": "en_preparation"})

    if deliv_row.get("id"):
        st, _ = rest("PATCH", f"/sante_deliveries?id=eq.{deliv_row['id']}", token=tok["pharma1"],
                     body={"status": "en_route", "courier_name": "Yao K.", "courier_phone": "+225070000009",
                           "en_route_at": "2026-07-20T10:00:00Z"})
        check("[M7] Passage 'en route' avec livreur", st in (200, 204))
        st, _ = rest("PATCH", f"/sante_deliveries?id=eq.{deliv_row['id']}", token=tok["pharma1"],
                     body={"status": "livre", "delivered_at": "2026-07-20T10:30:00Z"})
        st2, dd = rest("GET", f"/sante_deliveries?id=eq.{deliv_row['id']}&select=status", token=tok["patient1"])
        final = (dd or [{}])[0].get("status") if isinstance(dd, list) else None
        check("[M7] Livraison 'livré' + visible par le patient (suivi temps réel)", final == "livre")

# ---------------------------------------------------------------
# MODULE 8 — assurance : éligibilité, police, prise en charge
# ---------------------------------------------------------------
print("\n--- Module 8 : Assurance ---")
st, found = rpc("find_patient_by_email", token=tok["assureur1"],
                body={"p_email": "patient1@santefacile.test"})
found_row = found[0] if isinstance(found, list) and found else {}
check("[M8] Assureur vérifié trouve le patient par e-mail",
      found_row.get("id") == uid["patient1"], f"→ {found_row.get('full_name')}")

st, pol = rest("POST", "/insurance_policies", token=tok["assureur1"],
               body={"insurer_profile_id": uid["assureur1"], "patient_id": uid["patient1"],
                     "insurer_name": "Mutuelle Santé CI", "patient_name": "Aya Koné",
                     "policy_number": "POL-TEST-001", "coverage_percent": 80, "status": "actif"},
               extra_headers={"Prefer": "return=representation,resolution=merge-duplicates"})
pol_row = (pol or [{}])[0] if isinstance(pol, list) else {}
if not pol_row.get("id"):
    st2, pol2 = rest("GET", f"/insurance_policies?insurer_profile_id=eq.{uid['assureur1']}&select=id", token=tok["assureur1"])
    pol_row = (pol2 or [{}])[0] if isinstance(pol2, list) else {}
check("[M8] Assureur enregistre une police (éligibilité)", bool(pol_row.get("id")), f"HTTP {st}")

# Sécurité : un patient ne crée pas de police (rôle assureur requis)
st, badp = rest("POST", "/insurance_policies", token=tok["patient1"],
                body={"insurer_profile_id": uid["patient1"], "patient_id": uid["patient1"],
                      "policy_number": "FRAUDE", "coverage_percent": 100},
                extra_headers={"Prefer": "return=representation"})
check("[M8-SEC] Un patient ne peut PAS créer de police (RLS)", st not in (200, 201), f"HTTP {st}")

# Le patient demande la prise en charge de son ordonnance
if pres_row.get("id") and pol_row.get("id"):
    st, cov = rest("POST", "/coverage_requests", token=tok["patient1"],
                   body={"prescription_id": pres_row["id"], "policy_id": pol_row["id"],
                         "insurer_profile_id": uid["assureur1"], "patient_id": uid["patient1"],
                         "patient_name": "Aya Koné"},
                   extra_headers={"Prefer": "return=representation"})
    cov_row = (cov or [{}])[0] if isinstance(cov, list) else {}
    check("[M8] Le patient demande la prise en charge", bool(cov_row.get("id")), f"HTTP {st}")

    if cov_row.get("id"):
        # l'assureur consulte l'ordonnance liée (policy RLS étendue)
        st, prescSeen = rest("GET", f"/prescriptions?id=eq.{pres_row['id']}&select=id", token=tok["assureur1"])
        check("[M8] L'assureur consulte l'ordonnance liée à la demande",
              isinstance(prescSeen, list) and len(prescSeen) == 1)
        # décision : prise en charge partielle 70%
        st, _ = rest("PATCH", f"/coverage_requests?id=eq.{cov_row['id']}", token=tok["assureur1"],
                     body={"status": "approuvee_partielle", "covered_percent": 70,
                           "amount_fcfa": 3500, "decided_at": "2026-07-20T11:00:00Z"})
        st2, cc = rest("GET", f"/coverage_requests?id=eq.{cov_row['id']}&select=status,covered_percent", token=tok["patient1"])
        c = (cc or [{}])[0] if isinstance(cc, list) else {}
        check("[M8] Assureur valide (partielle 70%) + visible par le patient",
              c.get("status") == "approuvee_partielle" and c.get("covered_percent") == 70)

ok = summary("PHASE 2")
sys.exit(0 if ok else 1)
