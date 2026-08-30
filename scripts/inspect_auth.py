import os, json, binascii

kp = os.path.expanduser('~/.config/Antigravity/keyring_store.json')
if os.path.exists(kp):
    with open(kp, 'r', encoding='utf-8') as f:
        kd = json.load(f)
        for k, v in kd.items():
            if v.get('attributes', {}).get('service') == 'gemini':
                secret_hex = v.get('secret', '')
                raw_json = binascii.unhexlify(secret_hex).decode('utf-8')
                print("Decoded JSON from Linux Desktop App keyring:")
                parsed = json.loads(raw_json)
                print(json.dumps(parsed, indent=2))
while idx < len(b):
    tag = b[idx]
    field_num = tag >> 3
    wire_type = tag & 0x7
    idx += 1
    if wire_type == 2: # length-delimited
        length = b[idx]
        idx += 1
        if length & 0x80:
            length = (length & 0x7f) | (b[idx] << 7)
            idx += 1
        data = b[idx:idx+length]
        idx += length
        print(f"Field {field_num}, wire {wire_type}, len {length}")
        # inside DataEntry:
        sub_idx = 0
        while sub_idx < len(data):
            sub_tag = data[sub_idx]
            sub_fn = sub_tag >> 3
            sub_wt = sub_tag & 0x7
            sub_idx += 1
            if sub_wt == 2:
                sub_len = data[sub_idx]
                sub_idx += 1
                if sub_len & 0x80:
                    sub_len = (sub_len & 0x7f) | (data[sub_idx] << 7)
                    sub_idx += 1
                sub_data = data[sub_idx:sub_idx+sub_len]
                sub_idx += sub_len
                print(f"  Subfield {sub_fn}, len {sub_len}: {sub_data[:40]}")

