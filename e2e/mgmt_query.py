"""Exécute un fichier SQL via la Management API Supabase (PAT lu depuis /tmp/.sf_pat)."""
import json
import sys
import urllib.request
import urllib.error

PAT = open("/tmp/.sf_pat").read().strip()
REF = open("/tmp/.sf_ref").read().strip()
API = f"https://api.supabase.com/v1/projects/{REF}/database/query"


def run_sql(sql):
    body = json.dumps({"query": sql}).encode()
    req = urllib.request.Request(
        API, data=body, method="POST",
        headers={
            "Authorization": "Bearer " + PAT,
            "Content-Type": "application/json",
            "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
                          "(KHTML, like Gecko) Chrome/124.0 Safari/537.36",
            "Accept": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            raw = r.read().decode()
            return r.status, raw
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()
    except Exception as e:  # noqa
        return 0, str(e)


if __name__ == "__main__":
    path = sys.argv[1]
    with open(path) as f:
        sql = f.read()
    st, resp = run_sql(sql)
    print(f"HTTP {st}")
    print(resp[:2000])
    sys.exit(0 if st in (200, 201) else 1)
