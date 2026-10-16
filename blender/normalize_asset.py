"""
Prépare un modèle généré (Tripo3D) pour la scène web : rotation, mise à l'échelle
réelle, origine centrée au sol, export GLB. Peut aussi rendre des vues de contrôle.

    blender -b --factory-startup -P blender/normalize_asset.py -- in.glb out.glb \
        --width 1.0 [--rot-z 90] [--views dossier/]

- La largeur cible (axe X) fixe une échelle uniforme : les proportions du modèle
  sont conservées, on ne déforme pas l'objet pour forcer les trois dimensions.
- Convention glTF de la scène : face avant vers +Z (soit -Y dans Blender).
  `--rot-z` tourne le modèle autour de la verticale avant mise à l'échelle.
"""

import math
import os
import sys

import bpy
from mathutils import Matrix, Vector


def args():
    argv = sys.argv[sys.argv.index("--") + 1 :]
    opts = {"width": 1.0, "rot_z": 0.0, "views": None}
    src, dst = os.path.abspath(argv[0]), os.path.abspath(argv[1])
    i = 2
    while i < len(argv):
        k = argv[i]
        if k == "--width":
            opts["width"] = float(argv[i + 1])
        elif k == "--rot-z":
            opts["rot_z"] = float(argv[i + 1])
        elif k == "--views":
            opts["views"] = os.path.abspath(argv[i + 1])
        i += 2
    return src, dst, opts


def mesh_objects():
    return [o for o in bpy.context.scene.objects if o.type == "MESH"]


def bbox(objs):
    pts = [o.matrix_world @ Vector(c) for o in objs for c in o.bound_box]
    lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    return lo, hi


def render_views(folder, size):
    os.makedirs(folder, exist_ok=True)
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE_NEXT" if "BLENDER_EEVEE_NEXT" in [
        e.identifier for e in bpy.types.RenderSettings.bl_rna.properties["engine"].enum_items
    ] else "BLENDER_EEVEE"
    scene.render.resolution_x = scene.render.resolution_y = 512
    scene.world = scene.world or bpy.data.worlds.new("World")
    scene.world.color = (0.9, 0.92, 0.93)
    sun = bpy.data.objects.new("Sun", bpy.data.lights.new("Sun", "SUN"))
    sun.data.energy = 3
    sun.rotation_euler = (math.radians(50), 0, math.radians(30))
    scene.collection.objects.link(sun)
    cam = bpy.data.objects.new("Cam", bpy.data.cameras.new("Cam"))
    cam.data.type = "ORTHO"
    cam.data.ortho_scale = max(size) * 1.6
    scene.collection.objects.link(cam)
    scene.camera = cam
    centre = Vector((0, 0, size[2] / 2))
    # Vues nommées dans la convention de la scène web (avant = -Y Blender).
    for nom, direction in {
        "avant": Vector((0, -1, 0)),
        "droite": Vector((1, 0, 0)),
        "arriere": Vector((0, 1, 0)),
        "gauche": Vector((-1, 0, 0)),
        "trois-quarts": Vector((0.7, -1, 0.5)).normalized(),
    }.items():
        cam.location = centre + direction * 6
        cam.rotation_euler = (centre - cam.location).to_track_quat("-Z", "Y").to_euler()
        scene.render.filepath = os.path.join(folder, f"{nom}.png")
        bpy.ops.render.render(write_still=True)


def main():
    src, dst, o = args()
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=src)
    objs = mesh_objects()
    if not objs:
        raise SystemExit("aucun mesh dans " + src)

    # Applique toute la hiérarchie importée dans les meshes, puis supprime les parents vides.
    for ob in objs:
        mw = ob.matrix_world.copy()
        ob.parent = None
        ob.matrix_world = mw
    for ob in [x for x in bpy.context.scene.objects if x.type == "EMPTY"]:
        bpy.data.objects.remove(ob)

    rot = Matrix.Rotation(math.radians(o["rot_z"]), 4, "Z")
    for ob in objs:
        ob.matrix_world = rot @ ob.matrix_world

    lo, hi = bbox(objs)
    s = o["width"] / (hi.x - lo.x)
    centre = Vector(((lo.x + hi.x) / 2, (lo.y + hi.y) / 2, lo.z))
    m = Matrix.Scale(s, 4) @ Matrix.Translation(-centre)
    for ob in objs:
        ob.matrix_world = m @ ob.matrix_world
    bpy.ops.object.select_all(action="DESELECT")
    for ob in objs:
        ob.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

    lo, hi = bbox(objs)
    size = hi - lo
    tris = sum(len(p.vertices) - 2 for ob in objs for p in ob.data.polygons)
    print(f"DIMENSIONS largeur={size.x:.3f} profondeur={size.y:.3f} hauteur={size.z:.3f} m, {tris} triangles")

    bpy.ops.export_scene.gltf(filepath=dst, export_format="GLB", use_selection=True, export_yup=True)
    if o["views"]:
        render_views(o["views"], size)


main()
