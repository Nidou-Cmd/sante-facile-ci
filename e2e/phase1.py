"""Phase 1 — tests ne nécessitant PAS d'admin : Modules 1, 2, 3(urgence), 9, 10 + sécurité RLS."""
import sys
from common import auth, rest, rpc, signup_or_signin, check, summary, USERS

print("\n########## PHASE 1 — Modules 1, 2, 3(urgence), 9, 10 + sécurité ##########\n")

# ---------------------------------------------------------------
# MODULE 1 — Authentification multi-rôles + création de profil
# ---------------------------------------------------------------
print("--- Module 1 : Auth multi-rôles ---")
tokens = {}
uids = {}
for key in USERS:
    tok, uid = signup_or_signin(key)
    tokens[key] = tok
    uids[key] = uid

for key, u in USERS.items():
    st, data = rest("GET", f"/profiles?id=eq.{uids[key]}&select=role,is_verified,full_name", token=tokens[key])
    row = (data or [{}])[0] if isinstance(data, list) else {}
    expected_role = u["role"]
    check(f"[M1] Profil créé pour {key} avec rôle '{expected_role}'",
          row.get("role") == expected_role, f"rôle obtenu={row.get('role')}")
    if expected_role == "patient":
        check(f"[M1] {key} (patient) vérifié automatiquement", row.get("is_verified") is True)
    else:
        check(f"[M1] {key} ({expected_role}) NON vérifié à l'inscription",
              row.get("is_verified") is False, "attend validation admin")

# Sécurité : inscription avec role=admin doit retomber sur patient
st, data = auth("POST", "/signup", body={
    "email": "pirate.admin@santefacile.test", "password": "SanteFacile2026!",
    "data": {"full_name": "Pirate", "role": "admin"}})
pirate_tok = data.get("access_token") if data else None
if pirate_tok:
    st2, prof = rest("GET", "/profiles?email=eq.pirate.admin@santefacile.test&select=role", token=pirate_tok)
    got = (prof or [{}])[0].get("role") if isinstance(prof, list) else None
    check("[M1-SEC] Auto-inscription 'admin' bloquée (retombe sur patient)", got == "patient",
          f"rôle obtenu={got}")
else:
    check("[M1-SEC] Auto-inscription 'admin' bloquée", False, "compte non créé, test ignoré")

# Sécurité : anti-escalade (patient tente de se passer admin)
st, data = rest("PATCH", f"/profiles?id=eq.{uids['patient1']}",
                token=tokens["patient1"], body={"role": "admin"},
                extra_headers={"Prefer": "return=representation"})
st2, prof = rest("GET", f"/profiles?id=eq.{uids['patient1']}&select=role", token=tokens["patient1"])
still = (prof or [{}])[0].get("role") if isinstance(prof, list) else None
check("[M1-SEC] Anti-escalade : patient ne peut pas devenir admin", still == "patient",
      f"HTTP {st}, rôle final={still}")

# Sécurité RLS : patient1 ne voit pas le profil de patient2
st, data = rest("GET", f"/profiles?id=eq.{uids['patient2']}&select=id", token=tokens["patient1"])
check("[M1-SEC] RLS : patient1 ne lit pas le profil de patient2",
      isinstance(data, list) and len(data) == 0, f"lignes renvoyées={len(data) if isinstance(data,list) else '?'}")

# ---------------------------------------------------------------
# MODULE 2 — Géolocalisation + pharmacie la plus proche
# ---------------------------------------------------------------
print("\n--- Module 2 : Géolocalisation & proximité ---")
# patient1 à Cocody (proche de la pharmacie fictive de Cocody)
st, data = rest("POST", "/patient_profiles", token=tokens["patient1"],
                body={"id": uids["patient1"], "address_line": "Rue des Jardins, Deux-Plateaux",
                      "commune": "Cocody", "city": "Abidjan", "lat": 5.3450, "lng": -3.9880},
                extra_headers={"Prefer": "resolution=merge-duplicates"})
check("[M2] Enregistrement du profil patient géolocalisé", st in (200, 201), f"HTTP {st}")

st, near = rpc("nearest_pharmacies", token=tokens["patient1"],
               body={"p_lat": 5.3450, "p_lng": -3.9880, "p_limit": 5})
ok_list = isinstance(near, list) and len(near) >= 5
check("[M2] nearest_pharmacies renvoie les pharmacies de test", ok_list,
      f"{len(near) if isinstance(near,list) else near} résultats")
if ok_list:
    first = near[0]
    check("[M2] La plus proche = Cocody (tri Haversine correct)",
          "Cocody" in first["name"], f"1re={first['name']} à {first['distance_km']} km")
    dists = [p["distance_km"] for p in near]
    check("[M2] Distances triées par ordre croissant", dists == sorted(dists), f"{dists}")
    # choix pharmacie préférée
    st, _ = rest("PATCH", f"/patient_profiles?id=eq.{uids['patient1']}", token=tokens["patient1"],
                 body={"preferred_pharmacy_id": first["id"]})
    st2, prof = rest("GET", f"/patient_profiles?id=eq.{uids['patient1']}&select=preferred_pharmacy_id",
                     token=tokens["patient1"])
    pref = (prof or [{}])[0].get("preferred_pharmacy_id") if isinstance(prof, list) else None
    check("[M2] Pharmacie préférée enregistrée", pref == first["id"])

