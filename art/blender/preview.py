"""Workbench preview renders of a .blend: front, side, 3/4 -> art/build/<name>_preview.png"""
import math, os, subprocess, sys
import bpy
from mathutils import Vector
from common import BUILD

blend, name = sys.argv[-2], sys.argv[-1]
bpy.ops.wm.open_mainfile(filepath=blend)
sc = bpy.context.scene
sc.render.engine = "BLENDER_WORKBENCH"
sh = sc.display.shading
sh.light, sh.color_type, sh.show_object_outline = "STUDIO", "MATERIAL", True
sh.show_cavity = False
sc.render.resolution_x, sc.render.resolution_y = 520, 720
sc.render.film_transparent = False
sc.world = sc.world or bpy.data.worlds.new("w")
cam_data = bpy.data.cameras.new("cam"); cam_data.lens = 70
cam = bpy.data.objects.new("cam", cam_data); sc.collection.objects.link(cam); sc.camera = cam
target = Vector((0, 0, 0.95))
arm = next((o for o in bpy.data.objects if o.type == "ARMATURE"), None)
if arm and len(sys.argv) > 3 and sys.argv[-3] in bpy.data.actions:
    arm.animation_data_create(); act = bpy.data.actions[sys.argv[-3]]
    arm.animation_data.action = act
    if act.slots: arm.animation_data.action_slot = act.slots[0]
    sc.frame_set(int(act.frame_range[0] + 5))
outs = []
for i, ang in enumerate((0, 90, 35)):
    a = math.radians(ang)
    cam.location = target + Vector((4.2 * math.sin(a), -4.2 * math.cos(a), 0.35))
    cam.rotation_euler = (target - cam.location).to_track_quat("-Z", "Y").to_euler()
    out = f"/tmp/pv_{i}.png"; sc.render.filepath = out; bpy.ops.render.render(write_still=True); outs.append(out)
dst = os.path.join(BUILD, f"{name}_preview.png")
subprocess.run(["ffmpeg", "-v", "error", "-y", *sum([["-i", o] for o in outs], []), "-filter_complex", "hstack=inputs=3", dst], check=True)
print("WROTE", dst)
