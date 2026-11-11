// Prints what each city source actually contains: fields, coded domains, distinct values of
// likely facility/status fields, and for undiscovered cities the bike-related services.
// Used to choose the protected-lane filters in cities.json from real data. Writes nothing.
// Usage: node scripts/probe-city-data.mjs [slug ...]
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const SOURCES = JSON.parse(readFileSync(resolve(here, 'cities.json'), 'utf8'));
const only = process.argv.slice(2);
const CANDIDATE = /facil|type|class|status|lane|bike|protect|separat|symbol|categ|existing/i;

async function get(url) {
  const r = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': 'lanekeeper-site-data/1.0' } });
  const text = await r.text();
  try {
    return { status: r.status, json: JSON.parse(text) };
  } catch {
    return { status: r.status, json: null, text: text.slice(0, 200) };
  }
}
const log = (...a) => console.log(...a);

async function probeSocrata(src) {
  const one = await get(`${src.endpoint}.json?$limit=1`);
  if (!Array.isArray(one.json)) return log('  sample failed', one.status, one.text ?? JSON.stringify(one.json).slice(0, 200));
  const fields = Object.keys(one.json[0] ?? {});
  log('  fields:', fields.join(', '));
  for (const f of fields.filter((f) => CANDIDATE.test(f) && !/geom|shape/i.test(f))) {
    const u = new URL(`${src.endpoint}.json`);
    u.searchParams.set('$select', `${f}, count(*) as n`);
    u.searchParams.set('$group', f);
    u.searchParams.set('$order', 'n DESC');
    u.searchParams.set('$limit', '40');
    const r = await get(u);
    if (Array.isArray(r.json)) log(`  ${f}:`, r.json.map((x) => `${x[f] ?? 'null'}=${x.n}`).join(' | '));
  }
}

async function probeArcgisLayer(url) {
  const meta = await get(`${url}?f=json`);
  if (!meta.json || meta.json.error) return log('  layer failed', meta.status, JSON.stringify(meta.json?.error ?? meta.text).slice(0, 200));
  const m = meta.json;
  log(`  layer: ${m.name} | geometry ${m.geometryType} | maxRecordCount ${m.maxRecordCount} | formats ${m.supportedQueryFormats}`);
  const count = await get(`${url}/query?where=1%3D1&returnCountOnly=true&f=json`);
  log('  total rows:', count.json?.count);
  for (const f of m.fields ?? []) {
    const coded = f.domain?.codedValues;
    if (coded) log(`  ${f.name} domain:`, coded.map((c) => `${c.code}=${c.name}`).join(' | '));
  }
  for (const f of (m.fields ?? []).filter((f) => f.type === 'esriFieldTypeString' && CANDIDATE.test(f.name))) {
    const u = new URL(`${url}/query`);
    u.searchParams.set('where', '1=1');
    u.searchParams.set('outFields', f.name);
    u.searchParams.set('returnDistinctValues', 'true');
    u.searchParams.set('returnGeometry', 'false');
    u.searchParams.set('f', 'json');
    const r = await get(u);
    const vals = r.json?.features?.map((x) => x.attributes[f.name]);
    if (vals) log(`  ${f.name}:`, vals.slice(0, 40).join(' | '));
    else log(`  ${f.name}: distinct query failed`, JSON.stringify(r.json?.error ?? r.text).slice(0, 160));
  }
  log('  all fields:', (m.fields ?? []).map((f) => f.name).join(', '));
}

async function discover(base) {
  const r = await get(`${base}?f=json`);
  const services = (r.json?.services ?? []).filter((s) => /bike|bicycle|bikeway|cycl/i.test(s.name));
  log('  bike services:', services.map((s) => `${s.name} (${s.type})`).join(' | ') || 'none');
  for (const s of services.slice(0, 6)) {
    const url = s.url ?? `${base}/${s.name}/${s.type}`;
    const svc = await get(`${url}?f=json`);
    for (const l of svc.json?.layers ?? []) {
      log(`  ${url}/${l.id}  ${l.name}`);
    }
  }
}

for (const src of SOURCES) {
  if (only.length && !only.includes(src.slug)) continue;
  log(`\n=== ${src.name} (${src.slug}) ===`);
  try {
    if (src.discover) await discover(src.discover);
    if (src.endpoint && src.type === 'socrata') await probeSocrata(src);
    if (src.endpoint && src.type === 'arcgis') await probeArcgisLayer(src.endpoint);
  } catch (e) {
    log('  error:', e.message);
  }
}
