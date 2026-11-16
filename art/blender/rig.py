"""Extract the UAL skeleton facts and pick the clips we use -> art/build/rig.json."""
import json, os
from common import BUILD, EYE_OFFSET_M, import_ual, reset_scene

WANTED = {  # our key -> UAL action (no root-motion variants)
    "idle": "Idle_Loop", "walk": "Walk_Loop", "jump": "Jump_Loop",
    "crouchIdle": "Crouch_Idle_Loop", "crouchWalk": "Crouch_Fwd_Loop", "sit": "Sitting_Idle_Loop",
}

def main():
    reset_scene()
    arm = import_ual()
    import bpy
    names = [b.name for b in arm.data.bones]
    head = next(n for n in names if n.lower() == "head")
    neck = next(n for n in names if n.lower().startswith("neck"))
    eye_z = (arm.matrix_world @ arm.data.bones[head].head_local).z + EYE_OFFSET_M
    actions = {a.name for a in bpy.data.actions}
    clips = {k: v for k, v in WANTED.items() if v in actions}
    os.makedirs(BUILD, exist_ok=True)
    with open(os.path.join(BUILD, "rig.json"), "w") as f:
        json.dump({"bones": names, "head": head, "neck": neck,
                   "eyeHeightCm": round(eye_z * 100, 1), "clips": clips}, f, indent=1)

if __name__ == "__main__":
    main()
