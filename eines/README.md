# Eines

## Generar el cos 3D (`blender/generar_cos.py`)

Crea `public/models/cos.glb` i `src/punts/articulacions.json` amb MakeHuman
(MPFB) dins Blender, sense interfície. Cal Blender 4.2 o posterior amb
l'extensió MPFB instal·lada en una carpeta de recursos pròpia:

```sh
export BLENDER_USER_RESOURCES=/ruta/recursos-blender
blender -b --factory-startup --offline-mode --command extension install-file -r user_default -e mpfb.zip
blender -b --factory-startup --offline-mode --python eines/blender/generar_cos.py -- \
  public/models/cos.glb src/punts/articulacions.json
```

Si es canvien els paràmetres del cos (sexe, alçada, complexió) però no la
malla, la topologia es manté i els punts calibrats el segueixen.

## Calcular els punts (`calcular-punts.ts`)

```sh
npm run punts:calcular
```

Calcula cada punt amb la seva regla (`src/punts/oms/regles.ts`) sobre el cos
i escriu les posicions a `src/punts/cataleg.json`. Conserva les correccions de
la doctora. Les proves (`src/punts/oms/oms.test.ts`) comproven que el catàleg
està al dia i que cada punt compleix la regla, la simetria i l'ordre.
