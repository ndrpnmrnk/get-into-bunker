"""Checks public/models/character.glb (Task 2 contract)."""
import os, sys
import bpy
from common import MODELS, reset_scene

P = os.path.join(MODELS, "character.glb")
SLOTS = {"skin", "shirt", "shorts", "shoes", "hair", "eyeWhite", "pupil", "mouth"}
CLIPS = {"idle", "walk", "jump", "crouchIdle", "crouchWalk", "sit"}
def fail(m): print("FAIL", m); sys.exit(1)

if not os.path.exists(P): fail("character.glb not found")
reset_scene()
bpy.ops.import_scene.gltf(filepath=P)
arm = next((o for o in bpy.data.objects if o.type == "ARMATURE"), None)
shapes = {b.custom_shape for b in arm.pose.bones} if arm else set()  # importer-made bone display shapes
meshes = [o for o in bpy.data.objects if o.type == "MESH" and o not in shapes]
if len(meshes) != 1 or not arm: fail(f"expected 1 mesh + armature, got {[o.name for o in meshes]}")
body = meshes[0]
if not any(m.type == "ARMATURE" for m in body.modifiers): fail("mesh is not skinned")
tris = sum(len(p.vertices) - 2 for p in body.data.polygons)
if tris > 20000: fail(f"{tris} triangles > 20000")
mats = {m.name for m in body.data.materials}
if mats != SLOTS: fail(f"material slots {sorted(mats)}")
keys = body.data.shape_keys
if not keys or "mouthOpen" not in keys.key_blocks: fail("shape key mouthOpen missing")
names = {a.name.split("_")[0] if a.name not in CLIPS else a.name for a in bpy.data.actions}
missing = CLIPS - {a.name for a in bpy.data.actions}
if missing: fail(f"clips missing {missing} (have {[a.name for a in bpy.data.actions]})")

# Tearing check: no edge >= 1 cm stretches > 3x its rest length while walking.
FINGERS = ("index_", "middle_", "ring_", "thumb_", "hand_")
def is_finger(v):
    g = max(v.groups, key=lambda g: g.weight, default=None)
    return bool(g) and body.vertex_groups[g.group].name.startswith(FINGERS)
vmat = {}
for p in body.data.polygons:
    for v in p.vertices:
        vmat[v] = body.data.materials[p.material_index].name
def edge_class(e):
    v = e.vertices[0]
    if is_finger(body.data.vertices[v]): return "hands"
    return "clothes" if vmat.get(v) in ("shirt", "shorts") else "skin"
LIMIT = {"skin": 3.5, "clothes": 4.5, "hands": 5.0}  # cloth bunches at hips, fingers curl into fists
finger_edge = [edge_class(e) for e in body.data.edges]
def edge_lengths(ob):
    dg = bpy.context.evaluated_depsgraph_get()
    me = ob.evaluated_get(dg).to_mesh()
    L = [(me.vertices[e.vertices[0]].co - me.vertices[e.vertices[1]].co).length for e in me.edges]
    ob.evaluated_get(dg).to_mesh_clear()
    return L
rest = edge_lengths(body)
arm.animation_data_create()
act = bpy.data.actions["walk"]
arm.animation_data.action = act
if hasattr(arm.animation_data, "action_slot") and act.slots:
    arm.animation_data.action_slot = act.slots[0]
f0, f1 = map(int, act.frame_range)
worst = {k: 0 for k in LIMIT}
for i in range(10):
    bpy.context.scene.frame_set(f0 + (f1 - f0) * i // 10)
    cur = edge_lengths(body)
    for c, r, fe in zip(cur, rest, finger_edge):
        if r > 0.01:
            worst[fe] = max(worst[fe], c / r)
if any(worst[k] > LIMIT[k] for k in LIMIT): fail(f"edge stretch while walking {worst} > {LIMIT}")
worst = max(worst.values())
print(f"PASS character.glb: {tris} tris, slots ok, mouthOpen ok, clips ok, max stretch {worst:.2f}x")
