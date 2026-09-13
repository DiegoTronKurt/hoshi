/**
 * Blob + ancla temporal + revocar URL: el mismo mecanismo ya verificado en
 * un AAB real (respaldo de datos en SettingsScreen, cont. 2026-09-01) para
 * bajar un archivo de texto desde dentro del WebView de Android, ahora
 * tambien reusado para exportar una partida a SGF (ReviewScreen,
 * HistoricGamesScreen). No hace falta ningun plugin nativo: el atributo
 * `download` ya dispara el gestor de descargas del sistema en el WebView.
 */
export function downloadTextFile(filename: string, content: string, mimeType = 'text/plain'): void {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
