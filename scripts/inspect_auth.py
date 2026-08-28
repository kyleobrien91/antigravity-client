import sqlite3, os, base64, re

p = os.path.expanduser('~/AppData/Roaming/Antigravity IDE/User/globalStorage/state.vscdb')
print("Connecting to:", p)
con = sqlite3.connect(f'file:{p}?mode=ro', uri=True)
cur = con.cursor()
cur.execute("SELECT key, value FROM ItemTable WHERE key LIKE '%oauth%' OR key LIKE '%antigravity%'")
for k, v in cur.fetchall():
    print("KEY:", k)
    if 'oauthToken' in k:
        print("Length:", len(v))
        b = base64.b64decode(v)
        print("Raw decoded bytes len:", len(b))
        strs = re.findall(rb'[A-Za-z0-9+/=]{30,}', b)
        for s in strs:
            try:
                pad = len(s) % 4
                s_padded = s + b'=' * (4 - pad) if pad else s
                dec = base64.b64decode(s_padded)
                if b'ya29.' in dec:
                    m = re.search(rb'ya29\.[A-Za-z0-9_\-]+', dec)
                    if m:
                        print("FOUND OAUTH TOKEN:", m.group(0).decode('latin1'))
            except Exception:
                pass
