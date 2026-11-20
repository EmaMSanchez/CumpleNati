import React from 'react'
import { createRoot, hydrateRoot } from 'react-dom/client'
import '@fontsource/jost/latin-600.css'
import '@fontsource/karla/latin-400.css'
import '@fontsource/karla/latin-600.css'
import '@fontsource/allura/latin-400.css'
import 'leaflet/dist/leaflet.css'
import App from './App.jsx'
import './styles.css'

const app = (
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
const root = document.getElementById('root')
if (root.hasChildNodes()) hydrateRoot(root, app)
else createRoot(root).render(app)
