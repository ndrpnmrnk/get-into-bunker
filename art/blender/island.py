"""Prototype island chunk -> public/models/island.glb.

Hill-island in rising water: a grassy plateau with a campfire, four log benches
(8 seats), soft rocky cliffs down to the water, boulders, grass tufts and two
stylized spruces. Empties mark gameplay points. Water itself is drawn in the web app.
"""
import math, os, random
import bpy
import bmesh
from mathutils import Matrix, Vector, noise
from common import BUILD, MODELS, export_glb, material, reset_scene
from shapes import capsule, decimate, ellipsoid, new_obj, select_only, soften

TOP = 4.0            # plateau height above the water (z = 0)
PLATEAU_R = 8.6      # walkable radius
SEAT_R = 3.7         # seats distance from the fire
rng = random.Random(7)


def mat(ob, key):
    ob.data.materials.clear()
    ob.data.materials.append(material(key))


def empty(name, loc, rot_z=0.0):
    e = bpy.data.objects.new(name, None)
    e.location, e.rotation_euler = loc, (0, 0, rot_z)
    bpy.context.collection.objects.link(e)
    return e


def plateau_z(x, y):
    """Gentle dome + soft noise; shared by the ground mesh and placement."""
    r = math.hypot(x, y)
    return TOP + 0.35 * (1 - (r / PLATEAU_R) ** 2) + 0.12 * noise.noise(Vector((x * 0.25, y * 0.25, 0)))


def join(obs, name):
    select_only(obs, obs[0])
    bpy.ops.object.join()
    obs[0].name = name
    return obs[0]


