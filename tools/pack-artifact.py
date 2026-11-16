"""Copy dist/ to dist-artifact/ with .glb models re-packed as glTF JSON (.json) —
the artifact host does not serve .glb. GLTFLoader reads both."""
import base64, json, os, re, shutil, struct, sys

src, dst = "dist", "dist-artifact"
shutil.rmtree(dst, ignore_errors=True)
shutil.copytree(src, dst)
for name in os.listdir(os.path.join(dst, "models")):
    if not name.endswith(".glb"):
        continue
    p = os.path.join(dst, "models", name)
    data = open(p, "rb").read()
    magic, version, length = struct.unpack_from("<4sII", data, 0)
    assert magic == b"glTF", name
    off, doc, binary = 12, None, b""
    while off < length:
        clen, ctype = struct.unpack_from("<I4s", data, off)
        chunk = data[off + 8: off + 8 + clen]
        if ctype == b"JSON": doc = json.loads(chunk)
        elif ctype == b"BIN\x00": binary = chunk
        off += 8 + clen
    doc["buffers"][0]["uri"] = "data:application/octet-stream;base64," + base64.b64encode(binary).decode()
    json.dump(doc, open(p[:-4] + ".json", "w"), separators=(",", ":"))
    os.remove(p)
for root, _, files in os.walk(os.path.join(dst, "assets")):
    for f in files:
        if f.endswith(".js"):
            fp = os.path.join(root, f)
            s = open(fp).read()
            s2 = re.sub(r"\./models/(\w+)\.glb", r"./models/\1.json", s)
            open(fp, "w").write(s2)
            print("patched", fp, s.count(".glb"), "->", s2.count(".glb"))
print(sorted(os.path.relpath(os.path.join(r, f), dst) for r, _, fs in os.walk(dst) for f in fs))
