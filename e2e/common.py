"""Santé Facile — outils communs pour les tests E2E (API REST/Auth Supabase, clé anon)."""
import json
import os
import urllib.request
import urllib.error

SUPABASE_URL = os.environ["SF_URL"].rstrip("/")
ANON = os.environ["SF_ANON"]
PASSWORD = "SanteFacile2026!"

# Comptes de test (idempotents : signup sinon signin)
USERS = {
    "patient1":  {"email": "patient1@santefacile.test",  "role": "patient",   "name": "Aya Koné"},
    "patient2":  {"email": "patient2@santefacile.test",  "role": "patient",   "name": "Bakary Traoré"},
    "medecin1":  {"email": "medecin1@santefacile.test",  "role": "medecin",   "name": "Dr Jean Kouassi"},
    "pharma1":   {"email": "pharma1@santefacile.test",   "role": "pharmacie", "name": "Pharmacie de Cocody"},
    "assureur1": {"email": "assureur1@santefacile.test", "role": "assureur",  "name": "Mutuelle Santé CI"},
    "admin1":    {"email": "admin1@santefacile.test",    "role": "patient",   "name": "Admin Test"},
}

_PASS = 0
_FAIL = 0
_RESULTS = []


def _req(method, path, token=None, body=None, base=None, extra_headers=None):
    url = (base or SUPABASE_URL) + path
    data = json.dumps(body).encode() if body is not None else None
    headers = {"apikey": ANON, "Content-Type": "application/json"}
    headers["Authorization"] = "Bearer " + (token or ANON)
    if extra_headers:
        headers.update(extra_headers)
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            raw = r.read().decode()
            return r.status, (json.loads(raw) if raw.strip() else None)
    except urllib.error.HTTPError as e:
        raw = e.read().decode()
        try:
            return e.code, json.loads(raw)
        except Exception:
            return e.code, {"raw": raw}
    except Exception as e:  # noqa
        return 0, {"error": str(e)}


def auth(method, path, token=None, body=None):
    return _req(method, "/auth/v1" + path, token=token, body=body)


def rest(method, path, token=None, body=None, extra_headers=None):
    return _req(method, "/rest/v1" + path, token=token, body=body, extra_headers=extra_headers)


def rpc(fn, token=None, body=None):
    return _req("POST", "/rest/v1/rpc/" + fn, token=token, body=body or {})


def signup_or_signin(key):
    """Idempotent : crée le compte (avec métadonnées de rôle) sinon se connecte."""
    u = USERS[key]
    st, data = auth("POST", "/signup", body={
        "email": u["email"], "password": PASSWORD,
        "data": {"full_name": u["name"], "phone": "+2250700000000", "role": u["role"]},
    })
    if st == 200 and data and data.get("access_token"):
        return data["access_token"], data["user"]["id"]
    # déjà inscrit → connexion
    st, data = auth("POST", "/token?grant_type=password", body={"email": u["email"], "password": PASSWORD})
    if st == 200 and data and data.get("access_token"):
        return data["access_token"], data["user"]["id"]
    raise RuntimeError(f"Auth échouée pour {key}: HTTP {st} {data}")


def check(name, condition, detail=""):
    global _PASS, _FAIL
    ok = bool(condition)
    if ok:
        _PASS += 1
    else:
        _FAIL += 1
    _RESULTS.append((ok, name, detail))
    mark = "✅" if ok else "❌"
    print(f"{mark} {name}" + (f" — {detail}" if detail else ""))
    return ok


def summary(title):
    print("\n" + "=" * 60)
    print(f"  {title} : {_PASS} réussis / {_FAIL} échecs")
    print("=" * 60)
    return _FAIL == 0
