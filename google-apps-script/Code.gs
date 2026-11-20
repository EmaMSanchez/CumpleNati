var RSVP_HEADERS = ['Fecha de respuesta', 'Nombre y apellido', 'Email', 'Asistencia', 'Personas', 'ID de respuesta'];
var RSVP_SHEET_NAME = 'Confirmaciones';

function jsonResponse(value) {
  return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);
}

function sameSecret(actual, expected) {
  if (typeof actual !== 'string' || typeof expected !== 'string' || expected.length < 32) return false;
  var difference = actual.length ^ expected.length;
  for (var i = 0; i < expected.length; i++) difference |= (actual.charCodeAt(i) || 0) ^ expected.charCodeAt(i);
  return difference === 0;
}

function safeCell(value) {
  var text = String(value);
  return /^[=+@\-\t\r\n]/.test(text) ? "'" + text : text;
}

function cellMatches(stored, expected) {
  return String(stored) === String(expected) || String(stored) === safeCell(expected);
}

function getRsvpSheet() {
  var id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (!id) throw new Error('CONFIGURATION');
  var book = SpreadsheetApp.openById(id);
  var sheet = book.getSheetByName(RSVP_SHEET_NAME) || book.insertSheet(RSVP_SHEET_NAME);
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, RSVP_HEADERS.length).setValues([RSVP_HEADERS]);
    sheet.getRange(1, 1, 1, RSVP_HEADERS.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  var headers = sheet.getRange(1, 1, 1, RSVP_HEADERS.length).getValues()[0];
  if (JSON.stringify(headers) !== JSON.stringify(RSVP_HEADERS)) throw new Error('CONFIGURATION');
  return sheet;
}

function prepararPlanilla() {
  var sheet = getRsvpSheet();
  sheet.getParent().setSpreadsheetTimeZone('America/Argentina/Buenos_Aires');
  sheet.getRange('A:A').setNumberFormat('dd/MM/yyyy HH:mm:ss');
  sheet.autoResizeColumns(1, RSVP_HEADERS.length);
}

function validateSubmission(data) {
  var name = typeof data.fullName === 'string' ? data.fullName.trim().replace(/\s+/g, ' ') : '';
  var email = typeof data.email === 'string' ? data.email.trim().toLowerCase() : '';
  var attending = data.attendance;
  var rawGuests = data.guests;
  var guests = attending === 'no' ? 0 : ((typeof rawGuests === 'number' || typeof rawGuests === 'string') && String(rawGuests).trim() !== '' ? Number(rawGuests) : NaN);
  if (name.length < 3 || name.length > 100 || !/^\p{L}[\p{L}\p{M} .’'\-]+\s[\p{L}\p{M} .’'\-]+$/u.test(name)) return null;
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email)) return null;
  if (attending !== 'yes' && attending !== 'no') return null;
  if (attending === 'yes' && (!Number.isInteger(guests) || guests < 1 || guests > 99)) return null;
  if (typeof data.requestId !== 'string' || !/^[a-f\d]{8}-[a-f\d]{4}-4[a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/i.test(data.requestId)) return null;
  return { fullName: name, email: email, attendance: attending, guests: guests, requestId: data.requestId };
}

function doPost(event) {
  var lock = null;
  try {
    var raw = event && event.postData && event.postData.contents;
    if (!raw || raw.length > 8192) return jsonResponse({ ok: false, code: 'INVALID_BODY' });
    var data = JSON.parse(raw);
    if (!data || typeof data !== 'object' || Array.isArray(data)) return jsonResponse({ ok: false, code: 'INVALID_BODY' });
    var expected = PropertiesService.getScriptProperties().getProperty('SHARED_SECRET');
    if (!sameSecret(data.secret, expected)) return jsonResponse({ ok: false, code: 'UNAUTHORIZED' });
    var value = validateSubmission(data);
    if (!value) return jsonResponse({ ok: false, code: 'VALIDATION' });

    lock = LockService.getScriptLock();
    if (!lock.tryLock(10000)) return jsonResponse({ ok: false, code: 'BUSY' });
    var sheet = getRsvpSheet();
    var count = sheet.getLastRow();
    var rows = count > 1 ? sheet.getRange(2, 1, count - 1, RSVP_HEADERS.length).getValues() : [];
    var rowNumber = count + 1;
    var updated = false;
    for (var i = 0; i < rows.length; i++) {
      if (String(rows[i][5]) === value.requestId) {
        var same = cellMatches(rows[i][1], value.fullName) && cellMatches(rows[i][2], value.email) && String(rows[i][3]) === (value.attendance === 'yes' ? 'Sí' : 'No') && Number(rows[i][4]) === value.guests;
        return jsonResponse(same ? { ok: true, saved: true, requestId: value.requestId, updated: false } : { ok: false, code: 'ID_CONFLICT' });
      }
      if (cellMatches(String(rows[i][2]).toLowerCase(), value.email)) { rowNumber = i + 2; updated = true; }
    }
    sheet.getRange(rowNumber, 2, 1, 2).setNumberFormat('@');
    sheet.getRange(rowNumber, 1, 1, RSVP_HEADERS.length).setValues([[
      new Date(), safeCell(value.fullName), safeCell(value.email), value.attendance === 'yes' ? 'Sí' : 'No', value.guests, value.requestId
    ]]);
    SpreadsheetApp.flush();
    return jsonResponse({ ok: true, saved: true, requestId: value.requestId, updated: updated });
  } catch (error) {
    return jsonResponse({ ok: false, code: error && error.message === 'CONFIGURATION' ? 'CONFIGURATION' : 'SAVE_FAILED' });
  } finally {
    if (lock && lock.hasLock()) lock.releaseLock();
  }
}

function doGet() {
  return jsonResponse({ ok: false, code: 'METHOD_NOT_ALLOWED' });
}
