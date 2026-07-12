"""Phase 3 — tests P0 : consentement CGU horodaté + notifications automatiques.
Prérequis : migration 009_p0_confiance_notifications.sql exécutée."""
import sys
import time
from common import auth, rest, signup_or_signin, check, summary, USERS, PASSWORD

print("\n########## PHASE 3 — P0 : consentement + notifications ##########\n")

tok = {}
uid = {}
for key in ("patient1", "medecin1"):
    tok[key], uid[key] = signup_or_signin(key)

# ---------------------------------------------------------------
# P0-1 : consentement CGU horodaté à l'inscription
# ---------------------------------------------------------------
consent_iso = "2026-07-12T15:00:00.000Z"
st, data = auth("POST", "/signup", body={
    "email": "consent.test@santefacile.test", "password": PASSWORD,
    "data": {"full_name": "Test Consentement", "role": "patient",
             "accepted_terms_at": consent_iso},
})
ctok = data.get("access_token") if data else None
if ctok:
    st2, prof = rest("GET", "/profiles?email=eq.consent.test@santefacile.test&select=accepted_terms_at",
                     token=ctok)
    val = (prof or [{}])[0].get("accepted_terms_at") if isinstance(prof, list) else None
    check("[P0] Consentement CGU horodaté enregistré à l'inscription",
          val is not None and val.startswith("2026-07-12"), f"valeur={val}")
else:
    # compte déjà créé lors d'un test précédent → vérifier la colonne existe
    st2, prof = rest("GET", f"/profiles?id=eq.{uid['patient1']}&select=accepted_terms_at", token=tok["patient1"])
    check("[P0] Colonne accepted_terms_at accessible", st2 == 200, f"HTTP {st2}")

def unread_titles(user_key):
    st, rows = rest("GET", "/sante_notifications?select=title,is_read&order=created_at.desc&limit=10",
                    token=tok[user_key])
    return [r["title"] for r in rows] if isinstance(rows, list) else []

# ---------------------------------------------------------------
# P0-2 : notification au médecin sur nouvelle demande de RDV
# ---------------------------------------------------------------
st, appt = rest("POST", "/appointments", token=tok["patient1"],
                body={"patient_id": uid["patient1"], "medecin_id": uid["medecin1"],
                      "patient_name": "Aya Koné", "medecin_name": "Dr Jean Kouassi",
                      "scheduled_at": "2026-07-25T09:00:00Z", "reason": "Test notifications"},
                extra_headers={"Prefer": "return=representation"})
appt_row = (appt or [{}])[0] if isinstance(appt, list) else {}
check("[P0] RDV de test créé", bool(appt_row.get("id")), f"HTTP {st}")
time.sleep(1)
titles_med = unread_titles("medecin1")
check("[P0] 🔔 Médecin notifié de la nouvelle demande de RDV",
      any("Nouvelle demande" in t for t in titles_med), f"titres={titles_med[:3]}")

# ---------------------------------------------------------------
# P0-3 : notification au patient sur confirmation
# ---------------------------------------------------------------
if appt_row.get("id"):
    rest("PATCH", f"/appointments?id=eq.{appt_row['id']}", token=tok["medecin1"], body={"status": "confirme"})
    time.sleep(1)
    titles_pat = unread_titles("patient1")
    check("[P0] 🔔 Patient notifié de la confirmation du RDV",
          any("confirmé" in t or "confirme" in t for t in titles_pat), f"titres={titles_pat[:3]}")

# ---------------------------------------------------------------
# P0-4 : notification sur nouveau message
# ---------------------------------------------------------------
st, conv = rest("POST", "/conversations", token=tok["patient1"],
                body={"patient_id": uid["patient1"], "medecin_id": uid["medecin1"],
                      "patient_name": "Aya Koné", "medecin_name": "Dr Jean Kouassi"},
                extra_headers={"Prefer": "return=representation,resolution=merge-duplicates"})
conv_row = (conv or [{}])[0] if isinstance(conv, list) else {}
if conv_row.get("id"):
    rest("POST", "/messages", token=tok["medecin1"],
         body={"conversation_id": conv_row["id"], "sender_id": uid["medecin1"],
               "content": "Message test notification"})
    time.sleep(1)
    titles_pat = unread_titles("patient1")
    check("[P0] 🔔 Patient notifié d'un nouveau message",
          any("message" in t.lower() for t in titles_pat), f"titres={titles_pat[:3]}")

# ---------------------------------------------------------------
# P0-5 : RLS — un utilisateur ne voit pas les notifications d'un autre
# ---------------------------------------------------------------
st, cross = rest("GET", f"/sante_notifications?user_id=eq.{uid['medecin1']}&select=id", token=tok["patient1"])
check("[P0-SEC] RLS notifications : pas d'accès croisé",
      isinstance(cross, list) and len(cross) == 0)

# ---------------------------------------------------------------
# P0-6 : marquer comme lues
# ---------------------------------------------------------------
st, _ = rest("PATCH", f"/sante_notifications?user_id=eq.{uid['patient1']}&is_read=eq.false",
             token=tok["patient1"], body={"is_read": True})
check("[P0] Marquage 'lu' de ses propres notifications", st in (200, 204), f"HTTP {st}")

ok = summary("PHASE 3")
sys.exit(0 if ok else 1)
