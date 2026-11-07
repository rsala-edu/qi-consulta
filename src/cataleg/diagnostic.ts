// Catàleg del diagnòstic de MTC (etapa 3B): els vuit principis, els zang-fu i
// les substàncies, les síndromes (patrons de la CIM-11, capítol 26) i els
// principis de tractament. Terminologia de l'OMS (2022).

import type { Grup } from './tipus'
import { o } from './valoracio'

export const PRINCIPIS_TRACTAMENT = [
  o('tonificarQi', 'Tonificar el qi', 'bǔ qì', '补气'),
  o('tonificarSang', 'Nodrir la sang', 'yǎng xuè', '养血'),
  o('nodrirYin', 'Nodrir el yin', 'zī yīn', '滋阴'),
  o('escalfarYang', 'Escalfar el yang', 'wēn yáng', '温阳'),
  o('enfortirMelsa', 'Enfortir la melsa', 'jiàn pí', '健脾'),
  o('tonificarRonyo', 'Tonificar el ronyó', 'bǔ shèn', '补肾'),
  o('transformarHumitat', 'Transformar la humitat', 'huà shī', '化湿'),
  o('transformarFlegma', 'Transformar la flegma', 'huà tán', '化痰'),
  o('moureQiFetge', 'Fer circular el qi del fetge', 'shū gān lǐ qì', '疏肝理气'),
  o('activarSang', 'Activar la sang i resoldre l\'estasi', 'huó xuè huà yū', '活血化瘀'),
  o('eliminarCalor', 'Eliminar la calor', 'qīng rè', '清热'),
  o('dispersarFred', 'Dispersar el fred', 'sàn hán', '散寒'),
  o('expulsarVent', 'Expulsar el vent', 'qū fēng', '祛风'),
  o('calmarFetge', 'Calmar el fetge i fer baixar el yang', 'píng gān qián yáng', '平肝潜阳'),
  o('calmarShen', 'Calmar el shen', 'ān shén', '安神'),
  o('obrirPulmo', 'Obrir i fer baixar el qi del pulmó', 'xuān fèi', '宣肺'),
  o('harmonitzarEstomac', 'Harmonitzar l\'estómac i fer baixar el qi', 'hé wèi jiàng nì', '和胃降逆'),
  o('consolidarExterior', 'Tonificar el qi i consolidar l\'exterior', 'yì qì gù biǎo', '益气固表'),
  o('desobstruirMeridians', 'Desobstruir els meridians i calmar el dolor', 'tōng luò zhǐ tòng', '通络止痛'),
  o('obrirOrelles', 'Obrir els orificis i aclarir l\'oïda', 'kāi qiào cōng ěr', '开窍聪耳'),
]

