import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { loadLocalConfig, storeLocalConfig } from '../server/local-config.mjs'

async function directory(t) {
  const base = join(tmpdir(), 'opencode')
  await mkdir(base, { recursive: true })
  const path = await mkdtemp(join(base, 'natalia-encrypted-'))
  t.after(() => rm(path, { recursive: true, force: true }))
  return path
}

test('la configuración local es opcional y no se carga fuera de Windows', async (t) => {
  const path = await directory(t)
  assert.deepEqual(await loadLocalConfig({ directory: path }), {})
  assert.deepEqual(await loadLocalConfig({ directory: path, platform: 'linux' }), {})
})

test('Windows cifra las credenciales fuera del código y no las reemplaza al repetir', { skip: process.platform !== 'win32' }, async (t) => {
  const path = await directory(t)
  const values = { GOOGLE_SCRIPT_URL: 'https://script.google.com/macros/s/TEST/exec', GOOGLE_SCRIPT_SECRET: 's'.repeat(64) }
  await storeLocalConfig(values, { directory: path })
  const encrypted = await readFile(join(path, 'Natalia50/rsvp.dpapi'))
  assert.equal(encrypted.includes(Buffer.from(values.GOOGLE_SCRIPT_SECRET)), false)
  assert.equal(encrypted.includes(Buffer.from(values.GOOGLE_SCRIPT_URL)), false)
  assert.deepEqual(await loadLocalConfig({ directory: path }), values)
  await assert.rejects(storeLocalConfig(values, { directory: path }), { code: 'EEXIST' })
  assert.deepEqual(await readFile(join(path, 'Natalia50/rsvp.dpapi')), encrypted)
})

test('un archivo cifrado inválido falla sin mostrar información sensible', { skip: process.platform !== 'win32' }, async (t) => {
  const path = await directory(t)
  await mkdir(join(path, 'Natalia50'))
  await writeFile(join(path, 'Natalia50/rsvp.dpapi'), 'not-encrypted')
  await assert.rejects(loadLocalConfig({ directory: path }), /No se pudo descifrar/)
})
