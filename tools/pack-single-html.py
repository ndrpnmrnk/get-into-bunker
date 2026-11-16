"""dist/ -> one self-contained HTML (script and models inlined) that opens from disk."""
import base64, os, re, sys

dist = "dist"
out = sys.argv[1] if len(sys.argv) > 1 else "get-into-bunker-probe.html"
html = open(os.path.join(dist, "index.html"), encoding="utf-8").read()
m = re.search(r'<script type="module" crossorigin src="\./(assets/[^"]+\.js)"></script>', html)
js = open(os.path.join(dist, m.group(1)), encoding="utf-8").read()
for name in os.listdir(os.path.join(dist, "models")):
    data = base64.b64encode(open(os.path.join(dist, "models", name), "rb").read()).decode()
    js = js.replace(f"./models/{name}", f"data:model/gltf-binary;base64,{data}")
js = js.replace("</script", "<\\/script")
html = html.replace(m.group(0), "")
html = html.replace("</body>", f'<script type="module">{js}</script>\n</body>')
html = re.sub(r'<link rel="modulepreload"[^>]*>', "", html)
open(out, "w", encoding="utf-8").write(html)
print(out, round(os.path.getsize(out) / 1e6, 1), "MB", "models left:", js.count("./models/"))
