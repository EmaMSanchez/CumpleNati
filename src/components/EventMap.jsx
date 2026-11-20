import { useEffect, useRef, useState } from 'react'
import { LocateFixed, Minus, Plus } from 'lucide-react'

const coordinates = [-37.9828247, -57.560167]
const tileUrl = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'

function setInteraction(map, active) {
  for (const control of ['dragging', 'touchZoom', 'doubleClickZoom', 'scrollWheelZoom', 'boxZoom', 'keyboard']) {
    map[control][active ? 'enable' : 'disable']()
  }
}

export default function EventMap({ directionsUrl }) {
  const container = useRef(null)
  const instance = useRef(null)
  const activeRef = useRef(false)
  const [active, setActive] = useState(false)
  const [status, setStatus] = useState('loading')
  activeRef.current = active

  useEffect(() => {
    let disposed = false
    let map
    let observer
    import('leaflet').then(({ default: L }) => {
      if (disposed) return
      map = L.map(container.current, {
        zoomControl: false, attributionControl: false,
        dragging: false, touchZoom: false, doubleClickZoom: false,
        scrollWheelZoom: false, boxZoom: false, keyboard: false,
        zoomAnimation: false, fadeAnimation: false, markerZoomAnimation: false,
      }).setView(coordinates, 16)
      instance.current = map
      setInteraction(map, activeRef.current)
      const tiles = L.tileLayer(tileUrl, { minZoom: 12, maxZoom: 19, keepBuffer: 0 })
      let hadError = false
      tiles.on('tileerror', () => { hadError = true; if (!disposed) setStatus('error') })
      tiles.on('loading', () => { hadError = false; if (!disposed) setStatus('loading') })
      tiles.on('load', () => { if (!disposed) setStatus(hadError ? 'error' : 'ready') })
      tiles.addTo(map)
      L.marker(coordinates, {
        icon: L.icon({ iconUrl: '/map-pin.svg', iconSize: [40, 48], iconAnchor: [20, 48] }),
        keyboard: false, interactive: false, alt: '',
      }).addTo(map)
      observer = new ResizeObserver(() => map.invalidateSize({ animate: false, pan: false }))
      observer.observe(container.current)
    }).catch(() => { if (!disposed) setStatus('error') })
    return () => { disposed = true; observer?.disconnect(); map?.remove(); instance.current = null }
  }, [])

  useEffect(() => {
    if (instance.current) setInteraction(instance.current, active)
    if (active) container.current?.focus()
  }, [active])

  return (
    <div className="map-canvas">
      <div id="fiesta-map" ref={container} className="map-tiles" tabIndex={active ? 0 : -1} role="region" aria-label="Mapa de Misiones 840, Mar del Plata" aria-describedby="map-instructions" />
      <span className="visually-hidden" id="map-instructions">Activá el mapa para moverlo con las flechas. También podés abrir la ubicación en Google Maps.</span>
      {status === 'loading' && <p className="map-status" role="status">Cargando mapa…</p>}
      {status === 'error' && <div className="map-fallback" role="status"><p>No pudimos cargar el mapa.</p><a href={directionsUrl} target="_blank" rel="noopener noreferrer">Ver ubicación en Google Maps</a></div>}
      <div className="map-controls" aria-label="Controles del mapa" hidden={status !== 'ready'}>
        <button type="button" aria-label="Acercar mapa" disabled={status !== 'ready'} onClick={() => instance.current?.zoomIn()}><Plus size={20} aria-hidden="true" /></button>
        <button type="button" aria-label="Alejar mapa" disabled={status !== 'ready'} onClick={() => instance.current?.zoomOut()}><Minus size={20} aria-hidden="true" /></button>
        <button type="button" aria-label="Centrar ubicación" disabled={status !== 'ready'} onClick={() => instance.current?.setView(coordinates, 16, { animate: false })}><LocateFixed size={20} aria-hidden="true" /></button>
      </div>
      <button className="map-toggle" type="button" aria-controls="fiesta-map" aria-pressed={active} hidden={status !== 'ready'} disabled={status !== 'ready'} onClick={() => setActive(!active)}>{active ? 'Desactivar mapa' : 'Activar mapa interactivo'}</button>
      <a className="map-attribution" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">© OpenStreetMap contributors</a>
    </div>
  )
}
