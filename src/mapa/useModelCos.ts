import { carregarModel, type ModelCos } from './model'
import { useCarrega, type Carrega } from '../sessio/useCarrega'

let promesa: Promise<ModelCos> | null = null

/** El model del cos, carregat una sola vegada per a tota l'app. */
export function useModelCos(): Carrega<ModelCos> {
  const [carrega] = useCarrega(() => (promesa ??= carregarModel()), [])
  return carrega
}
