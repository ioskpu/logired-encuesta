// Función de Vercel: intermediario entre la página y Google Apps Script.
// Mantiene en secreto la URL del script y su clave.
//
// Variables de entorno (Vercel > Settings > Environment Variables):
//   APPS_SCRIPT_URL     URL de la implementación web del Apps Script (termina en /exec)
//   APPS_SCRIPT_SECRET  la misma clave guardada como SECRET en el Apps Script
//   CLAVE_RESULTADOS    clave para ver y borrar resultados desde la página

const FIELDS = {
  id: 'string', creado: 'string', tienda: 'string', sector: 'string', tipo: 'string',
  proveedores: 'string', como: 'string', viajes: 'number', gasto: 'number',
  sinproducto: 'string', agotado: 'string', papeles: 'string', pagos: 'array',
  consultaria: 'string', entrega: 'string', piloto: 'string', telefono: 'string',
  comentario: 'string'
};

function clean(input) {
  const out = {};
  for (const [k, type] of Object.entries(FIELDS)) {
    const v = input?.[k];
    if (type === 'number') {
      const n = typeof v === 'number' ? v : Number(v);
      out[k] = v === null || v === undefined || v === '' || !Number.isFinite(n) || n < 0 ? null : n;
    } else if (type === 'array') {
      out[k] = Array.isArray(v) ? v.filter((x) => typeof x === 'string').map((x) => x.slice(0, 40)).slice(0, 10) : [];
    } else {
      out[k] = typeof v === 'string' ? v.trim().slice(0, 600) : '';
    }
  }
  return out;
}

async function callScript(method, payload) {
  const url = process.env.APPS_SCRIPT_URL;
  const secret = process.env.APPS_SCRIPT_SECRET;
  if (!url || !secret) throw Object.assign(new Error('missing_config'), { status: 500 });

  let res;
  if (method === 'GET') {
    res = await fetch(url + '?secret=' + encodeURIComponent(secret), { redirect: 'follow' });
  } else {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ ...payload, secret }),
      redirect: 'follow'
    });
  }
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch {
    // Google respondió con HTML: muestra el inicio para saber por qué (login, permisos, error del script).
    const title = (text.match(/<title>([^<]*)<\/title>/i) || [])[1] || '';
    console.error('Respuesta no JSON de Apps Script', {
      status: res.status,
      urlFinal: res.url.split('?')[0],
      titulo: title.trim(),
      inicio: text.replace(/\s+/g, ' ').slice(0, 300)
    });
    throw Object.assign(new Error('bad_script_response'), { status: 502 });
  }
  if (!data.ok) throw Object.assign(new Error(data.error || 'script_error'), { status: data.error === 'unauthorized' ? 500 : 502 });
  return data;
}

function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') { try { return JSON.parse(req.body); } catch { return null; } }
  return null;
}

function hasKey(req) {
  const key = process.env.CLAVE_RESULTADOS;
  return !!key && req.headers['x-clave'] === key;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    if (req.method === 'POST') {
      const body = readBody(req);
      if (!body) return res.status(400).json({ ok: false, error: 'bad_json' });
      const r = clean(body);
      if (!/^[A-Za-z0-9-]{8,64}$/.test(r.id)) return res.status(400).json({ ok: false, error: 'bad_id' });
      if (!r.creado || isNaN(Date.parse(r.creado))) r.creado = new Date().toISOString();
      const data = await callScript('POST', { action: 'add', respuesta: r });
      return res.status(200).json({ ok: true, duplicate: !!data.duplicate });
    }

    if (req.method === 'GET') {
      if (!hasKey(req)) return res.status(401).json({ ok: false, error: 'clave' });
      const data = await callScript('GET');
      return res.status(200).json({ ok: true, rows: data.rows || [] });
    }

    if (req.method === 'DELETE') {
      if (!hasKey(req)) return res.status(401).json({ ok: false, error: 'clave' });
      const id = String(req.query?.id || '');
      if (!/^[A-Za-z0-9-]{8,64}$/.test(id)) return res.status(400).json({ ok: false, error: 'bad_id' });
      const data = await callScript('POST', { action: 'delete', id });
      return res.status(200).json({ ok: true, deleted: !!data.deleted });
    }

    res.setHeader('Allow', 'GET, POST, DELETE');
    return res.status(405).json({ ok: false, error: 'method' });
  } catch (err) {
    console.error(err);
    return res.status(err.status || 500).json({ ok: false, error: err.message || 'error' });
  }
}
