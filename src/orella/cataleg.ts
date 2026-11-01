// Punts de l'orella de l'estàndard xinès GB/T 13734-2008 (escola xinesa
// d'auriculoteràpia): els 84 de la cara lateral, agrupats per zones. Els 9
// de la cara posterior i de l'arrel de l'orella encara no hi són.
//
// Cada punt té el codi de l'estàndard (zona i àrea: «HX6,7i» és entre les
// àrees 6 i 7 de l'hèlix), el nom en català, el pinyin, els caràcters i una
// descripció de la localització redactada per nosaltres. La posició (x, y)
// és sobre el dibuix de l'orella esquerra (src/orella/dibuix.ts).

import { z } from 'zod'
import { ZONES_ORELLA, type ZonaOrella } from './dibuix'

export const CODI_ORELLA = /^(HX|SF|AH|TF|TG|AT|CO|LO)\d{1,2}([a-z]|(,\d{1,2})+i?)?$/

export const esquemaPuntOrella = z.object({
  codi: z.string().regex(CODI_ORELLA),
  zona: z.enum(ZONES_ORELLA),
  nom: z.string().min(1),
  pinyin: z.string().min(1),
  hanzi: z.string().min(1),
  localitzacio: z.string().min(15),
  /** Posició sobre el dibuix de l'orella esquerra */
  x: z.number(),
  y: z.number(),
  /** A la cara interna del tragus o de l'antitragus: al dibuix, a la vora */
  caraInterna: z.literal(true).optional(),
})

export type PuntOrella = z.infer<typeof esquemaPuntOrella>

export const NOMS_ZONES: Record<ZonaOrella, string> = {
  HX: 'Hèlix',
  SF: 'Escafa',
  AH: 'Antihèlix',
  TF: 'Fossa triangular',
  TG: 'Tragus',
  AT: 'Antitragus',
  CO: 'Conca',
  LO: 'Lòbul',
}

type Fila = [codi: string, nom: string, pinyin: string, hanzi: string, x: number, y: number, localitzacio: string]

const fila = (zona: ZonaOrella, f: Fila, caraInterna = false): PuntOrella => ({
  codi: f[0],
  zona,
  nom: f[1],
  pinyin: f[2],
  hanzi: f[3],
  x: f[4],
  y: f[5],
  localitzacio: f[6],
  ...(caraInterna ? { caraInterna: true as const } : {}),
})

const HX: Fila[] = [
  ['HX1', 'Centre de l\'orella', 'Erzhong', '耳中', 128, 188, 'Sobre la rel de l\'hèlix, la carena que entra dins la conca.'],
  ['HX2', 'Recte', 'Zhichang', '直肠', 82, 163, 'A l\'hèlix, just per sobre de l\'escotadura de la rel, al terç de baix del tram que puja fins a l\'arrel inferior de l\'antihèlix.'],
  ['HX3', 'Uretra', 'Niaodao', '尿道', 79, 149, 'A l\'hèlix, al terç del mig del tram entre la rel de l\'hèlix i l\'arrel inferior de l\'antihèlix.'],
  ['HX4', 'Genitals externs', 'Waishengzhiqi', '外生殖器', 79, 135, 'A l\'hèlix, al terç de dalt del tram entre la rel de l\'hèlix i l\'arrel inferior de l\'antihèlix.'],
  ['HX5', 'Anus', 'Gangmen', '肛门', 96, 92, 'A l\'hèlix, davant de la fossa triangular: entre l\'arrel inferior i l\'arrel superior de l\'antihèlix.'],
  ['HX6', 'Davant de l\'àpex', 'Erjianqian', '耳尖前', 188, 28, 'A l\'hèlix, entre la vora de davant de l\'arrel superior de l\'antihèlix i l\'àpex de l\'orella.'],
  ['HX6,7i', 'Àpex de l\'orella', 'Erjian', '耳尖', 208, 26, 'A la punta de l\'orella, on queda el plec en doblegar l\'hèlix endavant.'],
  ['HX7', 'Darrere de l\'àpex', 'Erjianhou', '耳尖后', 246, 42, 'A l\'hèlix, entre l\'àpex i la vora de dalt del tubercle.'],
  ['HX8', 'Tubercle', 'Jiejie', '结节', 275, 96, 'Al tubercle de l\'hèlix (tubercle de Darwin), a la part de darrere i de dalt de la vora.'],
  ['HX9', 'Hèlix 1', 'Lun 1', '轮1', 277, 146, 'A l\'hèlix, sota el tubercle: primera de les quatre parts iguals fins a l\'escotadura amb el lòbul.'],
  ['HX10', 'Hèlix 2', 'Lun 2', '轮2', 273, 200, 'A l\'hèlix, segona de les quatre parts entre el tubercle i el lòbul.'],
  ['HX11', 'Hèlix 3', 'Lun 3', '轮3', 263, 252, 'A l\'hèlix, tercera de les quatre parts entre el tubercle i el lòbul.'],
  ['HX12', 'Hèlix 4', 'Lun 4', '轮4', 246, 292, 'A l\'hèlix, darrera de les quatre parts, just abans de l\'escotadura amb el lòbul.'],
]

