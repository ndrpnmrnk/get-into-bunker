"""Checks public/models/island.glb (Task 3 contract)."""
import math, os, sys
import bpy
from mathutils import Vector
from common import MODELS, reset_scene

P = os.path.join(MODELS, "island.glb")
NODES = ["Ground", "Cliffs", "Campfire", "FirePoint", "Spawn", "Rocks", "Grass", "Trees", "WalkBlockers"] + [f"Seat_{i}" for i in range(8)]
def fail(m): print("FAIL", m); sys.exit(1)
if not os.path.exists(P): fail("island.glb not found")
reset_scene()
bpy.ops.import_scene.gltf(filepath=P)
O = bpy.data.objects
missing = [n for n in NODES if n not in O]
if missing: fail(f"missing nodes {missing}")
tris = sum(len(p.vertices) - 2 for o in O if o.type == "MESH" for p in o.data.polygons)
if tris > 150000: fail(f"{tris} triangles > 150000")
fire = O["FirePoint"].matrix_world.translation
for i in range(8):
    s = O[f"Seat_{i}"].matrix_world
    d = fire - s.translation
    flat = Vector((d.x, d.y, 0))
    if not 3.0 <= flat.length <= 4.5: fail(f"Seat_{i} distance {flat.length:.2f}")
    if math.degrees(math.atan2(abs(d.z), flat.length)) > 5: fail(f"Seat_{i} not level with fire")
    fwd = (s.to_3x3() @ Vector((0, -1, 0))); fwd.z = 0
    if math.degrees(fwd.angle(flat)) > 5: fail(f"Seat_{i} does not face the fire")
g = O["Ground"]; sp = O["Spawn"].matrix_world.translation
inv = g.matrix_world.inverted()
hit, *_ = g.ray_cast(inv @ (sp + Vector((0, 0, 5))), inv.to_3x3() @ Vector((0, 0, -1)))
if not hit: fail("no Ground under Spawn")
# boulders and benches must be solid for walking
blk = O["WalkBlockers"]; binv = blk.matrix_world.inverted()
for name in ("Rocks", "Benches"):
    ob = O[name]
    for v in list(ob.data.vertices)[::40]:
        p = ob.matrix_world @ v.co
        hit, *_ = blk.ray_cast(binv @ Vector((p.x, p.y, p.z + 3)), binv.to_3x3() @ Vector((0, 0, -1)))
        if not hit: fail(f"{name} is walk-through near {tuple(round(c, 1) for c in p)}")
# the camera (eyes ~1.6 m) must not end up inside the lowest spruce tier
trees = O["Trees"]
crown_mats = [i for i, m in enumerate(trees.data.materials) if m.name == "grassDark"]
crown_z = [(trees.matrix_world @ trees.data.vertices[vi].co).z for p in trees.data.polygons
           if p.material_index in crown_mats for vi in p.vertices]
ground_z = max((g.matrix_world @ v.co).z for v in g.data.vertices)
if min(crown_z) < ground_z + 2.1: fail(f"lowest spruce tier at {min(crown_z) - ground_z:.2f} m above ground (< 2.1)")
print(f"PASS island.glb: {tris} tris, all nodes, seats face the fire, ground under spawn, rocks/benches solid, crowns above heads")
