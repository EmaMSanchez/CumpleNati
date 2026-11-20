export const MAX_GUESTS = 99

export function validateRsvp(input = {}) {
  const fullName = typeof input.fullName === 'string' ? input.fullName.trim().replace(/\s+/gu, ' ') : ''
  const email = typeof input.email === 'string' ? input.email.trim().toLowerCase() : ''
  const attendance = input.attendance
  const rawGuests = input.guests
  const guests = attendance === 'no' ? 0 : (typeof rawGuests === 'number' || typeof rawGuests === 'string') && String(rawGuests).trim() !== '' ? Number(rawGuests) : NaN
  const errors = {}

  if (fullName.length < 3 || fullName.length > 100 || !/^\p{L}[\p{L}\p{M} .’'\-]+\s[\p{L}\p{M} .’'\-]+$/u.test(fullName)) {
    errors.fullName = 'Escribí tu nombre y apellido, hasta 100 caracteres.'
  }
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email)) {
    errors.email = 'Revisá el email. Usá el formato nombre@dominio.com.'
  }
  if (!['yes', 'no'].includes(attendance)) errors.attendance = 'Elegí si podés venir o si no vas a poder.'
  if (attendance === 'yes' && (!Number.isInteger(guests) || guests < 1 || guests > MAX_GUESTS)) {
    errors.guests = `Indicá entre 1 y ${MAX_GUESTS} personas, incluyéndote.`
  }

  return { valid: Object.keys(errors).length === 0, errors, value: { fullName, email, attendance, guests } }
}

export function isRequestId(value) {
  return typeof value === 'string' && /^[a-f\d]{8}-[a-f\d]{4}-4[a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/i.test(value)
}
