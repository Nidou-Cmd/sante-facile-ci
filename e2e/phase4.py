"""Phase 4 — tests Paramètres système (sante_settings).
Prérequis : migrations 009 ET 010 exécutées ; admin1 promu (phase 2/3)."""
import sys
import urllib.request
import json
import os
from common import rest, signup_or_signin, check, summary

print("\n########## PHASE 4 — Paramètres système (admin) ##########\n")

tok = {}
uid = {}
for key in ("patient1", "admin1"):
    tok[key], uid[key] = signup_or_signin(key)

# 1) Lecture PUBLIQUE (anon, sans connexion) — nécessaire aux pages légales
URL = os.environ["SF_URL"].rstrip("/")
ANON = os.environ["SF_ANON"]
req = urllib.request.Request(
    f"{URL}/rest/v1/sante_settings?select=key",
    headers={"apikey": ANON, "Authorization": f"Bearer {ANON}"},
)
try:
    with urllib.request.urlopen(req, timeout=20) as r:
        rows = json.loads(r.read().decode())
except Exception as e:  # noqa
    rows = {"error": str(e)}
keys = [r["key"] for r in rows] if isinstance(rows, list) else []
check("[P-SYS] Lecture publique (anon) des paramètres", len(keys) >= 7, f"{len(keys)} clés : {keys[:4]}…")
for expected in ("emergency_numbers", "emergency_fallback_seconds", "jitsi_base_url",
                 "commission_percent", "legal_cgu", "legal_confidentialite", "legal_mentions", "mobile_money"):
    check(f"[P-SYS] Clé initiale présente : {expected}", expected in keys)

# 2) Un PATIENT ne peut PAS modifier un paramètre (RLS admin-only)
st, res = rest("PATCH", "/sante_settings?key=eq.commission_percent",
               token=tok["patient1"], body={"value": 99},
               extra_headers={"Prefer": "return=representation"})
blocked = st not in (200, 201, 204) or (isinstance(res, list) and len(res) == 0)
check("[P-SYS-SEC] Un patient ne peut PAS modifier les paramètres", blocked, f"HTTP {st}")

# 3) L'ADMIN modifie : commission 2 → 2.5, seuil 240 → 300, SAMU inchangé
st, _ = rest("PATCH", "/sante_settings?key=eq.commission_percent",
             token=tok["admin1"], body={"value": 2.5, "updated_by": uid["admin1"]})
check("[P-SYS] Admin modifie la commission", st in (200, 204), f"HTTP {st}")
st, _ = rest("PATCH", "/sante_settings?key=eq.emergency_fallback_seconds",
             token=tok["admin1"], body={"value": 300, "updated_by": uid["admin1"]})
check("[P-SYS] Admin modifie le seuil de fallback urgence", st in (200, 204), f"HTTP {st}")

# 4) Vérification des nouvelles valeurs (lecture patient)
st, vals = rest("GET", "/sante_settings?key=in.(commission_percent,emergency_fallback_seconds)&select=key,value",
                token=tok["patient1"])
got = {v["key"]: v["value"] for v in vals} if isinstance(vals, list) else {}
check("[P-SYS] Nouvelle commission visible par tous (2.5)", got.get("commission_percent") == 2.5, f"{got}")
check("[P-SYS] Nouveau seuil visible par tous (300)", got.get("emergency_fallback_seconds") == 300)

# 5) Admin modifie un texte légal → lisible publiquement
st, _ = rest("PATCH", "/sante_settings?key=eq.legal_cgu",
             token=tok["admin1"],
             body={"value": "OBJET\nCGU de test modifiées par l'admin via /admin/parametres.\n\nURGENCES\nEn urgence vitale, appelez le 185.",
                   "updated_by": uid["admin1"]})
st2, cgu = rest("GET", "/sante_settings?key=eq.legal_cgu&select=value", token=tok["patient1"])
cgu_text = (cgu or [{}])[0].get("value") if isinstance(cgu, list) else None
check("[P-SYS] Texte CGU modifié par l'admin et lu publiquement",
      isinstance(cgu_text, str) and "modifiées par l'admin" in cgu_text)

# 6) Remise des valeurs initiales (idempotence des tests)
rest("PATCH", "/sante_settings?key=eq.commission_percent", token=tok["admin1"], body={"value": 2})
rest("PATCH", "/sante_settings?key=eq.emergency_fallback_seconds", token=tok["admin1"], body={"value": 240})
print("   (valeurs de test remises à l'état initial)")

ok = summary("PHASE 4")
sys.exit(0 if ok else 1)
