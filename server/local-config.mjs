import { spawn } from 'node:child_process'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const keys = ['GOOGLE_SCRIPT_URL', 'GOOGLE_SCRIPT_SECRET', 'APP_ORIGIN']

function transform(input, method) {
  const command = `$ErrorActionPreference='Stop'; Add-Type -AssemblyName System.Security; $bytes=[Convert]::FromBase64String([Console]::In.ReadToEnd()); $output=[System.Security.Cryptography.ProtectedData]::${method}($bytes,$null,[System.Security.Cryptography.DataProtectionScope]::CurrentUser); [Console]::Out.Write([Convert]::ToBase64String($output))`
  return new Promise((resolve, reject) => {
    const child = spawn('powershell.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', command], { windowsHide: true })
    let output = ''
    const timer = setTimeout(() => child.kill(), 10000)
    child.stdout.setEncoding('utf8')
    child.stdout.on('data', (chunk) => { output += chunk })
    child.stderr.resume()
    child.stdin.on('error', () => {})
    child.on('error', () => { clearTimeout(timer); reject(new Error('No se pudo acceder al almacén cifrado de Windows.')) })
    child.on('close', (code) => {
      clearTimeout(timer)
      if (code !== 0) return reject(new Error('No se pudo acceder al almacén cifrado de Windows.'))
      resolve(Buffer.from(output.trim(), 'base64'))
    })
    child.stdin.end(input.toString('base64'))
  })
}

export async function loadLocalConfig({ directory = process.env.LOCALAPPDATA, platform = process.platform } = {}) {
  if (platform !== 'win32' || !directory) return {}
  let encrypted
  try { encrypted = await readFile(join(directory, 'Natalia50', 'rsvp.dpapi')) }
  catch (error) { if (error.code === 'ENOENT') return {}; throw new Error('No se pudo leer la configuración cifrada.') }
  try {
    const configuration = JSON.parse((await transform(encrypted, 'Unprotect')).toString('utf8'))
    return Object.fromEntries(keys.filter((key) => typeof configuration[key] === 'string').map((key) => [key, configuration[key]]))
  } catch { throw new Error('No se pudo descifrar la configuración con este usuario de Windows.') }
}

export async function storeLocalConfig(configuration, { directory = process.env.LOCALAPPDATA } = {}) {
  if (process.platform !== 'win32' || !directory) throw new Error('Se necesita el almacén cifrado de Windows.')
  if (typeof configuration.GOOGLE_SCRIPT_SECRET !== 'string' || configuration.GOOGLE_SCRIPT_SECRET.length < 32) {
    throw new Error('La configuración no contiene un secreto válido.')
  }
  const values = Object.fromEntries(keys.filter((key) => typeof configuration[key] === 'string').map((key) => [key, configuration[key]]))
  const encrypted = await transform(Buffer.from(JSON.stringify(values)), 'Protect')
  const destination = join(directory, 'Natalia50')
  await mkdir(destination, { recursive: true })
  await writeFile(join(destination, 'rsvp.dpapi'), encrypted, { flag: 'wx', mode: 0o600 })
}