const SF: Fila[] = [
  ['SF1', 'Dits', 'Zhi', '指', 232, 62, 'A dalt de tot de l\'escafa: la primera de les sis parts iguals, de dalt a baix.'],
  ['SF1,2i', 'Rierol del vent', 'Fengxi', '风溪', 242, 88, 'A l\'escafa, entre la zona dels dits i la del canell, davant del tubercle de l\'hèlix.'],
  ['SF2', 'Canell', 'Wan', '腕', 250, 112, 'A l\'escafa, segona de les sis parts iguals.'],
  ['SF3', 'Colze', 'Zhou', '肘', 256, 156, 'A l\'escafa, tercera de les sis parts iguals.'],
  ['SF4,5', 'Espatlla', 'Jian', '肩', 251, 224, 'A l\'escafa, a la quarta i la cinquena de les sis parts iguals.'],
  ['SF6', 'Clavícula', 'Suogu', '锁骨', 227, 298, 'A baix de tot de l\'escafa, la sisena part, a prop de l\'escotadura entre l\'antihèlix i l\'antitragus.'],
]

const AH: Fila[] = [
  ['AH1', 'Taló', 'Gen', '跟', 186, 50, 'A dalt de l\'arrel superior de l\'antihèlix, a la meitat de davant.'],
  ['AH2', 'Dits del peu', 'Zhi', '趾', 202, 48, 'A dalt de l\'arrel superior de l\'antihèlix, a la meitat de darrere.'],
  ['AH3', 'Turmell', 'Huai', '踝', 199, 68, 'A l\'arrel superior de l\'antihèlix, sota el taló i els dits del peu (meitat de baix del terç de dalt).'],
  ['AH4', 'Genoll', 'Xi', '膝', 210, 95, 'Al terç del mig de l\'arrel superior de l\'antihèlix.'],
  ['AH5', 'Maluc', 'Kuan', '髋', 222, 132, 'Al terç de baix de l\'arrel superior de l\'antihèlix.'],
  ['AH6', 'Nervi ciàtic', 'Zuogushenjing', '坐骨神经', 140, 137, 'Als dos terços de davant de l\'arrel inferior de l\'antihèlix.'],
  ['AH6a', 'Simpàtic', 'Jiaogan', '交感', 106, 138, 'A la punta de l\'arrel inferior de l\'antihèlix, on es fica sota la vora de l\'hèlix.'],
  ['AH7', 'Natja', 'Tun', '臀', 196, 148, 'Al terç de darrere de l\'arrel inferior de l\'antihèlix.'],
  ['AH8', 'Abdomen', 'Fu', '腹', 225, 194, 'Al cos de l\'antihèlix, als dos cinquens de dalt, al quart de davant (vora de la conca).'],
  ['AH9', 'Vertebres lumbosacres', 'Yaodizhui', '腰骶椎', 236, 198, 'Al cos de l\'antihèlix, als dos cinquens de dalt, als tres quarts de darrere.'],
  ['AH10', 'Tòrax', 'Xiong', '胸', 216, 244, 'Al cos de l\'antihèlix, als dos cinquens del mig, al quart de davant.'],
  ['AH11', 'Vertebres toràciques', 'Xiongzhui', '胸椎', 229, 250, 'Al cos de l\'antihèlix, als dos cinquens del mig, als tres quarts de darrere.'],
  ['AH12', 'Coll', 'Jing', '颈', 201, 285, 'Al cos de l\'antihèlix, al cinquè de baix, al quart de davant.'],
  ['AH13', 'Vertebres cervicals', 'Jingzhui', '颈椎', 214, 286, 'Al cos de l\'antihèlix, al cinquè de baix, als tres quarts de darrere.'],
]

