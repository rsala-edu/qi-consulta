export { xifrarJson, desxifrarJson, ErrorDesxifratge, type DadesXifrades } from './aesGcm'
export {
  crearClauMestra,
  desbloquejarClauMestra,
  canviarContrasenya,
  ErrorContrasenya,
  ErrorSecret,
  afegirEmbolcallSecret,
  desbloquejarAmbSecret,
  contrasenyaNovaAmbSecret,
  type ClauEmbolcallada,
  type EmbolcallSecret,
  type TipusSecret,
} from './clauMestra'
export { generarSecretRecuperacio, textClauRecuperacio, llegirClauRecuperacio } from './recuperacio'
export { bytesABase64, base64ABytes } from './codificacio'
export { ITERACIONS_PBKDF2 } from './derivacio'
export { hashCorreu } from './hash'
export { crearPasskey, secretPasskey, passkeyDisponible, ErrorSensePrf, ErrorPasskeyCancellada } from './passkey'
export { idClau, empremtaCurta } from './empremtaClau'
