"""Mesh-building helpers shared by the asset scripts."""
import bpy
import bmesh
from mathutils import Matrix, Vector


# ---------- geometry helpers ----------
def new_obj(name, bm):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(ob)
    return ob


def ellipsoid(bm, center, radii, segs=24, rot=None):
    m = Matrix.Translation(center) @ (rot or Matrix.Identity(4)) @ Matrix.Diagonal((*radii, 1))
    bmesh.ops.create_uvsphere(bm, u_segments=segs, v_segments=segs // 2, radius=1.0, matrix=m)


def capsule(bm, p0, p1, r0, r1=None, segs=16):
    r1 = r0 if r1 is None else r1
    d = p1 - p0
    rot = d.to_track_quat("Z", "Y").to_matrix().to_4x4()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=segs, radius1=r0, radius2=r1,
                          depth=d.length, matrix=Matrix.Translation((p0 + p1) / 2) @ rot)
    ellipsoid(bm, p0, (r0,) * 3, segs)
    ellipsoid(bm, p1, (r1,) * 3, segs)


def apply_mods(ob):
    bpy.context.view_layer.objects.active = ob
    for m in list(ob.modifiers):
        bpy.ops.object.modifier_apply(modifier=m.name)


def soften(ob, voxel, iters, factor=0.6):
    r = ob.modifiers.new("remesh", "REMESH"); r.mode, r.voxel_size = "VOXEL", voxel
    s = ob.modifiers.new("smooth", "SMOOTH"); s.iterations, s.factor = iters, factor
    apply_mods(ob)


def cut(ob, co, no):
    """Remove the part of the mesh on the +no side of the plane."""
    bm = bmesh.new(); bm.from_mesh(ob.data)
    bmesh.ops.bisect_plane(bm, geom=bm.verts[:] + bm.edges[:] + bm.faces[:],
                           plane_co=co, plane_no=no, clear_outer=True)
    bm.to_mesh(ob.data); bm.free()


def thicken(ob, t):
    m = ob.modifiers.new("sol", "SOLIDIFY"); m.thickness, m.offset = t, 1.0
    apply_mods(ob)


def decimate(ob, target_tris):
    tris = sum(len(p.vertices) - 2 for p in ob.data.polygons)
    if tris > target_tris:
        m = ob.modifiers.new("dec", "DECIMATE"); m.ratio = target_tris / tris
        apply_mods(ob)


def select_only(obs, active):
    bpy.ops.object.select_all(action="DESELECT")
    for o in obs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = active