const TF: Fila[] = [
  ['TF1', 'Fossa triangular superior', 'Jiaowoshang', '角窝上', 118, 78, 'Al terç de davant de la fossa triangular, a la part de dalt.'],
  ['TF2', 'Genitals interns', 'Neishengzhiqi', '内生殖器', 118, 110, 'Al terç de davant de la fossa triangular, a la part del mig i de baix.'],
  ['TF3', 'Centre de la fossa triangular', 'Jiaowozhong', '角窝中', 156, 92, 'Al terç del mig de la fossa triangular.'],
  ['TF4', 'Shenmen', 'Shenmen', '神门', 188, 96, 'Al terç de darrere de la fossa triangular, a la meitat de dalt, a prop d\'on se separen les dues arrels de l\'antihèlix.'],
  ['TF5', 'Pelvis', 'Penqiang', '盆腔', 192, 124, 'Al terç de darrere de la fossa triangular, a la meitat de baix.'],
]

const TG: Fila[] = [
  ['TG1', 'Tragus superior', 'Shangping', '上屏', 84, 238, 'A la meitat de dalt de la cara externa del tragus.'],
  ['TG2', 'Tragus inferior', 'Xiaping', '下屏', 84, 290, 'A la meitat de baix de la cara externa del tragus.'],
  ['TG1u', 'Orella externa', 'Waier', '外耳', 85, 210, 'Davant de l\'escotadura de sobre el tragus, a prop de l\'hèlix.'],
  ['TG1p', 'Àpex del tragus', 'Pingjian', '屏尖', 94, 224, 'A la punta del relleu de dalt de la vora lliure del tragus.'],
  ['TG1,2i', 'Nas extern', 'Waibi', '外鼻', 85, 264, 'Al mig de la cara externa del tragus, entre el tragus superior i l\'inferior.'],
  ['TG2p', 'Glàndula suprarenal', 'Shenshangxian', '肾上腺', 95, 300, 'A la punta del relleu de baix de la vora lliure del tragus.'],
  ['TG2l', 'Davant de l\'escotadura intertràgica', 'Pingjianqian', '屏间前', 102, 316, 'A la part més baixa del tragus, just davant de l\'escotadura intertràgica.'],
]

/** Punts de la cara interna del tragus: al dibuix, a tocar de la vora lliure */
const TG_INTERNA: Fila[] = [
  ['TG3', 'Faringe i laringe', 'Yanhou', '咽喉', 95, 250, 'A la meitat de dalt de la cara interna del tragus (la que mira a l\'orifici de l\'orella).'],
  ['TG4', 'Nas intern', 'Neibi', '内鼻', 95, 276, 'A la meitat de baix de la cara interna del tragus.'],
]

