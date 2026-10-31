import { setDictionary, dictionaryReady } from './bombaLogic.js'

// O dicionário (~140 mil palavras) só é descarregado quando se vai jogar.
let loading = null
export function loadDictionary() {
  if (dictionaryReady()) return Promise.resolve()
  if (!loading) {
    loading = fetch('/palavras-pt.txt')
      .then((r) => {
        if (!r.ok) throw new Error('Não deu para carregar o dicionário. Tenta outra vez.')
        return r.text()
      })
      .then((text) => setDictionary(text.split('\n').filter(Boolean)))
      .catch((e) => {
        loading = null
        throw e
      })
  }
  return loading
}
