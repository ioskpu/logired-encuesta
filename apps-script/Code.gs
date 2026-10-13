/**
 * LogiRed · Encuesta a tiendas
 * Recibe y entrega las respuestas guardadas en esta hoja de cálculo.
 *
 * Configuración (ver README):
 *   Configuración del proyecto > Propiedades de la secuencia de comandos
 *   SECRET = la misma clave que pongas en Vercel como APPS_SCRIPT_SECRET
 */

const SHEET_NAME = 'Respuestas';

const COLUMNS = [
  'id', 'creado', 'tienda', 'sector', 'tipo', 'proveedores', 'como',
  'viajes', 'gasto', 'sinproducto', 'agotado', 'papeles', 'pagos',
  'consultaria', 'entrega', 'piloto', 'telefono', 'comentario'
];

function doPost(e) {
  let body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return json_({ ok: false, error: 'bad_json' });
  }
  if (!checkSecret_(body.secret)) return json_({ ok: false, error: 'unauthorized' });

  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const sheet = getSheet_();
    if (body.action === 'delete') {
      const row = findRow_(sheet, String(body.id || ''));
      if (row > 0) sheet.deleteRow(row);
      return json_({ ok: true, deleted: row > 0 });
    }

    const r = body.respuesta || {};
    if (!r.id) return json_({ ok: false, error: 'missing_id' });
    // Si el teléfono reintenta un envío que ya llegó, no se duplica.
    if (findRow_(sheet, String(r.id)) > 0) return json_({ ok: true, duplicate: true });

    const values = COLUMNS.map(function (c) {
      const v = r[c];
      if (Array.isArray(v)) return v.join(', ');
      if (v === null || v === undefined) return '';
      return v;
    });
    sheet.appendRow(values);
    return json_({ ok: true });
  } finally {
    lock.releaseLock();
  }
}

function doGet(e) {
  if (!checkSecret_(e.parameter.secret)) return json_({ ok: false, error: 'unauthorized' });
  const sheet = getSheet_();
  const data = sheet.getDataRange().getValues();
  const header = data.shift() || [];
  const rows = data
    .filter(function (row) { return row[0] !== ''; })
    .map(function (row) {
      const o = {};
      header.forEach(function (h, i) { o[h] = row[i]; });
      o.pagos = o.pagos ? String(o.pagos).split(', ') : [];
      o.viajes = o.viajes === '' ? null : Number(o.viajes);
      o.gasto = o.gasto === '' ? null : Number(o.gasto);
      if (o.creado instanceof Date) o.creado = o.creado.toISOString();
      o.telefono = String(o.telefono || '');
      return o;
    });
  rows.sort(function (a, b) { return String(b.creado).localeCompare(String(a.creado)); });
  return json_({ ok: true, rows: rows });
}

function getSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(SHEET_NAME);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(COLUMNS);
    sheet.setFrozenRows(1);
    // El teléfono como texto para no perder el 0 inicial.
    sheet.getRange(1, COLUMNS.indexOf('telefono') + 1, sheet.getMaxRows()).setNumberFormat('@');
  }
  return sheet;
}

function findRow_(sheet, id) {
  const last = sheet.getLastRow();
  if (last < 2 || !id) return -1;
  const ids = sheet.getRange(2, 1, last - 1, 1).getValues();
  for (let i = 0; i < ids.length; i++) {
    if (String(ids[i][0]) === id) return i + 2;
  }
  return -1;
}

function checkSecret_(s) {
  const secret = PropertiesService.getScriptProperties().getProperty('SECRET');
  return !!secret && s === secret;
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