const AT: Fila[] = [
  ['AT1', 'Front', 'E', '额', 140, 326, 'Al terç de davant de la cara externa de l\'antitragus.'],
  ['AT1l', 'Darrere de l\'escotadura intertràgica', 'Pingjianhou', '屏间后', 124, 327, 'A la part de davant i de baix de l\'antitragus, just darrere de l\'escotadura intertràgica.'],
  ['AT2', 'Temple', 'Nie', '颞', 166, 324, 'Al terç del mig de la cara externa de l\'antitragus.'],
  ['AT3', 'Occipital', 'Zhen', '枕', 191, 315, 'Al terç de darrere de la cara externa de l\'antitragus.'],
  ['AT1,2,4i', 'Àpex de l\'antitragus', 'Duipingjian', '对屏尖', 155, 310, 'A la punta de l\'antitragus.'],
  ['AT2,3,4i', 'Vora central', 'Yuanzhong', '缘中', 180, 304, 'A la vora de dalt de l\'antitragus, a mig camí entre la punta i l\'escotadura amb l\'antihèlix.'],
  ['AT3,4i', 'Tronc de l\'encèfal', 'Naogan', '脑干', 200, 306, 'A l\'escotadura entre l\'antitragus i l\'antihèlix.'],
]

const AT_INTERNA: Fila[] = [
  ['AT4', 'Subcòrtex', 'Pizhixia', '皮质下', 134, 318, 'A la cara interna de l\'antitragus (la que mira a la conca).'],
]

const CO: Fila[] = [
  ['CO1', 'Boca', 'Kou', '口', 110, 208, 'A la cavitat de la conca, sota la rel de l\'hèlix, al terç de davant (darrere i damunt de l\'orifici de l\'orella).'],
  ['CO2', 'Esòfag', 'Shidao', '食道', 133, 213, 'Sota la rel de l\'hèlix, al terç del mig.'],
  ['CO3', 'Càrdies', 'Benmen', '贲门', 158, 222, 'Sota la rel de l\'hèlix, al terç de darrere.'],
  ['CO4', 'Estómac', 'Wei', '胃', 190, 216, 'On s\'acaba la rel de l\'hèlix.'],
  ['CO5', 'Duodè', 'Shierzhichang', '十二指肠', 170, 192, 'A la cimba, sobre la rel de l\'hèlix, al terç de darrere.'],
  ['CO6', 'Intestí prim', 'Xiaochang', '小肠', 145, 179, 'A la cimba, sobre la rel de l\'hèlix, al terç del mig.'],
  ['CO7', 'Intestí gros', 'Dachang', '大肠', 118, 171, 'A la cimba, sobre la rel de l\'hèlix, al terç de davant.'],
  ['CO6,7i', 'Apèndix', 'Lanwei', '阑尾', 131, 175, 'A la cimba, entre l\'intestí prim i l\'intestí gros.'],
  ['CO8', 'Angle de la cimba', 'Tingjiao', '艇角', 110, 156, 'A l\'angle de davant i de dalt de la cimba, sota l\'arrel inferior de l\'antihèlix.'],
  ['CO9', 'Bufeta', 'Pangguang', '膀胱', 150, 161, 'A la cimba, sota l\'arrel inferior de l\'antihèlix, al mig.'],
  ['CO9,10i', 'Urèter', 'Shuniaoguan', '输尿管', 170, 164, 'A la cimba, entre la bufeta i el ronyó.'],
  ['CO10', 'Ronyó', 'Shen', '肾', 190, 170, 'A la cimba, sota l\'arrel inferior de l\'antihèlix, a la part de darrere.'],
  ['CO6,10i', 'Centre de la cimba', 'Tingzhong', '艇中', 158, 177, 'Al centre de la cimba, entre l\'intestí prim i el ronyó.'],
  ['CO11', 'Pàncrees i vesícula biliar', 'Yidan', '胰胆', 210, 182, 'A la part de darrere i de dalt de la cimba, tocant a l\'antihèlix.'],
  ['CO12', 'Fetge', 'Gan', '肝', 208, 202, 'A la part de darrere i de baix de la cimba i de dalt de la cavitat, tocant a l\'antihèlix.'],
  ['CO13', 'Melsa', 'Pi', '脾', 202, 240, 'A la part de darrere i de baix de la cavitat de la conca, sota el fetge.'],
  ['CO14', 'Pulmó', 'Fei', '肺', 178, 262, 'A la cavitat de la conca, al voltant del cor i de la tràquea.'],
  ['CO15', 'Cor', 'Xin', '心', 152, 248, 'Al centre de la cavitat de la conca.'],
  ['CO16', 'Tràquea', 'Qiguan', '气管', 124, 240, 'A la cavitat de la conca, entre el cor i l\'orifici de l\'orella.'],
  ['CO17', 'Triple escalfador', 'Sanjiao', '三焦', 132, 286, 'A la part de baix de la cavitat de la conca, darrere i sota l\'orifici de l\'orella, entre el pulmó i l\'endocrí.'],
  ['CO18', 'Endocrí', 'Neifenmi', '内分泌', 114, 304, 'Al fons de la cavitat de la conca, a tocar de l\'escotadura intertràgica.'],
]

