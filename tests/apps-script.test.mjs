import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createContext, runInContext } from 'node:vm'

const source = await readFile(new URL('../google-apps-script/Code.gs', import.meta.url), 'utf8')
const secret = 's'.repeat(64)
const requestId = '8c3c191a-129d-44c0-8743-e2d5529ea110'
const valid = { fullName: 'Invitado Prueba', email: 'invitado@example.com', attendance: 'yes', guests: 3, requestId, secret }

function setup({ busy = false, properties = {} } = {}) {
  const rows = []
  let held = false
  const sheet = {
    getLastRow: () => rows.length,
    getRange(row, column, height, width) {
      const range = {
        getValues: () => Array.from({ length: height }, (_, y) => Array.from({ length: width }, (_, x) => rows[row - 1 + y]?.[column - 1 + x] ?? '')),
        setValues(values) { values.forEach((valuesRow, y) => { rows[row - 1 + y] ||= []; valuesRow.forEach((value, x) => { rows[row - 1 + y][column - 1 + x] = value }) }); return range },
        setFontWeight: () => range,
        setNumberFormat: () => range,
      }
      return range
    },
    setFrozenRows() {},
  }
  const context = createContext({
    PropertiesService: { getScriptProperties: () => ({ getProperty: (key) => ({ SHARED_SECRET: secret, SPREADSHEET_ID: 'sheet-id', ...properties })[key] }) },
    SpreadsheetApp: { openById: () => ({ getSheetByName: () => sheet, insertSheet: () => sheet }), flush() {} },
    LockService: { getScriptLock: () => ({ tryLock: () => { held = !busy; return held }, hasLock: () => held, releaseLock: () => { held = false } }) },
    ContentService: { MimeType: { JSON: 'application/json' }, createTextOutput(text) { return { text, setMimeType() { return this } } } },
  })
  runInContext(source, context)
  return { context, rows, held: () => held, post: (body) => JSON.parse(context.doPost({ postData: { contents: JSON.stringify(body) } }).text) }
}

test('Apps Script crea la cabecera y guarda una respuesta real', () => {
  const app = setup()
  const result = app.post(valid)
  assert.equal(result.ok, true)
  assert.equal(result.saved, true)
  assert.equal(app.rows.length, 2)
  assert.equal(app.rows[1][4], 3)
  assert.equal(app.held(), false)
})

test('reintentar no duplica y el mismo email actualiza su fila', () => {
  const app = setup()
  app.post(valid)
  assert.equal(app.post(valid).saved, true)
  assert.equal(app.rows.length, 2)
  const updated = app.post({ ...valid, attendance: 'no', guests: 4, requestId: '8c3c191a-129d-44c0-8743-e2d5529ea111' })
  assert.equal(updated.updated, true)
  assert.equal(app.rows.length, 2)
  assert.equal(app.rows[1][3], 'No')
  assert.equal(app.rows[1][4], 0)
})

test('el mismo ID no confirma un contenido diferente', () => {
  const app = setup()
  app.post(valid)
  assert.equal(app.post({ ...valid, guests: 4 }).code, 'ID_CONFLICT')
  assert.equal(app.rows[1][4], 3)
})

test('un email escapado sigue siendo idempotente al leerlo desde Sheets', () => {
  const app = setup()
  const value = { ...valid, email: '+invitado@example.com' }
  app.post(value)
  app.rows[1][2] = '+invitado@example.com'
  assert.equal(app.post(value).saved, true)
  assert.equal(app.post({ ...value, guests: 4, requestId: '8c3c191a-129d-44c0-8743-e2d5529ea111' }).updated, true)
  assert.equal(app.rows.length, 2)
})

test('no escribe sin secreto válido o con datos inválidos', () => {
  const app = setup()
  assert.equal(app.post({ ...valid, secret: 'wrong' }).ok, false)
  assert.equal(app.post({ ...valid, guests: false }).ok, false)
  assert.equal(app.post({ ...valid, email: 'invalid' }).ok, false)
  assert.equal(app.rows.length, 0)
})

test('gestiona bloqueo ocupado y configuración ausente', () => {
  assert.equal(setup({ busy: true }).post(valid).code, 'BUSY')
  const app = setup({ properties: { SPREADSHEET_ID: '' } })
  assert.equal(app.post(valid).code, 'CONFIGURATION')
  assert.equal(app.held(), false)
})

test('protege fórmulas y GET no expone invitados', () => {
  const app = setup()
  for (const value of ['=SUM(1,2)', '+123', '-123', '@IMPORTXML']) assert.equal(app.context.safeCell(value).startsWith("'"), true)
  assert.deepEqual(JSON.parse(app.context.doGet().text), { ok: false, code: 'METHOD_NOT_ALLOWED' })
})
