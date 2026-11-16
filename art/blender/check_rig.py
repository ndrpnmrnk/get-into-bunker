"""Checks art/build/rig.json produced by rig.py."""
import json, os, sys
P = os.path.join(os.path.dirname(__file__), "..", "build", "rig.json")
KEYS = ["idle", "walk", "jump", "crouchIdle", "crouchWalk", "sit"]
def fail(msg): print("FAIL", msg); sys.exit(1)
if not os.path.exists(P): fail("rig.json not found")
r = json.load(open(P))
for k in ("head", "neck"):
    if r.get(k) not in r.get("bones", []): fail(f"{k} bone missing")
for k in KEYS:
    if not r.get("clips", {}).get(k): fail(f"clip {k} missing")
if not 150 <= r.get("eyeHeightCm", 0) <= 185: fail(f"eyeHeightCm out of range: {r.get('eyeHeightCm')}")
print("PASS rig.json", len(r["bones"]), "bones,", r["clips"])
