import { useEffect, useRef, useState } from 'react'
import { Check, Heart, LoaderCircle, Minus, Plus, Send } from 'lucide-react'
import { MAX_GUESTS, validateRsvp } from '../../shared/rsvp.js'

export default function RsvpForm() {
  const [values, setValues] = useState({ fullName: '', email: '', attendance: '', guests: 1, website: '' })
  const [touched, setTouched] = useState({})
  const [status, setStatus] = useState('idle')
  const [message, setMessage] = useState('')
  const formRef = useRef(null)
  const resultRef = useRef(null)
  const requestId = useRef(null)
  const errors = validateRsvp(values).errors
  const busy = status === 'sending'

  useEffect(() => { if (status === 'success') resultRef.current?.focus() }, [status])

  function change(name, value) {
    setValues((current) => ({ ...current, [name]: value }))
    requestId.current = null
    if (status === 'error') { setStatus('idle'); setMessage('') }
  }

  const markTouched = (name) => setTouched((current) => ({ ...current, [name]: true }))
  const fieldError = (name) => touched[name] ? errors[name] : undefined

  async function submit(event) {
    event.preventDefault()
    if (busy) return
    const checked = validateRsvp(values)
    setTouched({ fullName: true, email: true, attendance: true, guests: true })
    if (!checked.valid) {
      const first = Object.keys(checked.errors)[0]
      formRef.current?.querySelector(`[name="${first}"]`)?.focus()
      return
    }

    requestId.current ||= crypto.randomUUID()
    setStatus('sending')
    setMessage('')

    try {
      const response = await fetch('/api/rsvp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...checked.value, website: values.website, requestId: requestId.current }),
        signal: AbortSignal.timeout(25000),
      })
      const result = await response.json()
      if (!response.ok || result.ok !== true || result.requestId !== requestId.current) {
        throw new Error(result.message || 'No pudimos registrar tu respuesta. Probá de nuevo en un momento.')
      }
      setStatus('success')
    } catch (error) {
      setStatus('error')
      setMessage(error.name === 'TimeoutError'
        ? 'La confirmación está tardando. Volvé a intentar: no se duplicará tu respuesta.'
        : error instanceof TypeError
          ? 'No pudimos conectar. Revisá tu conexión y volvé a intentar.'
          : error.message)
    }
  }

  if (status === 'success') {
    return (
      <div className="rsvp-success" ref={resultRef} tabIndex={-1} role="status" aria-live="polite">
        <Check size={40} strokeWidth={1.5} aria-hidden="true" />
        <h3>{values.attendance === 'yes' ? '¡Nos vemos en la fiesta!' : 'Gracias por avisarme.'}</h3>
        <p>Tu respuesta quedó registrada en la lista de Natalia.</p>
        {values.attendance === 'yes' && <p className="success-party">{Number(values.guests) === 1 ? 'Te esperamos a vos.' : `Los esperamos a los ${values.guests}.`}</p>}
        <button className="button button-secondary" type="button" onClick={() => { setStatus('idle'); requestId.current = null }}>Modificar respuesta</button>
      </div>
    )
  }

  return (
    <form className="rsvp-form" ref={formRef} onSubmit={submit} noValidate method="post" action="/api/rsvp" data-endpoint="/api/rsvp" aria-label="Confirmación de asistencia" aria-busy={busy}>
      <p className="form-intro">Todos los campos son obligatorios.</p>
      <div className="field">
        <label htmlFor="fullName">Nombre y apellido</label>
        <input id="fullName" name="fullName" autoComplete="name" value={values.fullName} onChange={(event) => change('fullName', event.target.value)} onBlur={() => markTouched('fullName')} maxLength={100} required aria-required="true" disabled={busy} aria-invalid={Boolean(fieldError('fullName'))} aria-describedby="fullName-help" />
        <p className="field-help" id="fullName-help">{fieldError('fullName') || '\u00a0'}</p>
      </div>
      <div className="field">
        <label htmlFor="email">Email</label>
        <input id="email" name="email" type="email" inputMode="email" autoComplete="email" value={values.email} onChange={(event) => change('email', event.target.value)} onBlur={() => markTouched('email')} maxLength={254} required aria-required="true" disabled={busy} aria-invalid={Boolean(fieldError('email'))} aria-describedby="email-help" />
        <p className="field-help" id="email-help">{fieldError('email') || '\u00a0'}</p>
      </div>
      <fieldset className="attendance-field" disabled={busy} aria-describedby="attendance-help">
        <legend>¿Podés venir?</legend>
        <div className="attendance-options">
          <label className={`attendance-option ${values.attendance === 'yes' ? 'is-selected' : ''}`}>
            <input type="radio" name="attendance" value="yes" checked={values.attendance === 'yes'} onChange={() => { change('attendance', 'yes'); markTouched('attendance') }} required aria-required="true" aria-invalid={Boolean(fieldError('attendance'))} />
            <span>Sí, ¡voy!</span><Heart size={18} aria-hidden="true" />
          </label>
          <label className={`attendance-option ${values.attendance === 'no' ? 'is-selected' : ''}`}>
            <input type="radio" name="attendance" value="no" checked={values.attendance === 'no'} onChange={() => { change('attendance', 'no'); markTouched('attendance') }} required aria-required="true" aria-invalid={Boolean(fieldError('attendance'))} />
            <span>No puedo</span>
          </label>
        </div>
        <p className="field-help" id="attendance-help">{fieldError('attendance') || '\u00a0'}</p>
      </fieldset>
      <div className="field guests-field">
        <label htmlFor="guests">¿Cuántas personas?</label>
        <div className="guests-row">
          <div className="guest-stepper">
            <button type="button" aria-label="Una persona menos" disabled={busy || values.attendance === 'no' || Number(values.guests) <= 1} onClick={() => change('guests', Math.max(1, Number(values.guests) - 1))}><Minus size={18} aria-hidden="true" /></button>
            <input id="guests" name="guests" type="number" inputMode="numeric" min={1} max={MAX_GUESTS} step={1} value={values.attendance === 'no' ? 0 : values.guests} onChange={(event) => change('guests', event.target.value)} onBlur={() => markTouched('guests')} disabled={busy || values.attendance === 'no'} required={values.attendance !== 'no'} aria-required={values.attendance !== 'no'} aria-invalid={Boolean(fieldError('guests'))} aria-describedby="guests-help" />
            <button type="button" aria-label="Una persona más" disabled={busy || values.attendance === 'no' || Number(values.guests) >= MAX_GUESTS} onClick={() => change('guests', Math.min(MAX_GUESTS, Number(values.guests || 0) + 1))}><Plus size={18} aria-hidden="true" /></button>
          </div>
          <span className="guest-note">{values.attendance === 'no' ? 'Se registran 0 personas.' : 'Incluyéndote a vos.'}</span>
        </div>
        <p className="field-help" id="guests-help">{fieldError('guests') || '\u00a0'}</p>
      </div>
      <div className="honeypot" aria-hidden="true">
        <label htmlFor="website">Dejá este campo vacío</label>
        <input id="website" name="website" autoComplete="off" tabIndex={-1} value={values.website} onChange={(event) => change('website', event.target.value)} />
      </div>
      <button className="button button-primary submit-button" type="submit" disabled={busy}>
        {busy ? 'Guardando respuesta…' : 'Enviar confirmación'}
        {busy ? <LoaderCircle className="loading-icon" size={18} aria-hidden="true" /> : <Send size={18} aria-hidden="true" />}
      </button>
      <p className={`form-message ${status === 'error' ? 'is-error' : ''}`} role={status === 'error' ? 'alert' : 'status'} aria-live="polite">{message}</p>
      <p className="privacy-note">Tus datos se usan solo para organizar este cumpleaños.</p>
    </form>
  )
}