const LO: Fila[] = [
  ['LO1', 'Dents', 'Ya', '牙', 128, 355, 'Al lòbul (dividit en nou quadres), a la fila de dalt, a davant.'],
  ['LO2', 'Llengua', 'She', '舌', 174, 355, 'Al lòbul, a la fila de dalt, al mig.'],
  ['LO3', 'Mandíbula', 'He', '颌', 220, 355, 'Al lòbul, a la fila de dalt, a darrere.'],
  ['LO4', 'Davant del lòbul', 'Chuiqian', '垂前', 128, 389, 'Al lòbul, a la fila del mig, a davant.'],
  ['LO5', 'Ull', 'Yan', '眼', 166, 389, 'Al lòbul, al quadre del centre.'],
  ['LO5,6i', 'Galta', 'Mianjia', '面颊', 197, 389, 'Al lòbul, entre el quadre de l\'ull i el de l\'orella interna.'],
  ['LO6', 'Orella interna', 'Neier', '内耳', 222, 389, 'Al lòbul, a la fila del mig, a darrere.'],
  ['LO7,8,9', 'Amígdala', 'Biantaoti', '扁桃体', 174, 420, 'Al lòbul, a la fila de baix (els tres quadres).'],
]

export const PUNTS_ORELLA: readonly PuntOrella[] = [
  ...HX.map((f) => fila('HX', f)),
  ...SF.map((f) => fila('SF', f)),
  ...AH.map((f) => fila('AH', f)),
  ...TF.map((f) => fila('TF', f)),
  ...TG.map((f) => fila('TG', f)),
  ...TG_INTERNA.map((f) => fila('TG', f, true)),
  ...AT.map((f) => fila('AT', f)),
  ...AT_INTERNA.map((f) => fila('AT', f, true)),
  ...CO.map((f) => fila('CO', f)),
  ...LO.map((f) => fila('LO', f)),
].map((p) => esquemaPuntOrella.parse(p))

export function puntOrella(codi: string): PuntOrella | undefined {
  return PUNTS_ORELLA.find((p) => p.codi === codi)
}

/** Posició d'un punt amb les correccions de la doctora */
export function posicioOrella(
  p: PuntOrella,
  correccions: ReadonlyMap<string, { x: number; y: number }>,
): { x: number; y: number; corregit: boolean } {
  const c = correccions.get(p.codi)
  return c ? { ...c, corregit: true } : { x: p.x, y: p.y, corregit: false }
}

/** Cerca per codi («TF4», «tf 4»), pel nom català o pel pinyin, sense accents */
export function cercarPuntsOrella(consulta: string): PuntOrella[] {
  const net = (s: string) =>
    s
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLowerCase()
      .replace(/[\s,'-]/g, '')
  const q = net(consulta)
  if (q === '') return []
  const exactes = PUNTS_ORELLA.filter((p) => net(p.codi) === q || net(p.pinyin) === q || net(p.nom) === q)
  const parcials = PUNTS_ORELLA.filter(
    (p) => !exactes.includes(p) && (net(p.codi).startsWith(q) || net(p.pinyin).includes(q) || net(p.nom).includes(q)),
  )
  return [...exactes, ...parcials]
}
