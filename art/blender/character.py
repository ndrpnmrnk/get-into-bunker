"""Base character modelled directly on the UAL skeleton -> public/models/character.glb.

Soft "inflated" forms: ellipsoids/capsules along the bones are fused by a voxel remesh
and smoothed. Clothes are separate shells cut by planes (clean hems). Everything is
joined into one skinned mesh: the body gets automatic weights, hands get nearest-bone
weights (fingers are too thin for heat weighting), and clothes/hair/face copy weights
from the body.
"""
import json, os
import bpy
import bmesh
from mathutils import Matrix, Vector
from mathutils.geometry import intersect_point_line
from shapes import apply_mods, capsule, cut, decimate, ellipsoid, new_obj, select_only, soften, thicken
from common import BUILD, EYE_OFFSET_M, MODELS, export_glb, import_ual, material, reset_scene

RIG = json.load(open(os.path.join(BUILD, "rig.json")))
SIDES = ("l", "r")
SLOTS = ("skin", "shirt", "shorts", "shoes", "hair", "eyeWhite", "pupil", "mouth")
DEFAULT_KEY = {"skin": "skin1", "shirt": "shirt1", "shorts": "shorts1", "hair": "hair1"}


def set_material(ob, mats, slot):
    ob.data.materials.clear()
    for n in SLOTS:
        ob.data.materials.append(mats[n])
    i = SLOTS.index(slot)
    for p in ob.data.polygons:
        p.material_index = i


# ---------- weights ----------
def nearest_bone_weights(ob, arm, bones):
    """Each vertex goes to its nearest bone segment, blended with the second nearest
    when they are almost equally close (smooth knuckles)."""
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
        (d0, n0), (d1, n1) = ds[0], ds[1]
        w1 = max(0.0, 0.5 - (d1 - d0) / 0.02)  # blend only within 1 cm of a tie
        groups[n0].add([v.index], 1 - w1, "REPLACE")
        if w1 > 0:
            groups[n1].add([v.index], w1, "ADD")


def copy_weights(dst, src):
    m = dst.modifiers.new("dt", "DATA_TRANSFER")
    m.object, m.use_vert_data, m.data_types_verts = src, True, {"VGROUP_WEIGHTS"}
    m.vert_mapping = "POLYINTERP_NEAREST"
    m.layers_vgroup_select_src, m.layers_vgroup_select_dst = "ALL", "NAME"
    bpy.context.view_layer.objects.active = dst
    bpy.ops.object.datalayout_transfer(modifier=m.name)
    apply_mods(dst)


