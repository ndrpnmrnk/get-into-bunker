"""Shared helpers for Blender asset scripts (run with plain python3 + bpy module)."""
import json, os
import bpy

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
ART = os.path.join(ROOT, "art")
BUILD = os.path.join(ART, "build")
MODELS = os.path.join(ROOT, "public", "models")
UAL_GLB = os.path.join(ART, "vendor", "ual", "Universal Animation Library[Standard]", "Unreal-Godot", "UAL1_Standard.glb")
EYE_OFFSET_M = 0.08  # eyes sit this far above the Head bone's base

def load_palette():
    with open(os.path.join(ART, "palette.json")) as f:
        return json.load(f)

def hex_to_rgba(h):
    h = h.lstrip("#")
    srgb = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    lin = [c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in srgb]
    return (*lin, 1.0)

def material(name, palette=None, key=None):
    """Flat material named `name`, coloured from palette `key` (default: name).
    The web app re-skins materials by name."""
    palette = palette or load_palette()
    key = key or name
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = hex_to_rgba(palette[key])
    bsdf.inputs["Roughness"].default_value = 0.9
    m.diffuse_color = hex_to_rgba(palette[key])
    return m

def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)

def import_ual():
    bpy.ops.import_scene.gltf(filepath=UAL_GLB)
    return [o for o in bpy.data.objects if o.type == "ARMATURE"][0]

def export_glb(path, animations, objects=None):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    if objects:
        bpy.ops.object.select_all(action="DESELECT")
        for o in objects:
            o.select_set(True)
    bpy.ops.export_scene.gltf(
        filepath=path, export_format="GLB", use_selection=bool(objects), export_animations=animations,
        export_apply=False, export_yup=True, export_materials="EXPORT",
        export_morph=True, export_skins=True, export_extras=True,
        export_animation_mode="ACTIONS" if animations else "ACTIVE_ACTIONS",
    )
