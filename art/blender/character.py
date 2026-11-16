"""Base character after the author's reference (blond man, white short-sleeve shirt,
navy trousers, belt, black shoes, watch) -> public/models/character.glb.

Built on the UAL skeleton. Every layer is its own skinned mesh on the same armature,
so clothes can later be swapped per profession:
  Body (skin: head, neck, arms, hands, ears, nose), Face (eyes, brows, mouth),
  Hair (hair + moustache), Shirt (shirt, collar, pocket, buttons), Pants, Belt, Shoes, Watch.
In the .blend they are grouped into collections Skin / Face / Hair / Clothes / Accessories.
"""
import json, math, os
import bpy
import bmesh
from mathutils import Euler, Matrix, Vector
from mathutils.geometry import intersect_point_line
from common import BUILD, EYE_OFFSET_M, MODELS, export_glb, import_ual, material, reset_scene
from shapes import apply_mods, ellipsoid, new_obj, rounded_box, select_only, tube

RIG = json.load(open(os.path.join(BUILD, "rig.json")))
SIDES = ("l", "r")
# material slot -> default palette key, shared with the web app (art/slots.json)
SLOT_KEY = json.load(open(os.path.join(os.path.dirname(__file__), "..", "slots.json")))
LAYERS = {"Skin": ["Body"], "Face": ["Face"], "Hair": ["Hair"],
          "Clothes": ["Shirt", "Pants", "Shoes"], "Accessories": ["Belt", "Watch"]}
X, Y, Z = Vector((1, 0, 0)), Vector((0, 1, 0)), Vector((0, 0, 1))
HEAD_SCALE = 1.14


def mats():
    return {s: material(s, key=k) for s, k in SLOT_KEY.items()}


def finish(name, bm, slots, M, flat=False):
    """bm faces carry material_index into `slots` order."""
    ob = new_obj(name, bm)
    for s in slots:
        ob.data.materials.append(M[s])
    select_only([ob], ob)
    (bpy.ops.object.shade_flat if flat else bpy.ops.object.shade_smooth)()
    return ob


def tag(bm, start, idx):
    """Set material index on faces created since `start`."""
    bm.faces.ensure_lookup_table()
    for f in bm.faces[start:]:
        f.material_index = idx
    return len(bm.faces)


def lerp_pts(a, b, n):
    return [a.lerp(b, i / (n - 1)) for i in range(n)]


# ---------- weights ----------
def nearest_bone_weights(ob, arm, bones, blend=0.02):
    W = arm.matrix_world
    segs = {n: (W @ arm.data.bones[n].head_local, W @ arm.data.bones[n].tail_local) for n in bones}
    groups = {n: ob.vertex_groups.get(n) or ob.vertex_groups.new(name=n) for n in bones}
    for v in ob.data.vertices:
        p = ob.matrix_world @ v.co
        ds = []
        for n, (a, b) in segs.items():
            q, t = intersect_point_line(p, a, b)
            q = a if t < 0 else b if t > 1 else q
            ds.append(((p - q).length, n))
        ds.sort()
        (d0, n0) = ds[0]
        if len(ds) > 1:
            d1, n1 = ds[1]
            w1 = max(0.0, 0.5 - (d1 - d0) / blend) if blend else 0
        else:
            w1 = 0
        groups[n0].add([v.index], 1 - w1, "REPLACE")
        if w1 > 0:
            groups[n1].add([v.index], w1, "ADD")


def rigid(ob, bone):
    ob.vertex_groups.new(name=bone).add(range(len(ob.data.vertices)), 1.0, "REPLACE")


def auto_weights(obs, arm):
    select_only(obs + [arm], arm)
    bpy.ops.object.parent_set(type="ARMATURE_AUTO")


def copy_weights(dst, src):
    m = dst.modifiers.new("dt", "DATA_TRANSFER")
    m.object, m.use_vert_data, m.data_types_verts = src, True, {"VGROUP_WEIGHTS"}
    m.vert_mapping = "POLYINTERP_NEAREST"
    m.layers_vgroup_select_src, m.layers_vgroup_select_dst = "ALL", "NAME"
    bpy.context.view_layer.objects.active = dst
    bpy.ops.object.datalayout_transfer(modifier=m.name)
    apply_mods(dst)


