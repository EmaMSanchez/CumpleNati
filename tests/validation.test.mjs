import test from 'node:test'
import assert from 'node:assert/strict'
import { isRequestId, validateRsvp } from '../shared/rsvp.js'

const valid = { fullName: '  José   Pérez  ', email: 'JOSE@EXAMPLE.COM ', attendance: 'yes', guests: '3' }

test('normaliza nombres, email y cantidad', () => {
  assert.deepEqual(validateRsvp(valid).value, { fullName: 'José Pérez', email: 'jose@example.com', attendance: 'yes', guests: 3 })
  assert.equal(validateRsvp(valid).valid, true)
})

test('una respuesta negativa guarda cero personas', () => {
  assert.equal(validateRsvp({ ...valid, attendance: 'no', guests: 9 }).value.guests, 0)
  assert.equal(validateRsvp({ ...valid, attendance: 'no', guests: null }).valid, true)
})

test('rechaza cantidades inválidas sin coerciones ambiguas', () => {
  for (const guests of ['', ' ', true, false, null, [], {}, -1, 0, 100, 1.5, 'abc', Infinity]) {
    assert.equal(validateRsvp({ ...valid, guests }).valid, false, JSON.stringify(guests))
  }
})

test('requiere nombre, apellido, email y elección explícita', () => {
  for (const input of [{ ...valid, fullName: 'José' }, { ...valid, email: 'sin-arroba' }, { ...valid, attendance: '' }, {}]) {
    assert.equal(validateRsvp(input).valid, false)
  }
})

test('acepta nombres Unicode e identifica UUID v4', () => {
  assert.equal(validateRsvp({ ...valid, fullName: 'María-José D’Angelo' }).valid, true)
  assert.equal(validateRsvp({ ...valid, fullName: '=IMPORTXML A' }).valid, false)
  assert.equal(isRequestId('8c3c191a-129d-44c0-8743-e2d5529ea110'), true)
  assert.equal(isRequestId('not-a-uuid'), false)
})
