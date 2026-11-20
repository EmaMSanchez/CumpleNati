import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { setTimeout as delay } from 'node:timers/promises'
import puppeteer from 'puppeteer-core'
import { AxePuppeteer } from '@axe-core/puppeteer'

const url = process.env.TEST_URL || 'http://localhost:5173'
const executablePath = [process.env.CHROME_PATH, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((path) => path && existsSync(path))
if (!executablePath) throw new Error('Definí CHROME_PATH con la ubicación de Chrome o Chromium.')
const browser = await puppeteer.launch({ executablePath, headless: true })
try {
  const page = await browser.newPage()
  const html = await (await fetch(url)).text()
  for (const path of ['/google-apps-script/Code.local.gs', '/.env', '/.git/config']) {
    const response = await fetch(`${url}${path}`)
    assert.ok([403, 404].includes(response.status), `El servidor no debe exponer ${path}`)
  }
  if (html.includes('id="hero-title"')) {
    const noJs = await browser.newPage()
    await noJs.setJavaScriptEnabled(false)
    await noJs.goto(url, { waitUntil: 'load' })
    assert.match(await noJs.$eval('h1', (el) => el.textContent), /Natalia/)
    assert.match(await noJs.$eval('.location-copy a', (el) => el.href), /google.com\/maps\/dir/)
    await noJs.close()
    console.log('PASS: invitación prerenderizada y enlace de llegada sin JavaScript')
  }
  const failures = []
  page.on('pageerror', (error) => failures.push(error.message))
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }])
  await page.setViewport({ width: 1440, height: 900 })
  let mode = 'unconfigured'
  let sent = 0
  let tileMode = 'offline'
  const payloads = []
  await page.setRequestInterception(true)
  page.on('request', async (request) => {
    if (request.url().endsWith('/api/rsvp') && request.method() === 'POST') {
      sent++
      const payload = JSON.parse(request.postData())
      payloads.push(payload)
      if (mode === 'unconfigured') {
        return request.respond({ status: 503, contentType: 'application/json', body: JSON.stringify({ ok: false, message: 'La confirmación todavía no está habilitada. No se envió tu respuesta.' }) })
      }
      await delay(150)
      return request.respond({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, requestId: payload.requestId }) })
    }
    if (request.url().startsWith('https://tile.openstreetmap.org/') && tileMode === 'fixture') {
      return request.respond({ status: 200, contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j61sAAAAASUVORK5CYII=', 'base64') })
    }
    if (!request.url().startsWith(url) && /^https?:/.test(request.url())) return request.abort()
    return request.continue()
  })

  await page.goto(url, { waitUntil: 'networkidle0' })
  await page.evaluate(() => document.fonts.ready)
  assert.equal(await page.$eval('h1', (el) => el.textContent.trim()), 'Natalia cumple 50')
  assert.match(await page.$eval('.location-copy a', (el) => el.href), /Misiones%20840.*Mar%20del%20Plata/)
  await page.waitForSelector('.map-fallback')
  assert.match(await page.$eval('.map-fallback', (el) => el.textContent), /Google Maps/)

  const accessibility = await new AxePuppeteer(page).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
  assert.deepEqual(accessibility.violations.map((item) => ({ id: item.id, impact: item.impact, nodes: item.nodes.map((n) => n.target) })), [])
  console.log('PASS: estructura accesible y etiquetas del formulario')

  await page.click('.submit-button')
  assert.equal(sent, 0)
  assert.equal(await page.evaluate(() => document.activeElement.id), 'fullName')
  assert.equal(await page.$eval('#fullName', (el) => el.getAttribute('aria-invalid')), 'true')
  await page.type('#fullName', 'Invitada Prueba')
  await page.type('#email', 'invitada@example.com')
  await page.click('input[name="attendance"][value="yes"]')
  await page.click('button[aria-label="Una persona más"]')
  assert.equal(await page.$eval('#guests', (el) => el.value), '2')
  await page.click('input[name="attendance"][value="no"]')
  assert.equal(await page.$eval('#guests', (el) => el.value), '0')
  assert.equal(await page.$eval('#guests', (el) => el.disabled), true)
  await page.click('input[name="attendance"][value="yes"]')
  assert.equal(await page.$eval('#guests', (el) => el.value), '2')
  await page.click('.submit-button')
  await page.waitForSelector('.form-message.is-error')
  assert.equal(await page.$('.rsvp-success'), null)
  assert.match(await page.$eval('.form-message', (el) => el.textContent), /No se envió/)
  console.log('PASS: validación, cantidad condicional y error sin confirmación falsa')

  mode = 'saved'
  await page.click('.submit-button')
  await page.waitForSelector('.rsvp-success')
  assert.equal(sent, 2)
  assert.equal(payloads[1].guests, 2)
  assert.equal(payloads[1].requestId, payloads[0].requestId)
  assert.equal('secret' in payloads[1], false)
  assert.match(await page.$eval('.rsvp-success', (el) => el.textContent), /Los esperamos a los 2/)
  await page.waitForFunction(() => document.activeElement.classList.contains('rsvp-success'))
  console.log('PASS: éxito verificado, reintento con mismo ID y secreto ausente')

  await page.click('.rsvp-success button')
  await page.click('input[name="attendance"][value="no"]')
  await page.click('.submit-button')
  await page.waitForSelector('.rsvp-success')
  assert.equal(payloads.at(-1).guests, 0)
  assert.match(await page.$eval('.rsvp-success', (el) => el.textContent), /Gracias por avisarme/)
  console.log('PASS: respuesta negativa y modificación de la confirmación')

  await page.click('.rsvp-success button')
  await page.setViewport({ width: 375, height: 812 })
  await page.click('.menu-toggle')
  assert.equal(await page.$eval('.menu-toggle', (el) => el.getAttribute('aria-expanded')), 'true')
  assert.equal(await page.$eval('#mobile-nav', (el) => getComputedStyle(el).flexDirection), 'column')
  assert.equal(await page.$$eval('#mobile-nav a', (links) => {
    const [first, second] = links.map((link) => link.getBoundingClientRect())
    return second.top >= first.bottom && Math.abs(first.left - second.left) < 1
  }), true, 'Los enlaces móviles deben estar uno debajo del otro')
  await page.focus('#mobile-nav a')
  await page.keyboard.press('Escape')
  assert.equal(await page.$('#mobile-nav'), null)
  assert.equal(await page.evaluate(() => document.activeElement.className), 'menu-toggle')
  await page.click('.menu-toggle')
  await page.click('#mobile-nav a[href="#detalles"]')
  assert.equal(await page.$('#mobile-nav'), null)
  console.log('PASS: menú móvil vertical, cierre por enlace y tecla Escape')

  for (const width of [320, 375, 414, 760, 768, 1024, 1280, 1440, 1920]) {
    await page.setViewport({ width, height: 900 })
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `overflow a ${width}px`)
    if (width <= 760) {
      const offset = await page.$eval('.confirmation-photo', (photo) => {
        const image = photo.getBoundingClientRect()
        const story = photo.parentElement.getBoundingClientRect()
        return Math.abs((image.left + image.right) / 2 - (story.left + story.right) / 2)
      })
      assert.ok(offset < 1, `La segunda foto debe estar centrada a ${width}px`)
      await page.click('.menu-toggle')
      assert.equal(await page.$$eval('#mobile-nav a', (links) => {
        const [first, second] = links.map((link) => link.getBoundingClientRect())
        return second.top >= first.bottom
      }), true, `El menú debe ser vertical a ${width}px`)
      await page.click('.menu-toggle')
    }
  }
  console.log('PASS: segunda foto centrada y menú vertical entre 320 y 760 px')
  tileMode = 'fixture'
  await page.reload({ waitUntil: 'networkidle0' })
  await page.waitForSelector('.map-toggle:not([hidden])')
  await page.click('.map-toggle')
  await page.waitForFunction(() => document.activeElement.id === 'fiesta-map')
  assert.equal(await page.$eval('.map-toggle', (el) => el.getAttribute('aria-pressed')), 'true')
  await page.click('button[aria-label="Acercar mapa"]')
  await page.waitForFunction(() => !document.querySelector('button[aria-label="Centrar ubicación"]').disabled)
  await page.click('button[aria-label="Centrar ubicación"]')
  await page.waitForSelector('.map-toggle:not([hidden])')
  await page.click('.map-toggle')
  assert.equal(await page.$eval('#fiesta-map', (el) => el.tabIndex), -1)
  console.log('PASS: mapa activable, controles y alternativa cuando falla la conexión')
  assert.deepEqual(failures, [])
  console.log('PASS: sin errores JavaScript ni scroll horizontal entre 320 y 1920 px')
} finally { await browser.close() }
