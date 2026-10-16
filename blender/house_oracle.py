"""
Oracle de surfaces : reconstruit chaque maison de fixtures/cases.json dans Blender,
face par face, à partir de coordonnées 3D, et mesure les aires avec bmesh.

Implémentation volontairement indépendante de src/lib/house (pas de repères 2D,
pas de formule du lacet, axe vertical z) : si les deux concordent, le calcul est fiable.

    blender -b --factory-startup -P blender/house_oracle.py -- fixtures/cases.json fixtures/oracle.json [--blend out.blend]

Fonctionne aussi depuis le MCP Blender (execute_blender_code) en appelant run(cases, out).
"""

import json
import math
import sys

import bmesh
import bpy

FENETRE = (1.2, 1.35)  # largeur, hauteur
ALLEGE = 0.9
PORTE = (0.9, 2.15)


def build(name, p):
    L, W = p["longueur"], p["largeur"]
    hx, hy = L / 2, W / 2
    H = p["niveaux"] * p["hauteurSousPlafond"]
    h = 0.0 if p["toiture"] == "plate" else hy * math.tan(math.radians(p["pente"]))
    mitoyennes = ["est", "ouest"][: p["mitoyens"]]

    bm = bmesh.new()
    kind_layer = bm.faces.layers.string.new("kind")
    faces = []  # (kind, mitoyen, face)

    def face(kind, pts, mitoyen=False):
        f = bm.faces.new([bm.verts.new(v) for v in pts])
        f[kind_layer] = kind.encode()
        faces.append((kind, mitoyen, f))

    # Murs : sud y = -hy, nord y = +hy, est x = +hx, ouest x = -hx.
    murs = {
        "sud": ((-hx, -hy), (hx, -hy)),
        "nord": ((hx, hy), (-hx, hy)),
        "est": ((hx, -hy), (hx, hy)),
        "ouest": ((-hx, hy), (-hx, -hy)),
    }
    for f, ((x0, y0), (x1, y1)) in murs.items():
        face("mur", [(x0, y0, 0), (x1, y1, 0), (x1, y1, H), (x0, y0, H)], f in mitoyennes)

        # Ouvertures : quads coplanaires, réparties régulièrement le long de la façade.
        longueur = math.hypot(x1 - x0, y1 - y0)
        ux, uy = (x1 - x0) / longueur, (y1 - y0) / longueur
        for niveau in range(p["niveaux"]):
            items = [("fenetre", FENETRE, ALLEGE)] * p["fenetresParNiveau"][f]
            if f == "sud" and niveau == 0:
                items = items + [("porte", PORTE, 0.0)]
            pas = longueur / (len(items) + 1) if items else 0
            for i, (kind, (w, ht), z0) in enumerate(items):
                c = pas * (i + 1)
                a, b = c - w / 2, c + w / 2
                z = niveau * p["hauteurSousPlafond"] + z0
                face(
                    kind,
                    [
                        (x0 + ux * a, y0 + uy * a, z),
                        (x0 + ux * b, y0 + uy * b, z),
                        (x0 + ux * b, y0 + uy * b, z + ht),
                        (x0 + ux * a, y0 + uy * a, z + ht),
                    ],
                )

    # Toiture.
    if p["toiture"] == "plate":
        face("toiture-terrasse", [(-hx, -hy, H), (hx, -hy, H), (hx, hy, H), (-hx, hy, H)])
    else:
        r = hy if p["toiture"] == "quatre-pans" else 0.0  # retrait du faîtage
        fa, fb = (-hx + r, 0, H + h), (hx - r, 0, H + h)  # extrémités du faîtage
        face("rampant", [(-hx, -hy, H), (hx, -hy, H), fb, fa])
        face("rampant", [(hx, hy, H), (-hx, hy, H), fa, fb])
        if p["toiture"] == "quatre-pans":
            face("rampant", [(hx, -hy, H), (hx, hy, H), fb])
            face("rampant", [(-hx, hy, H), (-hx, -hy, H), fa])
        else:
            face("pignon", [(hx, -hy, H), (hx, hy, H), (hx, 0, H + h)], "est" in mitoyennes)
            face("pignon", [(-hx, hy, H), (-hx, -hy, H), (-hx, 0, H + h)], "ouest" in mitoyennes)
        face("plancher-combles", [(-hx, -hy, H), (hx, -hy, H), (hx, hy, H), (-hx, hy, H)])

    face("plancher-bas", [(-hx, -hy, 0), (-hx, hy, 0), (hx, hy, 0), (hx, -hy, 0)])

    t = {
        "mursBruts": 0.0,
        "mursMitoyens": 0.0,
        "ouvertures": 0.0,
        "fenetres": 0.0,
        "nbFenetres": 0,
        "pignons": 0.0,
        "rampants": 0.0,
        "plancherCombles": 0.0,
        "toitureTerrasse": 0.0,
        "plancherBas": 0.0,
    }
    for kind, mitoyen, f in faces:
        a = f.calc_area()
        if kind == "mur":
            t["mursBruts"] += a
            if mitoyen:
                t["mursMitoyens"] += a
        elif kind in ("fenetre", "porte"):
            t["ouvertures"] += a
            if kind == "fenetre":
                t["fenetres"] += a
                t["nbFenetres"] += 1
        elif kind == "pignon":
            if not mitoyen:
                t["pignons"] += a
        elif kind == "rampant":
            t["rampants"] += a
        elif kind == "plancher-combles":
            t["plancherCombles"] += a
        elif kind == "toiture-terrasse":
            t["toitureTerrasse"] += a
        elif kind == "plancher-bas":
            t["plancherBas"] += a
    # Toutes les ouvertures sont sur des murs non mitoyens (garanti par la validation).
    t["mursNets"] = t["mursBruts"] - t["mursMitoyens"] - t["ouvertures"]

    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    return obj, {k: round(v, 6) if isinstance(v, float) else v for k, v in t.items()}


def run(cases_path, out_path, blend_path=None):
    with open(cases_path, encoding="utf-8") as fh:
        cases = json.load(fh)
    result = {}
    for i, (name, params) in enumerate(cases.items()):
        obj, totals = build(name, params)
        obj.location.x = i * 25  # côte à côte, pour inspection visuelle dans le .blend
        result[name] = totals
    with open(out_path, "w", encoding="utf-8") as fh:
        json.dump({"generator": f"Blender {bpy.app.version_string}", "cases": result}, fh, indent=2, ensure_ascii=False)
        fh.write("\n")
    if blend_path:
        bpy.ops.wm.save_as_mainfile(filepath=blend_path)
    return result


if __name__ == "__main__":
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    if len(argv) < 2:
        raise SystemExit("usage : blender -b -P house_oracle.py -- cases.json oracle.json [--blend out.blend]")
    blend = argv[argv.index("--blend") + 1] if "--blend" in argv else None
    for name, t in run(argv[0], argv[1], blend).items():
        print(f"{name}: {t}")
