/**
 * Junta los bancos parciales que generate-mistake-exercises.ts escribe
 * cuando corre con WORKER_COUNT>1 (`*.partN.json`, uno por worker) en el
 * archivo final de cada concepto. Cada worker cubre un subconjunto disjunto
 * de partidas (g % WORKER_COUNT === WORKER_INDEX), asi que no hay
 * duplicados posibles entre partes -- solo concatenar y renumerar ids.
 * Borra las partes despues de juntarlas.
 */
import { readdir, readFile, unlink, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

interface BankEntry {
  id: string
  conceptId: string
  sgf: string
  difficulty: string
}

const BANKS: Array<{ fileName: string; idPrefix: string }> = [
  { fileName: 'atari-ignorado.json', idPrefix: 'atariignorado' },
  { fileName: 'autoatari.json', idPrefix: 'autoatari' },
  { fileName: 'relleno-ojo-propio.json', idPrefix: 'rellenoojo' },
  { fileName: 'triangulo-vacio.json', idPrefix: 'trianguloVacio' },
  { fileName: 'corte-no-defendido.json', idPrefix: 'corteNoDefendido' },
]

async function main() {
  const root = dirname(fileURLToPath(import.meta.url))
  const outDir = join(root, '..', 'src', 'content', 'problems')
  const files = await readdir(outDir)

  for (const { fileName, idPrefix } of BANKS) {
    const base = fileName.replace(/\.json$/, '')
    const partFiles = files.filter((f) => f.startsWith(`${base}.part`) && f.endsWith('.json')).sort()
    if (partFiles.length === 0) {
      console.log(`${fileName}: no hay partes para juntar, se deja como esta`)
      continue
    }

    const merged: BankEntry[] = []
    for (const partFile of partFiles) {
      const raw = await readFile(join(outDir, partFile), 'utf8')
      const entries = JSON.parse(raw) as BankEntry[]
      merged.push(...entries)
    }

    const renumbered = merged.map((entry, index) => ({ ...entry, id: `${idPrefix}${index + 1}` }))
    await writeFile(join(outDir, fileName), JSON.stringify(renumbered, null, 2))
    console.log(`${fileName}: ${renumbered.length} problemas juntados de ${partFiles.length} partes`)

    for (const partFile of partFiles) await unlink(join(outDir, partFile))
  }
}

main()