def build():
    reset_scene()
    arm = import_ual()
    for o in [o for o in bpy.data.objects if o.type == "MESH"]:
        bpy.data.objects.remove(o)
    W = arm.matrix_world
    H = lambda n: W @ arm.data.bones[n].head_local
    head_base = H(RIG["head"])
    front = 1.0 if (H("ball_l") - H("foot_l")).y > 0 else -1.0
    F = Vector((0, front, 0))
    up = Vector((0, 0, 1))
    mats = {n: material(n, key=DEFAULT_KEY.get(n)) for n in SLOTS}

    pelvis, chest = H("pelvis"), H("spine_03")
    torso_c = pelvis.lerp(chest, 0.5) + Vector((0, 0, 0.03))
    torso_r = (0.185, 0.14, (chest.z - pelvis.z) / 2 + 0.13)
    head_c = head_base + Vector((0, 0, 0.13))
    head_r = (0.2, 0.185, 0.205)
    waist_z = H("spine_01").z + 0.01
    knee_z = H("calf_l").z
    hem_z = knee_z + (H("thigh_l").z - knee_z) * 0.4
    sleeve = {s: H(f"upperarm_{s}").lerp(H(f"lowerarm_{s}"), 0.5) for s in SIDES}

    def torso(bm, grow=0.0):
        ellipsoid(bm, torso_c, tuple(r + grow for r in torso_r), segs=32)
        for s in SIDES:
            capsule(bm, H(f"clavicle_{s}").lerp(H(f"upperarm_{s}"), 0.3), H(f"upperarm_{s}"), 0.085 + grow, 0.08 + grow)

    def arms(bm, grow=0.0, upper_only=False):
        for s in SIDES:
            capsule(bm, H(f"upperarm_{s}"), H(f"lowerarm_{s}"), 0.075 + grow, 0.068 + grow)
            if not upper_only:
                capsule(bm, H(f"lowerarm_{s}"), H(f"hand_{s}"), 0.066, 0.056)

    def legs(bm, grow=0.0, upper_only=False):
        for s in SIDES:
            capsule(bm, H(f"thigh_{s}"), H(f"calf_{s}"), 0.1 + grow, 0.072 + grow)
            if not upper_only:
                capsule(bm, H(f"calf_{s}"), H(f"foot_{s}"), 0.072, 0.062)

    # ---- body (skin) ----
    bm = bmesh.new()
    torso(bm); arms(bm); legs(bm)
    ellipsoid(bm, pelvis + Vector((0, 0, 0.02)), (0.18, 0.135, 0.14))
    capsule(bm, H("neck_01"), head_base + Vector((0, 0, 0.05)), 0.075)
    ellipsoid(bm, head_c, head_r, segs=40)
    body = new_obj("Body", bm)
    soften(body, 0.011, 10)
    decimate(body, 7000)
    set_material(body, mats, "skin")

    # ---- shoes ----
    bm = bmesh.new()
    for s in SIDES:
        heel = H(f"foot_{s}") - F * 0.06 - up * 0.055
        toe = Vector((H(f"ball_{s}").x, H(f"ball_{s}").y + front * 0.07, heel.z + 0.005))
        capsule(bm, heel, toe, 0.07, 0.068)
        ellipsoid(bm, H(f"foot_{s}") - up * 0.01, (0.08, 0.08, 0.06))
    shoes = new_obj("Shoes", bm)
    soften(shoes, 0.008, 6)
    cut(shoes, Vector((0, 0, H("foot_l").z + 0.05)), up)
    thicken(shoes, 0.004)
    decimate(shoes, 700)
    set_material(shoes, mats, "shoes")

    # ---- shirt shell: torso + short sleeves, hem over the shorts ----
    bm = bmesh.new()
    torso(bm, 0.014); arms(bm, 0.014, upper_only=True)
    shirt = new_obj("Shirt", bm)
    soften(shirt, 0.01, 14)
    cut(shirt, Vector((0, 0, waist_z - 0.06)), -up)
    for s in SIDES:
        d = (H(f"lowerarm_{s}") - H(f"upperarm_{s}")).normalized()
        cut(shirt, sleeve[s], d)
    thicken(shirt, 0.006)
    decimate(shirt, 3600)
    set_material(shirt, mats, "shirt")

    # ---- shorts shell ----
    bm = bmesh.new()
    ellipsoid(bm, pelvis + Vector((0, 0, 0.02)), (0.19, 0.145, 0.15))
    legs(bm, 0.012, upper_only=True)
    shorts = new_obj("Shorts", bm)
    soften(shorts, 0.01, 8)
    cut(shorts, Vector((0, 0, waist_z + 0.02)), up)
    cut(shorts, Vector((0, 0, hem_z)), -up)
    thicken(shorts, 0.006)
    decimate(shorts, 2400)
    set_material(shorts, mats, "shorts")

    # ---- hands: palm + 3 fingers + thumb ----
    bm = bmesh.new()
    for s in SIDES:
        hand, mid = H(f"hand_{s}"), H(f"middle_01_{s}")
        d = (mid - hand).normalized()
        rot = d.to_track_quat("X", "Z").to_matrix().to_4x4()
        ellipsoid(bm, hand.lerp(mid, 0.5), (0.062, 0.05, 0.03), rot=rot)
        for fng, r in (("index", 0.016), ("middle", 0.017), ("ring", 0.016), ("thumb", 0.018)):
            chain = [H(f"{fng}_0{i}_{s}") for i in (1, 2, 3)] + [H(f"{fng}_04_leaf_{s}")]
            for a, b in zip(chain, chain[1:]):
                capsule(bm, a, b, r, r * 0.95, segs=12)
    hands = new_obj("Hands", bm)
    soften(hands, 0.004, 3, 0.5)
    decimate(hands, 1900)
    set_material(hands, mats, "skin")

    # ---- face + hair ----
    eye_z = head_base.z + EYE_OFFSET_M
    face_y = head_c.y + front * head_r[1]
    bm = bmesh.new()
    for x in (-0.07, 0.07):
        ellipsoid(bm, Vector((x, face_y - front * 0.022, eye_z)), (0.05, 0.03, 0.058), segs=24)
    eyes = new_obj("Eyes", bm); set_material(eyes, mats, "eyeWhite")
    bm = bmesh.new()
    for x in (-0.064, 0.064):
        ellipsoid(bm, Vector((x, face_y + front * 0.006, eye_z - 0.006)), (0.022, 0.01, 0.027), segs=16)
    pupils = new_obj("Pupils", bm); set_material(pupils, mats, "pupil")
    mouth_z = head_base.z + 0.025
    dz = (mouth_z - head_c.z) / head_r[2]
    surf = head_r[1] * (1 - dz * dz) ** 0.5  # face surface depth at mouth height
    mouth_c = Vector((0, head_c.y + front * (surf - 0.008), mouth_z))
    bm = bmesh.new()
    ellipsoid(bm, mouth_c, (0.04, 0.016, 0.0045), segs=20)  # closed: a thin line
    mouth = new_obj("Mouth", bm); set_material(mouth, mats, "mouth")

    bm = bmesh.new()
    ellipsoid(bm, head_c + Vector((0, -front * 0.01, 0.015)), tuple(r + 0.016 for r in head_r), segs=48)
    hair = new_obj("Hair", bm)
    p_front = Vector((0, face_y, eye_z + 0.075))
    p_back = Vector((0, head_c.y - front * head_r[1], head_base.z + 0.02))
    n = (p_front - p_back).cross(Vector((1, 0, 0))).normalized()
    cut(hair, p_back, n if n.z < 0 else -n)
    thicken(hair, 0.012)
    soften(hair, 0.006, 4, 0.5)
    decimate(hair, 1000)
    set_material(hair, mats, "hair")

    # ---- skinning ----
    select_only([body, arm], arm)
    bpy.ops.object.parent_set(type="ARMATURE_AUTO")
    hand_bones = [b.name for b in arm.data.bones
                  if b.name.startswith(("hand_", "lowerarm_", "index_", "middle_", "ring_", "thumb_"))
                  and "leaf" not in b.name]
    nearest_bone_weights(hands, arm, hand_bones)
    nearest_bone_weights(shoes, arm, [f"foot_{s}" for s in SIDES])  # shoes are rigid blocks
    for ob in (shirt, shorts, eyes, pupils, mouth, hair):
        copy_weights(ob, body)
    # shorts follow only the hips and thighs, otherwise the seat shears when walking
    for g in [g for g in shorts.vertex_groups if not g.name.startswith(("pelvis", "thigh_"))]:
        shorts.vertex_groups.remove(g)
    bpy.context.view_layer.objects.active = shorts
    bpy.ops.object.vertex_group_normalize_all(lock_active=False)
    for ob in (eyes, pupils, mouth):  # face parts ride the head rigidly
        for g in list(ob.vertex_groups):
            ob.vertex_groups.remove(g)
        ob.vertex_groups.new(name=RIG["head"]).add(range(len(ob.data.vertices)), 1.0, "REPLACE")
    select_only([body, shoes, shirt, shorts, hands, eyes, pupils, mouth, hair], body)
    bpy.ops.object.join()
    bpy.ops.object.shade_smooth()

    # ---- mouthOpen shape key ----
    body.shape_key_add(name="Basis")
    key = body.shape_key_add(name="mouthOpen")
    mi = SLOTS.index("mouth")
    for v in {v for p in body.data.polygons if p.material_index == mi for v in p.vertices}:
        co = key.data[v].co
        key.data[v].co = Vector((mouth_c.x + (co.x - mouth_c.x) * 1.0, co.y,
                                 mouth_c.z + (co.z - mouth_c.z) * 5.0 - 0.012))

    # ---- keep only our clips, renamed to our keys ----
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
    body.name = "Body"
    return body, arm


if __name__ == "__main__":
    body, arm = build()
    os.makedirs(BUILD, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(BUILD, "character.blend"))
    export_glb(os.path.join(MODELS, "character.glb"), animations=True, objects=[body, arm])