def build():
    reset_scene()

    # ---- ground: plateau disc ----
    bm = bmesh.new()  # concentric rings -> a clean round edge
    seg, nr, edge_r = 160, 46, PLATEAU_R + 0.4
    center = bm.verts.new((0, 0, plateau_z(0, 0)))
    rings = []
    for k in range(1, nr + 1):
        r = edge_r * k / nr
        rings.append([bm.verts.new((r * math.cos(2 * math.pi * i / seg), r * math.sin(2 * math.pi * i / seg), 0)) for i in range(seg)])
    for i in range(seg):
        bm.faces.new((center, rings[0][i], rings[0][(i + 1) % seg]))
    for r0, r1 in zip(rings, rings[1:]):
        for i in range(seg):
            bm.faces.new((r0[i], r1[i], r1[(i + 1) % seg], r0[(i + 1) % seg]))
    for v in bm.verts:
        v.co.z = plateau_z(v.co.x, v.co.y)
    for v in rings[-1]:  # soft rounded lip over the cliff
        v.co.z -= 0.12
    ground = new_obj("Ground", bm)
    mat(ground, "grass")

    # ---- cliffs: lumpy lathe from the plateau lip down under the water ----
    profile = [(3.0, TOP - 1.2), (PLATEAU_R - 0.3, TOP - 0.25), (PLATEAU_R + 0.5, TOP - 0.3), (PLATEAU_R + 1.0, TOP - 0.7), (PLATEAU_R + 1.6, TOP - 1.6),
               (PLATEAU_R + 2.2, TOP - 2.8), (PLATEAU_R + 3.2, 0.4), (PLATEAU_R + 4.6, -1.5), (3.0, -1.5)]
    seg = 120
    bm = bmesh.new()
    rings = []
    for r, z in profile:
        ring = []
        for i in range(seg):
            a = 2 * math.pi * i / seg
            amp = 0.0 if r < PLATEAU_R else 0.9
            rr = r + amp * noise.noise(Vector((math.cos(a) * 2.2, math.sin(a) * 2.2, z * 0.4)))
            ring.append(bm.verts.new((rr * math.cos(a), rr * math.sin(a), z)))
        rings.append(ring)
    for r0, r1 in zip(rings, rings[1:] + rings[:1]):  # closed loop -> solid rock body
        for i in range(seg):
            bm.faces.new((r0[i], r0[(i + 1) % seg], r1[(i + 1) % seg], r1[i]))
    cliffs = new_obj("Cliffs", bm)
    soften(cliffs, 0.12, 10, 0.5)
    decimate(cliffs, 40000)
    mat(cliffs, "cliff")

    # ---- campfire: stone ring, teepee logs, ash bed ----
    parts = []
    bm = bmesh.new()
    for i in range(9):
        a = 2 * math.pi * i / 9 + rng.uniform(-0.1, 0.1)
        ellipsoid(bm, Vector((0.78 * math.cos(a), 0.78 * math.sin(a), plateau_z(0, 0) + 0.08)),
                  (0.2, 0.16, 0.13), rot=Matrix.Rotation(a, 4, "Z"))
    stones = new_obj("CampfireStones", bm); soften(stones, 0.025, 4); decimate(stones, 2500); mat(stones, "rock")
    bm = bmesh.new()
    base = Vector((0, 0, plateau_z(0, 0) + 0.02))
    for i in range(4):
        a = 2 * math.pi * i / 4 + 0.4
        capsule(bm, base + Vector((0.6 * math.cos(a), 0.6 * math.sin(a), 0.04)), base + Vector((0, 0, 0.8)), 0.1, 0.07)
    flogs = new_obj("CampfireLogs", bm); soften(flogs, 0.02, 3); decimate(flogs, 1500); mat(flogs, "woodDark")
    bm = bmesh.new()
    ellipsoid(bm, base, (0.6, 0.6, 0.05), segs=24)
    ash = new_obj("CampfireAsh", bm); mat(ash, "rock")
    campfire = join([stones, flogs, ash], "Campfire")
    fire_point = empty("FirePoint", base + Vector((0, 0, 0.45)))

    # ---- log benches: 4 logs, 2 seats each ----
    bm = bmesh.new()
    seats = []
    for k in range(4):
        a = 2 * math.pi * k / 4 + math.pi / 4
        c = Vector((SEAT_R * math.cos(a), SEAT_R * math.sin(a), 0))
        t = Vector((-math.sin(a), math.cos(a), 0))
        gz = plateau_z(c.x, c.y)
        capsule(bm, c - t * 1.15 + Vector((0, 0, gz + 0.27)), c + t * 1.15 + Vector((0, 0, gz + 0.27)), 0.27, 0.26, segs=24)
        for j, off in enumerate((-0.55, 0.55)):
            p = c + t * off
            to_fire = -Vector((p.x, p.y, 0)).normalized()
            rot_z = math.atan2(to_fire.y, to_fire.x) + math.pi / 2  # local -Y faces the fire
            seats.append((p.x, p.y, rot_z))
    benches = new_obj("Benches", bm); soften(benches, 0.03, 3); decimate(benches, 5000); mat(benches, "wood")
    fz = fire_point.location.z
    for i, (x, y, rz) in enumerate(seats):
        empty(f"Seat_{i}", (x, y, fz), rz)

    # ---- boulders near the edge ----
    bm = bmesh.new()
    for i in range(7):
        a = rng.uniform(0, 2 * math.pi); r = rng.uniform(6.2, 7.8)
        s = rng.uniform(0.45, 0.9)
        ellipsoid(bm, Vector((r * math.cos(a), r * math.sin(a), plateau_z(r * math.cos(a), r * math.sin(a)) + s * 0.35)),
                  (s, s * 0.85, s * 0.7), rot=Matrix.Rotation(rng.uniform(0, 3), 4, "Z"))
    rocks = new_obj("Rocks", bm); soften(rocks, 0.05, 5); decimate(rocks, 6000); mat(rocks, "rock")

    # ---- grass tufts: clusters of soft blades ----
    bm = bmesh.new()
    placed = 0
    while placed < 70:
        x, y = rng.uniform(-8, 8), rng.uniform(-8, 8)
        r = math.hypot(x, y)
        if r < 1.6 or r > PLATEAU_R - 0.4 or abs(r - SEAT_R) < 0.6:
            continue
        z = plateau_z(x, y)
        for b in range(4):
            ang, tilt, h = rng.uniform(0, 6.28), rng.uniform(0.15, 0.45), rng.uniform(0.22, 0.38)
            tip = Vector((x + math.cos(ang) * tilt * h, y + math.sin(ang) * tilt * h, z + h))
            capsule(bm, Vector((x, y, z - 0.02)), tip, 0.05, 0.012, segs=8)
        placed += 1
    grass = new_obj("Grass", bm); decimate(grass, 30000); mat(grass, "grassDark")

    # ---- two stylized spruces: trunk + stacked soft tiers ----
    trunks, crowns, tree_xy = bmesh.new(), bmesh.new(), [(-5.6, 4.2), (6.0, 3.0)]
    for (x, y), hgt in zip(tree_xy, (7.6, 6.6)):
        z = plateau_z(x, y)
        capsule(trunks, Vector((x, y, z - 0.2)), Vector((x, y, z + hgt * 0.5)), 0.28, 0.18, segs=14)
        tiers = 5
        for t in range(tiers):
            f = t / (tiers - 1)
            rad = 2.0 * (1 - f) + 0.45
            tz = z + 2.95 + f * (hgt - 3.1)  # lowest tier above head height
            res = bmesh.ops.create_cone(crowns, cap_ends=True, segments=40, radius1=rad, radius2=0.05,
                                        depth=1.6 - f * 0.5, matrix=Matrix.Translation((x, y, tz + 0.6)))
            for v in res["verts"]:
                d = Vector((v.co.x - x, v.co.y - y, 0))
                if d.length > rad * 0.8:  # rim: scallops that droop a little
                    a = math.atan2(d.y, d.x)
                    v.co += d.normalized() * 0.18 * math.sin(a * 9 + t) - Vector((0, 0, 0.12 * (1 + math.cos(a * 9 + t))))
    trunk_ob = new_obj("TreeTrunks", trunks); soften(trunk_ob, 0.04, 3); mat(trunk_ob, "woodDark")
    crown_ob = new_obj("TreeCrowns", crowns); soften(crown_ob, 0.07, 10, 0.6); decimate(crown_ob, 9000); mat(crown_ob, "grassDark")
    trees = join([trunk_ob, crown_ob], "Trees")

    # ---- spawn + walk blockers (invisible in the game) ----
    empty("Spawn", (0, -6.0, plateau_z(0, -6.0)))
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=16, radius1=1.05, radius2=1.05, depth=1.5,
                          matrix=Matrix.Translation((0, 0, fz)))
    for x, y in tree_xy:
        bmesh.ops.create_cone(bm, cap_ends=True, segments=12, radius1=0.45, radius2=0.45, depth=3,
                              matrix=Matrix.Translation((x, y, plateau_z(x, y) + 1)))
    blockers = new_obj("WalkBlockers", bm)
    blockers.data.materials.append(material("rock"))
    # boulders and benches are solid too: copies of their meshes join the blockers
    copies = []
    for src in (rocks, benches):
        cp = src.copy(); cp.data = src.data.copy(); cp.modifiers.clear()
        bpy.context.collection.objects.link(cp); copies.append(cp)
    blockers = join([blockers] + copies, "WalkBlockers")
    for o in bpy.data.objects:
        if o.type == "MESH" and o.name != "WalkBlockers":
            select_only([o], o)
            bpy.ops.object.shade_smooth()
    return [o for o in bpy.data.objects]


if __name__ == "__main__":
    objs = build()
    os.makedirs(BUILD, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(BUILD, "island.blend"))
    export_glb(os.path.join(MODELS, "island.glb"), animations=False, objects=objs)
