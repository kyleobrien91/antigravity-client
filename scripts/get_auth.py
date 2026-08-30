import sqlite3, os, base64, re, json

p = os.path.expanduser('~/AppData/Roaming/Antigravity IDE/User/globalStorage/state.vscdb')
con = sqlite3.connect(f'file:{p}?mode=ro', uri=True)
cur = con.cursor()
cur.execute("SELECT value FROM ItemTable WHERE key='antigravityUnifiedStateSync.oauthToken'")
row = cur.fetchone()
raw = row[0] if row else ""
tok = ""
if raw:
    b = base64.b64decode(raw)
    strs = re.findall(rb'[A-Za-z0-9+/=]{30,}', b)
    for s in strs:
        try:
            pad = len(s) % 4
            s_padded = s + b'=' * (4 - pad) if pad else s
            dec = base64.b64decode(s_padded)
            if b'ya29.' in dec:
                m = re.search(rb'ya29\.[A-Za-z0-9_\-]+', dec)
                if m:
                    tok = m.group(0).decode('latin1')
                    break
        except Exception:
            pass

print(json.dumps({"token": tok, "rawUss": raw}))
