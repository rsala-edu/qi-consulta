"""
Genera el cos 3D de l'app amb MakeHuman (MPFB2) dins Blender, sense interfície.

    BLENDER_USER_RESOURCES=<carpeta amb MPFB instal·lat> \
      blender -b --factory-startup --python eines/blender/generar_cos.py -- <sortida.glb> <articulacions.json>

- Adult de proporcions mitjanes: els valors per defecte de MakeHuman (0,5).
- Exporta només la pell (sense ulls, dents, cabells ni geometria auxiliar),
  sense UV, materials, esquelet ni shape keys, amb Y amunt (convenció glTF).
- Desa a part el centre de cada articulació de MakeHuman (genoll, canell,
  falanges…): són les referències per calcular els punts amb cun.

Coordenades de sortida (glTF): metres, Y amunt, el cos mira cap a +Z i
l'esquerra del pacient és +X.
"""

import json
import sys

import bpy
from mathutils import Vector

args = sys.argv[sys.argv.index("--") + 1 :]
SORTIDA_GLB, SORTIDA_JSON = args[0], args[1]

# Activar MPFB (amb --factory-startup no ho està) i començar amb l'escena buida
bpy.ops.preferences.addon_enable(module="bl_ext.user_default.mpfb")
for obj in list(bpy.data.objects):
    bpy.data.objects.remove(obj, do_unlink=True)

from bl_ext.user_default.mpfb.services.humanservice import HumanService  # noqa: E402
from bl_ext.user_default.mpfb.services.targetservice import TargetService  # noqa: E402

macros = TargetService.get_default_macro_info_dict()  # adult, proporcions mitjanes
cos = HumanService.create_human(
    mask_helpers=True, detailed_helpers=True, extra_vertex_groups=True, feet_on_ground=True, scale=0.1,
    macro_detail_dict=macros,
)
TargetService.bake_targets(cos)  # aplica les deformacions a la malla

# Blender (Z amunt, mira cap a −Y) → glTF (Y amunt, mira cap a +Z)
def a_gltf(v):
    return [round(v.x, 6), round(v.z, 6), round(-v.y, 6)]

malla = cos.data
noms = {g.index: g.name for g in cos.vertex_groups}
sumes, comptes = {}, {}
for v in malla.vertices:
    for g in v.groups:
        nom = noms[g.group]
        if nom.startswith("joint-"):
            sumes[nom] = sumes.get(nom, Vector()) + cos.matrix_world @ v.co
            comptes[nom] = comptes.get(nom, 0) + 1
articulacions = {nom[len("joint-"):]: a_gltf(sumes[nom] / comptes[nom]) for nom in sorted(sumes)}

# Treure la geometria auxiliar (aplicar la màscara «body»)
bpy.context.view_layer.objects.active = cos
for mod in list(cos.modifiers):
    bpy.ops.object.modifier_apply(modifier=mod.name)
cos.vertex_groups.clear()
for uv in list(malla.uv_layers):
    malla.uv_layers.remove(uv)
bpy.ops.object.shade_smooth()
cos.name = "cos"
malla.name = "cos"

bpy.ops.object.select_all(action="DESELECT")
cos.select_set(True)
bpy.ops.export_scene.gltf(
    filepath=SORTIDA_GLB,
    export_format="GLB",
    use_selection=True,
    export_yup=True,
    export_apply=True,
    export_texcoords=False,
    export_normals=True,
    export_tangents=False,
    export_materials="NONE",
    export_morph=False,
    export_skins=False,
    export_animations=False,
    export_extras=False,
)

dims = cos.dimensions
info = {
    "font": "MakeHuman (MPFB2), CC0",
    "macros": {k: v for k, v in macros.items() if k != "race"},
    "alcada_m": round(dims.z, 4),
    "vertexs": len(malla.vertices),
    "triangles": sum(len(p.vertices) - 2 for p in malla.polygons),
    "articulacions": articulacions,
}
with open(SORTIDA_JSON, "w") as f:
    json.dump(info, f, indent=1, ensure_ascii=False)
print("FET", SORTIDA_GLB, info["alcada_m"], info["vertexs"], info["triangles"], len(articulacions))