# patient2 à Yopougon → la plus proche doit être Yopougon
st, _ = rest("POST", "/patient_profiles", token=tokens["patient2"],
             body={"id": uids["patient2"], "address_line": "Rue Principale", "commune": "Yopougon",
                   "lat": 5.3360, "lng": -4.0890},
             extra_headers={"Prefer": "resolution=merge-duplicates"})
st, near2 = rpc("nearest_pharmacies", token=tokens["patient2"],
                body={"p_lat": 5.3360, "p_lng": -4.0890, "p_limit": 1})
check("[M2] Proximité correcte pour un 2e point (Yopougon)",
      isinstance(near2, list) and near2 and "Yopougon" in near2[0]["name"],
      f"1re={near2[0]['name'] if isinstance(near2,list) and near2 else '?'}")

# ---------------------------------------------------------------
# MODULE 3 (partie urgence, sans admin) — file de priorité
# ---------------------------------------------------------------
print("\n--- Module 3 : Urgence (file de priorité) ---")
st, data = rest("POST", "/appointments", token=tokens["patient1"],
                body={"patient_id": uids["patient1"], "patient_name": "Aya Koné",
                      "is_emergency": True, "reason": "Douleur thoracique (test)"},
                extra_headers={"Prefer": "return=representation"})
emergency = (data or [{}])[0] if isinstance(data, list) else {}
check("[M3] Patient crée une urgence", st in (200, 201) and emergency.get("id"), f"HTTP {st}")

# Le médecin (même non vérifié) voit l'urgence non assignée
st, seen = rest("GET", "/appointments?is_emergency=eq.true&medecin_id=is.null&status=eq.en_attente&select=id",
                token=tokens["medecin1"])
check("[M3] Le médecin voit l'urgence dans la file",
      isinstance(seen, list) and any(a["id"] == emergency.get("id") for a in seen))

# Prise en charge (anti-course : filtre medecin_id is null)
if emergency.get("id"):
    st, claimed = rest(
        "PATCH",
        f"/appointments?id=eq.{emergency['id']}&medecin_id=is.null",
        token=tokens["medecin1"],
        body={"medecin_id": uids["medecin1"], "medecin_name": "Dr Jean Kouassi", "status": "confirme"},
        extra_headers={"Prefer": "return=representation"})
    check("[M3] Médecin prend en charge l'urgence (anti-course)",
          isinstance(claimed, list) and len(claimed) == 1 and claimed[0]["medecin_id"] == uids["medecin1"],
          f"HTTP {st}")
    # room_code présent pour la vidéo (Module 4)
    check("[M4] Salle de consultation (room_code) générée",
          isinstance(claimed, list) and claimed and claimed[0].get("room_code"))

# ---------------------------------------------------------------
# MODULE 9 — Messagerie patient ↔ médecin
# ---------------------------------------------------------------
print("\n--- Module 9 : Messagerie ---")
st, conv = rest("POST", "/conversations", token=tokens["patient1"],
                body={"patient_id": uids["patient1"], "medecin_id": uids["medecin1"],
                      "patient_name": "Aya Koné", "medecin_name": "Dr Jean Kouassi"},
                extra_headers={"Prefer": "return=representation,resolution=merge-duplicates"})
conv_row = (conv or [{}])[0] if isinstance(conv, list) else {}
check("[M9] Création d'une conversation patient↔médecin", st in (200, 201) and conv_row.get("id"), f"HTTP {st}")
if conv_row.get("id"):
    st, msg = rest("POST", "/messages", token=tokens["patient1"],
                   body={"conversation_id": conv_row["id"], "sender_id": uids["patient1"],
                         "content": "Bonjour docteur, message de test."},
                   extra_headers={"Prefer": "return=representation"})
    check("[M9] Envoi d'un message", st in (200, 201))
    # le médecin lit le message
    st, msgs = rest("GET", f"/messages?conversation_id=eq.{conv_row['id']}&select=content", token=tokens["medecin1"])
    check("[M9] Le médecin lit le message (RLS participants)",
          isinstance(msgs, list) and any("test" in m["content"] for m in msgs))
    # un tiers (patient2) ne voit pas la conversation
    st, other = rest("GET", f"/messages?conversation_id=eq.{conv_row['id']}&select=id", token=tokens["patient2"])
    check("[M9-SEC] Un tiers ne lit pas la conversation (RLS)",
          isinstance(other, list) and len(other) == 0)

print("\n>>> UIDs de test (à conserver) :")
for k, v in uids.items():
    print(f"    {k}: {v}  ({USERS[k]['email']})")

ok = summary("PHASE 1")
sys.exit(0 if ok else 1)
