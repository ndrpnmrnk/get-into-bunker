"""Checks public/models/character.glb: layered character on the UAL skeleton."""
import os, sys
import bpy
from common import MODELS, reset_scene

P = os.path.join(MODELS, "character.glb")
LAYERS = {"Body", "Face", "Hair", "Shirt", "Pants", "Belt", "Shoes", "Watch"}
SLOTS = {"skin", "shirt", "pants", "hair", "brow", "eyes", "mouth", "buttons", "belt", "buckle", "shoes", "watch"}
CLIPS = {"idle", "walk", "jump", "crouchIdle", "crouchWalk", "sit"}
LIMIT = {"skin": 3.5, "clothes": 4.5, "hands": 5.0}  # cloth bunches at hips, fingers curl into fists
FINGERS = ("index_", "middle_", "ring_", "pinky_", "thumb_", "hand_")
def fail(m): print("FAIL", m); sys.exit(1)

if not os.path.exists(P): fail("character.glb not found")
reset_scene()
bpy.ops.import_scene.gltf(filepath=P)
arm = next((o for o in bpy.data.objects if o.type == "ARMATURE"), None)
shapes = {b.custom_shape for b in arm.pose.bones} if arm else set()  # importer-made bone display shapes
meshes = {o.name: o for o in bpy.data.objects if o.type == "MESH" and o not in shapes}
if not arm or set(meshes) != LAYERS: fail(f"layers {sorted(meshes)} != {sorted(LAYERS)}")
for o in meshes.values():
    if not any(m.type == "ARMATURE" for m in o.modifiers): fail(f"{o.name} is not skinned")
tris = sum(len(p.vertices) - 2 for o in meshes.values() for p in o.data.polygons)
if tris > 20000: fail(f"{tris} triangles > 20000")
slots = {m.name for o in meshes.values() for m in o.data.materials}
if slots != SLOTS: fail(f"material slots {sorted(slots)}")
keys = meshes["Face"].data.shape_keys
if not keys or "mouthOpen" not in keys.key_blocks: fail("Face shape key mouthOpen missing")
if CLIPS - {a.name for a in bpy.data.actions}: fail(f"clips missing {CLIPS - {a.name for a in bpy.data.actions}}")

def edge_classes(o):
    out = []
    for e in o.data.edges:
        v = o.data.vertices[e.vertices[0]]
        g = max(v.groups, key=lambda g: g.weight, default=None)
        bone = o.vertex_groups[g.group].name if g else ""
        out.append("hands" if bone.startswith(FINGERS) else "clothes" if o.name in ("Shirt", "Pants") else "skin")
    return out
def lengths(o):
    me = o.evaluated_get(bpy.context.evaluated_depsgraph_get()).to_mesh()
    L = [(me.vertices[e.vertices[0]].co - me.vertices[e.vertices[1]].co).length for e in me.edges]
    o.evaluated_get(bpy.context.evaluated_depsgraph_get()).to_mesh_clear()
    return L
cls = {n: edge_classes(o) for n, o in meshes.items()}
rest = {n: lengths(o) for n, o in meshes.items()}
arm.animation_data_create()
act = bpy.data.actions["walk"]
arm.animation_data.action = act
if act.slots: arm.animation_data.action_slot = act.slots[0]
f0, f1 = map(int, act.frame_range)
worst = {k: 0 for k in LIMIT}
for i in range(10):
    bpy.context.scene.frame_set(f0 + (f1 - f0) * i // 10)
    for n, o in meshes.items():
        for c, r, k in zip(lengths(o), rest[n], cls[n]):
            if r > 0.01: worst[k] = max(worst[k], c / r)
if any(worst[k] > LIMIT[k] for k in LIMIT): fail(f"edge stretch while walking {worst} > {LIMIT}")
print(f"PASS character.glb: {len(meshes)} layers, {tris} tris, slots ok, mouthOpen ok, clips ok, stretch {max(worst.values()):.2f}x")
