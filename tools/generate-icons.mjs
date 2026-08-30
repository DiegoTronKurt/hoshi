import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const root = dirname(fileURLToPath(import.meta.url))
const svgPath = join(root, '..', 'public', 'favicon.svg')
const outDir = join(root, '..', 'public', 'icons')

const svg = await readFile(svgPath)
await mkdir(outDir, { recursive: true })

const targets = [
  { file: 'icon-192.png', size: 192 },
  { file: 'icon-512.png', size: 512 },
  { file: 'icon-maskable-512.png', size: 512 },
]

for (const { file, size } of targets) {
  const png = await sharp(svg, { density: 384 }).resize(size, size).png().toBuffer()
  await writeFile(join(outDir, file), png)
  console.log(`Generado ${file}`)
}
