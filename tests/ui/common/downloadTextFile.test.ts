import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { downloadTextFile } from '../../../src/ui/common/downloadTextFile'

describe('downloadTextFile', () => {
  // jsdom no implementa URL.createObjectURL/revokeObjectURL (ver
  // https://github.com/jsdom/jsdom/issues/1721) -- mismo motivo por el que
  // el respaldo de datos de SettingsScreen (que usa el mismo mecanismo)
  // nunca tuvo test unitario, solo verificacion real via Playwright. Aca se
  // mockean para poder verificar el resto del mecanismo (creacion/click/
  // limpieza del ancla) bajo vitest.
  beforeEach(() => {
    URL.createObjectURL = vi.fn(() => 'blob:mock-url')
    URL.revokeObjectURL = vi.fn()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('crea un ancla con el nombre de archivo pedido, la clickea, y limpia despues', () => {
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

    downloadTextFile('partida.sgf', '(;GM[1])', 'application/x-go-sgf')

    expect(URL.createObjectURL).toHaveBeenCalledTimes(1)
    const [blob] = (URL.createObjectURL as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(blob.type).toBe('application/x-go-sgf')
    expect(clickSpy).toHaveBeenCalledTimes(1)
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url')
    // El ancla se agrega y se saca del DOM otra vez -- no debe quedar suelta.
    expect(document.querySelectorAll('a[download]').length).toBe(0)
  })
})
