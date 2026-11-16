"""Mesh-building helpers shared by the asset scripts."""
import math
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




def _se(theta, n):
    """Superellipse point: n=2 ellipse, n≈4 rounded square."""
    c, s = math.cos(theta), math.sin(theta)
    return (math.copysign(abs(c) ** (2 / n), c), math.copysign(abs(s) ** (2 / n), s))


def tube(bm, pts, sizes, side, n=2.0, segs=24, cap0=0.0, cap1=0.0, cap_rings=4):
    """Lofted tube through `pts` with (width, depth) `sizes` per point and a superellipse
    cross-section (exponent n). `side` is the width axis (projected per ring).
    cap0/cap1 > 0 close the ends with rounded domes of that length; 0 = flat cap."""
    side = Vector(side).normalized()
    rings = []
    for i, p in enumerate(pts):
        t = (pts[min(i + 1, len(pts) - 1)] - pts[max(i - 1, 0)]).normalized()
        s = (side - t * side.dot(t)).normalized()
        u = t.cross(s)
        rings.append((p, t, s, u, sizes[i]))

    def ring_verts(p, s, u, w, d):
        return [bm.verts.new(p + s * (w / 2 * x) + u * (d / 2 * y))
                for x, y in (_se(2 * math.pi * k / segs, n) for k in range(segs))]

    def dome(p, t, s, u, w, d, length, sign):
        rs = []
        for k in range(1, cap_rings + 1):
            a = k / (cap_rings + 1) * math.pi / 2
            f = math.cos(a)
            rs.append(ring_verts(p + t * (sign * length * math.sin(a)), s, u, w * f, d * f))
        tip = bm.verts.new(p + t * sign * length)
        return rs, tip

    body = [ring_verts(p, s, u, w, d) for p, t, s, u, (w, d) in rings]
    all_rings = body
    tip0 = tip1 = None
    if cap0 > 0:
        p, t, s, u, (w, d) = rings[0]
        rs, tip0 = dome(p, t, s, u, w, d, cap0, -1)
        all_rings = rs[::-1] + all_rings
    if cap1 > 0:
        p, t, s, u, (w, d) = rings[-1]
        rs, tip1 = dome(p, t, s, u, w, d, cap1, 1)
        all_rings = all_rings + rs
    for r0, r1 in zip(all_rings, all_rings[1:]):
        for k in range(segs):
            bm.faces.new((r0[k], r0[(k + 1) % segs], r1[(k + 1) % segs], r1[k]))
    first, last = all_rings[0], all_rings[-1]
    if tip0:
        for k in range(segs):
            bm.faces.new((first[(k + 1) % segs], first[k], tip0))
    else:
        bm.faces.new(first[::-1])
    if tip1:
        for k in range(segs):
            bm.faces.new((last[k], last[(k + 1) % segs], tip1))
    else:
        bm.faces.new(last)


def rounded_box(bm, center, size, bevel, rot=None, segs=3):
    """Box with rounded edges (bevelled cube)."""
    tmp = bmesh.new()
    bmesh.ops.create_cube(tmp, size=1.0)
    for v in tmp.verts:
        v.co = Vector((v.co.x * size[0], v.co.y * size[1], v.co.z * size[2]))
    bmesh.ops.bevel(tmp, geom=tmp.edges[:] + tmp.verts[:], offset=bevel, segments=segs, affect="EDGES", profile=0.5)
    m = Matrix.Translation(center) @ (rot or Matrix.Identity(4))
    for v in tmp.verts:
        v.co = m @ v.co
    me = bpy.data.meshes.new("_tmp"); tmp.to_mesh(me); tmp.free()
    bm.from_mesh(me); bpy.data.meshes.remove(me)