export const DIAGNOSTIC: Grup = {
  id: 'diagnostic',
  ca: 'Diagnòstic de MTC',
  seccions: [
    {
      id: 'diagnostic:vuitPrincipis',
      ca: 'Els vuit principis',
      pinyin: 'bā gāng',
      hanzi: '八纲',
      ref: 'oms-ist-2022',
      senseNormal: true,
      camps: [
        {
          id: 'yinYang',
          ca: 'Yin o yang',
          tipus: 'simple',
          xines: true,
          opcions: [o('yin', 'Yin', 'yīn zhèng', '阴证'), o('yang', 'Yang', 'yáng zhèng', '阳证')],
        },
        {
          id: 'interiorExterior',
          ca: 'Interior o exterior',
          tipus: 'simple',
          xines: true,
          opcions: [
            o('interior', 'Interior', 'lǐ zhèng', '里证'),
            o('exterior', 'Exterior', 'biǎo zhèng', '表证'),
            o('mig', 'Meitat exterior, meitat interior', 'bàn biǎo bàn lǐ', '半表半里'),
          ],
        },
        {
          id: 'fredCalor',
          ca: 'Fred o calor',
          tipus: 'simple',
          xines: true,
          opcions: [
            o('fred', 'Fred', 'hán zhèng', '寒证'),
            o('calor', 'Calor', 'rè zhèng', '热证'),
            o('barrejats', 'Fred i calor barrejats', 'hán rè cuò zá', '寒热错杂'),
          ],
        },
        {
          id: 'deficienciaExces',
          ca: 'Deficiència o excés',
          tipus: 'simple',
          xines: true,
          opcions: [
            o('deficiencia', 'Deficiència', 'xū zhèng', '虚证'),
            o('exces', 'Excés', 'shí zhèng', '实证'),
            o('barrejats', 'Deficiència amb excés', 'xū shí jiā zá', '虚实夹杂'),
          ],
        },
      ],
    },
    {
      id: 'diagnostic:organs',
      ca: 'Òrgans i substàncies',
      pinyin: 'zàng fǔ qì xuè jīn yè',
      hanzi: '脏腑气血津液',
      ref: 'oms-ist-2022',
      senseNormal: true,
      camps: [
        {
          id: 'zang',
          ca: 'Zang',
          tipus: 'multiple',
          xines: true,
          opcions: [
            o('fetge', 'Fetge', 'gān', '肝'),
            o('cor', 'Cor', 'xīn', '心'),
            o('melsa', 'Melsa', 'pí', '脾'),
            o('pulmo', 'Pulmó', 'fèi', '肺'),
            o('ronyo', 'Ronyó', 'shèn', '肾'),
            o('pericardi', 'Pericardi', 'xīn bāo', '心包'),
          ],
        },
        {
          id: 'fu',
          ca: 'Fu',
          tipus: 'multiple',
          xines: true,
          opcions: [
            o('vesicula', 'Vesícula biliar', 'dǎn', '胆'),
            o('intestiPrim', 'Intestí prim', 'xiǎo cháng', '小肠'),
            o('estomac', 'Estómac', 'wèi', '胃'),
            o('intestiGros', 'Intestí gros', 'dà cháng', '大肠'),
            o('bufeta', 'Bufeta', 'páng guāng', '膀胱'),
            o('tripleEscalfador', 'Triple escalfador', 'sān jiāo', '三焦'),
          ],
        },
        {
          id: 'substancies',
          ca: 'Substàncies',
          tipus: 'multiple',
          xines: true,
          opcions: [
            o('qi', 'Qi', 'qì', '气'),
            o('sang', 'Sang', 'xuè', '血'),
            o('yin', 'Yin', 'yīn', '阴'),
            o('yang', 'Yang', 'yáng', '阳'),
            o('liquids', 'Líquids', 'jīn yè', '津液'),
            o('essencia', 'Essència', 'jīng', '精'),
          ],
        },
        {
          id: 'factors',
          ca: 'Factors patògens',
          tipus: 'multiple',
          xines: true,
          opcions: [
            o('vent', 'Vent', 'fēng', '风'),
            o('fred', 'Fred', 'hán', '寒'),
            o('calorEstiu', 'Calor d\'estiu', 'shǔ', '暑'),
            o('humitat', 'Humitat', 'shī', '湿'),
            o('sequedat', 'Sequedat', 'zào', '燥'),
            o('foc', 'Foc', 'huǒ', '火'),
            o('flegma', 'Flegma', 'tán', '痰'),
            o('estasiSang', 'Estasi de sang', 'xuè yū', '血瘀'),
            o('aliments', 'Retenció d\'aliments', 'shí jī', '食积'),
          ],
        },
      ],
    },
    {
      id: 'diagnostic:sindromes',
      ca: 'Síndromes',
      pinyin: 'zhèng hòu',
      hanzi: '证候',
      ref: 'cim11-tm1',
      senseNormal: true,
      camps: [
        { id: 'principal', ca: 'Síndrome principal', tipus: 'especial', component: 'sindromes', config: 'principal' },
        { id: 'secundaries', ca: 'Síndromes secundàries', tipus: 'especial', component: 'sindromes', config: 'secundaries' },
        { id: 'textLliure', ca: 'Si cap no encaixa: descripció', tipus: 'text' },
      ],
    },
    {
      id: 'diagnostic:principisTractament',
      ca: 'Principis de tractament',
      pinyin: 'zhì zé',
      hanzi: '治则',
      ref: 'oms-ist-2022',
      senseNormal: true,
      camps: [{ id: 'principis', ca: 'Suggeriments', tipus: 'multiple', xines: true, opcions: PRINCIPIS_TRACTAMENT }],
    },
  ],
}
