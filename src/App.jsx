import { useState } from 'react'
import { CalendarDays, Check, Clock3, Heart, MapPin, Menu, Navigation2, X } from 'lucide-react'
import RsvpForm from './components/RsvpForm.jsx'
import EventMap from './components/EventMap.jsx'

const address = 'Misiones 840, Mar del Plata, Buenos Aires, Argentina'
const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`

export function Sparkle({ className = '' }) {
  return (
    <svg className={`sparkle ${className}`} viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <path d="M24 0 28 20 48 24 28 28 24 48 20 28 0 24 20 20Z" fill="currentColor" />
    </svg>
  )
}

function Navigation() {
  const [isOpen, setIsOpen] = useState(false)
  const close = () => setIsOpen(false)

  return (
    <header className="site-header">
      <div className="container header-inner">
        <a className="wordmark" href="#inicio" aria-label="Natalia, volver al inicio" onClick={close}>Natalia</a>
        <nav className="desktop-nav" aria-label="Navegación principal">
          <a href="#detalles">La fiesta</a>
          <a href="#ubicacion">Cómo llegar</a>
        </nav>
        <a className="nav-rsvp" href="#confirmar">Confirmar asistencia <Check size={16} aria-hidden="true" /></a>
        <button className="menu-toggle" type="button" aria-label={isOpen ? 'Cerrar menú' : 'Abrir menú'} aria-expanded={isOpen} aria-controls="mobile-nav" onClick={() => setIsOpen(!isOpen)}>
          {isOpen ? <X size={24} aria-hidden="true" /> : <Menu size={24} aria-hidden="true" />}
        </button>
      </div>
      {isOpen && (
        <nav id="mobile-nav" className="mobile-nav container" aria-label="Navegación móvil" onKeyDown={(event) => { if (event.key === 'Escape') { close(); document.querySelector('.menu-toggle')?.focus() } }}>
          <a href="#detalles" onClick={close}>La fiesta</a>
          <a href="#ubicacion" onClick={close}>Cómo llegar</a>
        </nav>
      )}
    </header>
  )
}

function Hero() {
  return (
    <section className="hero" id="inicio" aria-labelledby="hero-title">
      <div className="container invitation-layout">
        <div className="invitation-copy">
          <time className="hero-date" dateTime="2026-12-18T21:00:00-03:00"><CalendarDays size={16} aria-hidden="true" />18 de diciembre de 2026</time>
          <img className="gold-fifty" src="/images/50-dorado.webp" alt="" width="580" height="458" />
          <h1 id="hero-title" className="invitation-name">Natalia<span className="visually-hidden"> cumple 50</span></h1>
          <p className="hero-lead">Los 50 se festejan. Y con vos, mucho mejor.</p>
          <a className="button button-primary" href="#confirmar">Confirmar asistencia <Heart size={18} aria-hidden="true" /></a>
        </div>
        <div className="hero-art">
          <div className="hero-color-field" aria-hidden="true" />
          <div className="hero-gold-orbit" aria-hidden="true" />
          <Sparkle className="hero-sparkle-one" />
          <Sparkle className="hero-sparkle-two" />
          <img className="hero-portrait" src="/images/natalia-dj.webp" srcSet="/images/natalia-dj-small.webp 640w, /images/natalia-dj.webp 1100w" sizes="(max-width: 760px) 90vw, 50vw" alt="Natalia con auriculares y una mano en alto frente a la consola de DJ" width="1100" height="1372" fetchPriority="high" />
          <span className="party-note" aria-hidden="true">50 y<br />¡qué!</span>
        </div>
      </div>
      <div className="hero-baseline" aria-hidden="true"><span /> <Sparkle /> <span /></div>
    </section>
  )
}

function EventDetails() {
  return (
    <section className="event-details" id="detalles" aria-labelledby="details-title">
      <div className="container">
        <h2 id="details-title">Nos vemos el viernes.</h2>
        <dl className="event-facts">
          <div className="event-fact"><dt><CalendarDays size={28} strokeWidth={1.5} aria-hidden="true" />Cuándo</dt><dd><time dateTime="2026-12-18"><strong>Viernes 18</strong><span>Diciembre de 2026</span></time></dd></div>
          <div className="event-fact"><dt><Clock3 size={28} strokeWidth={1.5} aria-hidden="true" />A qué hora</dt><dd><strong>21:00 hs</strong><span>Arranca el festejo</span></dd></div>
          <div className="event-fact"><dt><MapPin size={28} strokeWidth={1.5} aria-hidden="true" />Dónde</dt><dd><strong>Misiones 840</strong><span>Mar del Plata, Buenos Aires</span></dd></div>
        </dl>
      </div>
    </section>
  )
}

function Confirmation() {
  return (
    <section className="confirmation" id="confirmar" aria-labelledby="confirmation-title">
      <div className="container confirmation-grid">
        <div className="confirmation-story">
          <h2 id="confirmation-title">La fiesta es mejor<br />si estás vos.</h2>
          <p className="lead">Confirmame si venís. ¡Quiero festejar con vos!</p>
          <div className="confirmation-photo">
            <div className="confirmation-photo-field" aria-hidden="true" />
            <img src="/images/natalia-fiesta.webp" alt="Natalia con gorrito de cumpleaños y un sándwich enorme" width="720" height="898" loading="lazy" />
            <Sparkle className="confirmation-sparkle" />
          </div>
        </div>
        <div className="form-sheet"><RsvpForm /></div>
      </div>
    </section>
  )
}

function Location() {
  return (
    <section className="location" id="ubicacion" aria-labelledby="location-title">
      <div className="container location-grid">
        <div className="location-copy">
          <MapPin size={32} strokeWidth={1.5} aria-hidden="true" />
          <h2 id="location-title">Acá nos encontramos.</h2>
          <address><strong>Misiones 840</strong><span>Mar del Plata, Buenos Aires</span></address>
          <a className="button button-secondary" href={directionsUrl} target="_blank" rel="noopener noreferrer">Cómo llegar <Navigation2 size={18} aria-hidden="true" /><span className="visually-hidden"> (abre Google Maps en otra pestaña)</span></a>
        </div>
        <div className="map-frame">
          <EventMap directionsUrl={directionsUrl} />
          <a className="map-caption" href={directionsUrl} target="_blank" rel="noopener noreferrer"><MapPin size={18} aria-hidden="true" />Misiones 840, Mar del Plata<span className="visually-hidden"> (abre Google Maps en otra pestaña)</span></a>
        </div>
      </div>
    </section>
  )
}

function Footer() {
  return (
    <footer className="site-footer">
      <div className="container footer-inner">
        <Sparkle />
        <h2>¡Te espero!</h2>
        <span className="footer-signature">Natalia</span>
        <a href="#inicio">Volver al inicio</a>
      </div>
    </footer>
  )
}

export default function App() {
  return (
    <>
      <a className="skip-link" href="#contenido">Saltar al contenido</a>
      <Navigation />
      <main id="contenido">
        <Hero />
        <EventDetails />
        <Confirmation />
        <Location />
      </main>
      <Footer />
    </>
  )
}