def bind(ob, arm):
    """Parent to the armature with an Armature modifier (weights already set)."""
    ob.parent = arm
    mod = ob.modifiers.new("Armature", "ARMATURE")
    mod.object = arm


def join(obs, name):
    select_only(obs, obs[0])
    bpy.ops.object.join()
    obs[0].name = name
    return obs[0]


def build():
    reset_scene()
    arm = import_ual()
    for o in [o for o in bpy.data.objects if o.type == "MESH"]:
        bpy.data.objects.remove(o)
    W = arm.matrix_world
    H = lambda n: W @ arm.data.bones[n].head_local
    M = mats()
    head_base = H(RIG["head"])
    eye_z = head_base.z + EYE_OFFSET_M
    cy = 0.0  # head centre depth (front is -Y)

    # ===== Body: neck + arms (auto weights), head (rigid), hands (nearest bone) =====
    bm = bmesh.new()
    tube(bm, lerp_pts(Vector((0, 0.01, 1.43)), Vector((0, 0.0, 1.58)), 5), [(0.1, 0.1)] * 5, X, segs=20)
    for s in SIDES:
        sh, el, wr = H(f"upperarm_{s}"), H(f"lowerarm_{s}"), H(f"hand_{s}")
        pts = lerp_pts(sh - (el - sh).normalized() * 0.02, el, 6)[:-1] + lerp_pts(el, wr + (wr - el).normalized() * 0.01, 6)
        sizes = [(0.102 - 0.026 * i / len(pts), 0.098 - 0.026 * i / len(pts)) for i in range(len(pts))]
        tube(bm, pts, sizes, Y, segs=18)
    limbs = finish("BodyLimbs", bm, ["skin"], M)

    bm = bmesh.new()
    zs = [1.535, 1.56, 1.6, 1.65, 1.71, 1.77, 1.80]
    sz = [(0.17, 0.15), (0.205, 0.185), (0.222, 0.21), (0.228, 0.218), (0.228, 0.22), (0.222, 0.215), (0.21, 0.205)]
    tube(bm, [Vector((0, cy, z)) for z in zs], sz, X, n=3.0, segs=32, cap0=0.02, cap1=0.045, cap_rings=5)
    for s in (-1, 1):
        ellipsoid(bm, Vector((s * 0.116, cy + 0.008, 1.655)), (0.02, 0.034, 0.045), segs=16)
    ellipsoid(bm, Vector((0, cy - 0.118, 1.632)), (0.021, 0.026, 0.033), segs=16)  # nose
    head = finish("Head", bm, ["skin"], M)

    bm = bmesh.new()
    for s in SIDES:
        hand, mid, idx, pk = H(f"hand_{s}"), H(f"middle_01_{s}"), H(f"index_01_{s}"), H(f"pinky_01_{s}")
        along = (mid - hand).normalized()
        width = (pk - idx).normalized()
        width = (width - along * width.dot(along)).normalized()
        palm_c = hand.lerp(mid, 0.55)
        rot = Matrix((along, width, along.cross(width))).transposed().to_4x4()
        rounded_box(bm, palm_c, (0.09, 0.1, 0.04), 0.016, rot=rot)
        for f in ("index", "middle", "ring", "pinky", "thumb"):
            chain = [H(f"{f}_0{i}_{s}") for i in (1, 2, 3)] + [H(f"{f}_04_leaf_{s}")]
            r = 0.0135 if f == "thumb" else 0.0115
            pts = [chain[0] - (chain[1] - chain[0]).normalized() * 0.012] + chain
            tube(bm, pts, [(2 * r, 2 * r)] * len(pts), Z, segs=10, cap1=r)
    hands = finish("Hands", bm, ["skin"], M)

    # ===== Face: eyes, brows, mouth (rigid to head) =====
    bm = bmesh.new()
    face_slots = ["eyes", "brow", "mouth"]
    for s in (-1, 1):
        ellipsoid(bm, Vector((s * 0.046, cy - 0.104, eye_z)), (0.0135, 0.008, 0.02), segs=14)
    n0 = tag(bm, 0, 0)
    for s in (-1, 1):
        rounded_box(bm, Vector((s * 0.047, cy - 0.106, eye_z + 0.037)), (0.042, 0.014, 0.012), 0.004,
                    rot=Euler((0, s * 0.12, 0)).to_matrix().to_4x4(), segs=2)
    n0 = tag(bm, n0, 1)
    mouth_c = Vector((0, cy - 0.104, 1.574))
    ellipsoid(bm, mouth_c, (0.024, 0.006, 0.0035), segs=14)
    tag(bm, n0, 2)
    face = finish("Face", bm, face_slots, M)

    # ===== Hair + moustache (chunky, faceted like the reference) =====
    bm = bmesh.new()
    blocks = [  # centre, size, rotation (x, y, z) in radians
        ((0, 0.015, 1.80), (0.248, 0.236, 0.085), (0, 0, 0)),          # cap
        ((0, 0.1, 1.74), (0.236, 0.06, 0.15), (0.08, 0, 0)),           # back
        ((-0.117, 0.03, 1.745), (0.026, 0.13, 0.09), (0, 0, 0)),       # short sides above the ears
        ((0.117, 0.03, 1.745), (0.026, 0.13, 0.09), (0, 0, 0)),
        ((-0.06, -0.085, 1.81), (0.11, 0.075, 0.068), (-0.35, 0.1, 0.15)),   # front swoop
        ((0.045, -0.09, 1.82), (0.12, 0.075, 0.072), (-0.3, -0.12, -0.12)),
        ((-0.01, -0.045, 1.85), (0.14, 0.11, 0.045), (0.1, 0.05, 0.05)),     # top tuft
        ((0.08, 0.02, 1.835), (0.085, 0.16, 0.045), (0, -0.2, 0)),
    ]
    for c, s, r in blocks:
        rounded_box(bm, Vector(c), s, 0.014, rot=Euler(r).to_matrix().to_4x4(), segs=1)
    pts = [Vector(p) for p in ((-0.058, -0.104, 1.56), (-0.046, -0.114, 1.58), (-0.02, -0.122, 1.592),
                                (0, -0.124, 1.594), (0.02, -0.122, 1.592), (0.046, -0.114, 1.58), (0.058, -0.104, 1.56))]
    tube(bm, pts, [(0.012, 0.012), (0.02, 0.016), (0.024, 0.018), (0.024, 0.018), (0.024, 0.018), (0.02, 0.016), (0.012, 0.012)],
         Z, segs=10, cap0=0.006, cap1=0.006)
    hair = finish("Hair", bm, ["hair"], M, flat=True)

    # ===== Shirt: torso + short sleeves (auto), collar, pocket, buttons (copied weights) =====
    bm = bmesh.new()
    zs = [0.965, 1.05, 1.15, 1.25, 1.33, 1.4, 1.45, 1.48]
    sz = [(0.35, 0.235), (0.35, 0.232), (0.37, 0.238), (0.39, 0.245), (0.405, 0.245), (0.41, 0.238), (0.4, 0.225), (0.37, 0.205)]
    tube(bm, [Vector((0, 0.02, z)) for z in zs], sz, X, n=3.4, segs=36, cap1=0.035, cap_rings=4)
    for s in SIDES:
        sh, el = H(f"upperarm_{s}"), H(f"lowerarm_{s}")
        d = (el - sh).normalized()
        pts = lerp_pts(sh - d * 0.03, sh + d * 0.17, 5)
        tube(bm, pts, [(0.15, 0.145), (0.148, 0.142), (0.142, 0.135), (0.136, 0.128), (0.134, 0.125)], Y, n=2.4, segs=24)
    shirt_body = finish("ShirtBody", bm, ["shirt"], M)

    def shirt_front(z):
        """y of the shirt's front surface at height z (front is -Y)."""
        for (z0, (_, d0)), (z1, (_, d1)) in zip(zip(zs, sz), zip(zs[1:], sz[1:])):
            if z0 <= z <= z1:
                return 0.02 - (d0 + (d1 - d0) * (z - z0) / (z1 - z0)) / 2
        return 0.02 - sz[-1][1] / 2

    bm = bmesh.new()
    tube(bm, lerp_pts(Vector((0, 0.012, 1.455)), Vector((0, 0.008, 1.505)), 3), [(0.135, 0.13)] * 3, X, segs=24)
    for s in (-1, 1):
        rounded_box(bm, Vector((s * 0.038, -0.078, 1.47)), (0.07, 0.012, 0.055), 0.006,
                    rot=Euler((0.55, 0, s * -0.55)).to_matrix().to_4x4(), segs=2)
    collar = finish("Collar", bm, ["shirt"], M)
    bm = bmesh.new()
    rounded_box(bm, Vector((0.095, shirt_front(1.33) - 0.002, 1.33)), (0.072, 0.008, 0.075), 0.005, segs=2)
    pocket = finish("Pocket", bm, ["shirt"], M)
    bm = bmesh.new()
    for z in (1.4, 1.3, 1.2, 1.1):
        bmesh.ops.create_cone(bm, cap_ends=True, segments=12, radius1=0.0085, radius2=0.0085, depth=0.006,
                              matrix=Matrix.Translation((0, shirt_front(z) - 0.002, z)) @ Euler((math.pi / 2, 0, 0)).to_matrix().to_4x4())
    buttons = finish("Buttons", bm, ["buttons"], M)

    # ===== Pants: hips + straight legs (auto) =====
    bm = bmesh.new()
    tube(bm, lerp_pts(Vector((0, 0.022, 0.83)), Vector((0, 0.022, 1.02)), 4), [(0.34, 0.225), (0.345, 0.228), (0.35, 0.23), (0.35, 0.23)], X, n=3.2, segs=32, cap0=0.03)
    for s in SIDES:
        top, knee, ank = H(f"thigh_{s}") + Vector((0, 0, 0.02)), H(f"calf_{s}"), H(f"foot_{s}")
        pts = lerp_pts(top, knee, 7)[:-1] + lerp_pts(knee, ank, 7)
        sizes = [(0.165 - 0.025 * min(1, i / 6), 0.17 - 0.02 * min(1, i / 6)) for i in range(len(pts))]
        tube(bm, pts, sizes, X, n=2.3, segs=24)
    pants = finish("Pants", bm, ["pants"], M)

    # ===== Belt + buckle (rigid pelvis) =====
    bm = bmesh.new()
    tube(bm, lerp_pts(Vector((0, 0.022, 0.985)), Vector((0, 0.022, 1.025)), 3), [(0.36, 0.242)] * 3, X, n=3.2, segs=32)
    n0 = tag(bm, 0, 0)
    rounded_box(bm, Vector((0, -0.1, 1.005)), (0.075, 0.014, 0.042), 0.005, segs=2)
    tag(bm, n0, 1)
    belt = finish("Belt", bm, ["belt", "buckle"], M)

    # ===== Shoes (rigid foot) =====
    bm = bmesh.new()
    for s in SIDES:
        f = H(f"foot_{s}")
        rounded_box(bm, Vector((f.x, -0.065, 0.048)), (0.118, 0.27, 0.095), 0.035, segs=3)
        tube(bm, lerp_pts(Vector((f.x, 0.025, 0.06)), Vector((f.x, 0.03, 0.135)), 3), [(0.12, 0.13)] * 3, X, segs=20)
    shoes = finish("Shoes", bm, ["shoes"], M)

    # ===== Watch (rigid left forearm) =====
    bm = bmesh.new()
    wr, el = H("hand_l"), H("lowerarm_l")
    d = (wr - el).normalized()
    tube(bm, lerp_pts(wr - d * 0.045, wr - d * 0.02, 3), [(0.074, 0.07)] * 3, Y, segs=20)
    rounded_box(bm, wr - d * 0.032 + Z * 0.035, (0.03, 0.036, 0.014), 0.005, segs=2)
    watch = finish("Watch", bm, ["watch"], M)

    # ===== bigger, friendlier head (as in the reference); pivot at the eyes keeps the camera height =====
    pivot = Vector((0, cy, eye_z))
    for ob in (head, face, hair):
        for v in ob.data.vertices:
            v.co = pivot + (v.co - pivot) * HEAD_SCALE
    mouth_c = pivot + (mouth_c - pivot) * HEAD_SCALE

    # ===== skinning =====
    auto_weights([limbs], arm)
    rigid(head, RIG["head"]); bind(head, arm)
    hand_bones = [b.name for b in arm.data.bones
                  if b.name.startswith(("hand_", "index_", "middle_", "ring_", "pinky_", "thumb_")) and "leaf" not in b.name]
    nearest_bone_weights(hands, arm, hand_bones); bind(hands, arm)
    body = join([limbs, head, hands], "Body")

    rigid(face, RIG["head"]); bind(face, arm)
    rigid(hair, RIG["head"]); bind(hair, arm)

    auto_weights([shirt_body], arm)
    for part in (pocket, buttons):
        copy_weights(part, shirt_body); bind(part, arm)
    # the collar rides the neck: it moves with it and vanishes with it in first person
    rigid(collar, RIG["neck"]); bind(collar, arm)
    shirt = join([shirt_body, collar, pocket, buttons], "Shirt")
    # the rest of the shirt follows the torso and arms, not the neck: the neck is
    # collapsed in first person and would drag the shirt into spikes
    neck_g = shirt.vertex_groups[RIG["neck"]]
    collar_vs = {v.index for v in shirt.data.vertices
                 if any(g.group == neck_g.index and g.weight > 0.99 for g in v.groups)}
    for v in shirt.data.vertices:
        if v.index not in collar_vs:
            for g in [g for g in v.groups if shirt.vertex_groups[g.group].name.startswith(("neck", "Head"))]:
                shirt.vertex_groups[g.group].remove([v.index])
    select_only([shirt], shirt)
    bpy.ops.object.vertex_group_normalize_all(lock_active=False)

    auto_weights([pants], arm)
    # trousers follow only hips and legs, otherwise the seat shears when walking
    for g in [g for g in pants.vertex_groups if not g.name.startswith(("pelvis", "thigh_", "calf_", "foot_"))]:
        pants.vertex_groups.remove(g)
    select_only([pants], pants)
    bpy.ops.object.vertex_group_normalize_all(lock_active=False)

    rigid(belt, "pelvis"); bind(belt, arm)
    nearest_bone_weights(shoes, arm, [f"foot_{s}" for s in SIDES], blend=0); bind(shoes, arm)
    rigid(watch, "lowerarm_l"); bind(watch, arm)

    # ===== mouthOpen shape key on Face =====
    face.shape_key_add(name="Basis")
    key = face.shape_key_add(name="mouthOpen")
    mi = face_slots.index("mouth")
    for v in {v for p in face.data.polygons if p.material_index == mi for v in p.vertices}:
        co = key.data[v].co
        key.data[v].co = Vector((mouth_c.x + (co.x - mouth_c.x) * 0.9, co.y, mouth_c.z + (co.z - mouth_c.z) * 6.0 - 0.014))

    # ===== layers as collections =====
    layers = {"Body": body, "Face": face, "Hair": hair, "Shirt": shirt, "Pants": pants, "Belt": belt, "Shoes": shoes, "Watch": watch}
    for coll_name, names in LAYERS.items():
        coll = bpy.data.collections.new(coll_name)
        bpy.context.scene.collection.children.link(coll)
        for n in names:
            ob = layers[n]
            for c in list(ob.users_collection):
                c.objects.unlink(ob)
            coll.objects.link(ob)

    # ===== keep only our clips =====
    keep = {v: k for k, v in RIG["clips"].items()}
    for a in list(bpy.data.actions):
        if a.name in keep:
            a.name, a.use_fake_user = keep[a.name], True
        else:
            bpy.data.actions.remove(a)
    if arm.animation_data:
        arm.animation_data.action = None
    for b in arm.pose.bones:
        b.custom_shape = None
    return list(layers.values()), arm


if __name__ == "__main__":
    meshes, arm = build()
    os.makedirs(BUILD, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(BUILD, "character.blend"))
    export_glb(os.path.join(MODELS, "character.glb"), animations=True, objects=meshes + [arm])
