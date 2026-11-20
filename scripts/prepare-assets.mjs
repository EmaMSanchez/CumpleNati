import sharp from 'sharp'
import { mkdir, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const input = process.argv[2]
if (!input) throw new Error('Indicá la carpeta de imágenes originales.')
const output = new URL('../public/images/', import.meta.url)
await mkdir(output, { recursive: true })

await Promise.all([
  sharp(join(input, 'foto-1-sin-fondo.png')).resize({ width: 1100 }).webp({ quality: 86, alphaQuality: 100 }).toFile(fileURLToPath(new URL('natalia-dj.webp', output))),
  sharp(join(input, 'foto-1-sin-fondo.png')).resize({ width: 640 }).webp({ quality: 82, alphaQuality: 100 }).toFile(fileURLToPath(new URL('natalia-dj-small.webp', output))),
  sharp(join(input, 'Foto-2-sin-fondo.png')).resize({ width: 720 }).webp({ quality: 85, alphaQuality: 100 }).toFile(fileURLToPath(new URL('natalia-fiesta.webp', output))),
])

const { data, info } = await sharp(join(input, 'Tarjeta.jpeg'))
  .extract({ left: 302, top: 100, width: 510, height: 396 })
  .ensureAlpha().raw().toBuffer({ resolveWithObject: true })
const seen = new Uint8Array(info.width * info.height)
const queue = new Uint32Array(seen.length)
let head = 0
let tail = 0
function enqueue(x, y) {
  if (x < 0 || y < 0 || x >= info.width || y >= info.height) return
  const pixel = y * info.width + x
  if (seen[pixel]) return
  const i = pixel * 4
  const max = Math.max(data[i], data[i + 1], data[i + 2])
  const min = Math.min(data[i], data[i + 1], data[i + 2])
  if (max - min >= 32) return
  seen[pixel] = 1
  queue[tail++] = pixel
}
for (let x = 0; x < info.width; x++) { enqueue(x, 0); enqueue(x, info.height - 1) }
for (let y = 0; y < info.height; y++) { enqueue(0, y); enqueue(info.width - 1, y) }
enqueue(372, 194)
while (head < tail) {
  const pixel = queue[head++]
  const x = pixel % info.width
  const y = Math.floor(pixel / info.width)
  data[pixel * 4 + 3] = 0
  enqueue(x - 1, y); enqueue(x + 1, y); enqueue(x, y - 1); enqueue(x, y + 1)
}
await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
  .resize(580, 458, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .webp({ quality: 94, alphaQuality: 100 }).toFile(fileURLToPath(new URL('50-dorado.webp', output)))

for (const file of ['natalia-dj.webp', 'natalia-dj-small.webp', 'natalia-fiesta.webp', '50-dorado.webp']) {
  const size = await stat(new URL(file, output))
  console.log(`${file}: ${Math.round(size.size / 1024)} KB`)
}
