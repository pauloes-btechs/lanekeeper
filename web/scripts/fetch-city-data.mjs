// Downloads each city's official bike-network open data, keeps existing protected
// (physically separated) on-street lanes, simplifies the lines and writes:
//   public/data/<slug>.geojson   protected lanes as LineStrings
//   public/data/cities.json      manifest: name, map view, lane-miles, source, retrieval date
//
// Lane-miles are computed here from the geometry and never typed by hand. A city whose data
// can't be fetched or matches nothing is skipped and listed in the manifest's `skipped`.
//
// Usage: node scripts/fetch-city-data.mjs [slug ...]
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(here, '../public/data');
const only = process.argv.slice(2);
const today = new Date().toISOString().slice(0, 10);

const EARTH_MI = 3958.7613;
const rad = (d) => (d * Math.PI) / 180;
export function haversineMi([lng1, lat1], [lng2, lat2]) {
  const a = Math.sin(rad(lat2 - lat1) / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lng2 - lng1) / 2) ** 2;
  return 2 * EARTH_MI * Math.asin(Math.sqrt(a));
}
export const lineMiles = (coords) => coords.slice(1).reduce((s, c, i) => s + haversineMi(coords[i], c), 0);

// Douglas-Peucker on lng/lat, tolerance in degrees (~1e-5 deg = ~1 m).
export function simplify(pts, tol) {
  if (pts.length < 3) return pts;
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    const [ax, ay] = pts[a];
    const [bx, by] = pts[b];
    const dx = bx - ax;
    const dy = by - ay;
    const len2 = dx * dx + dy * dy;
    let max = -1;
    let idx = -1;
    for (let i = a + 1; i < b; i++) {
      const [px, py] = pts[i];
      let t = len2 ? ((px - ax) * dx + (py - ay) * dy) / len2 : 0;
      t = Math.max(0, Math.min(1, t));
      const d = Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
      if (d > max) {
        max = d;
        idx = i;
      }
    }
    if (max > tol) {
      keep[idx] = 1;
      stack.push([a, idx], [idx, b]);
    }
  }
  return pts.filter((_, i) => keep[i]);
}

const round = (c) => [Math.round(c[0] * 1e5) / 1e5, Math.round(c[1] * 1e5) / 1e5];

async function getJson(url) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const r = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': 'lanekeeper-site-data/1.0 (+https://github.com/pauloes-btechs/lanekeeper)' } });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return await r.json();
    } catch (e) {
      if (attempt === 3) throw e;
      await new Promise((res) => setTimeout(res, 1500 * attempt));
    }
  }
}

async function fetchSocrata(src) {
  const features = [];
  const size = src.pageSize ?? 50_000;
  for (let offset = 0; ; offset += size) {
    const u = new URL(`${src.endpoint}.geojson`);
    u.searchParams.set('$where', src.where);
    u.searchParams.set('$limit', String(size));
    u.searchParams.set('$offset', String(offset));
    const page = await getJson(u);
    features.push(...(page.features ?? []));
    if ((page.features ?? []).length < size) break;
  }
  return features;
}

async function fetchArcgis(src) {
  const features = [];
  const size = src.pageSize ?? 1000;
  for (let offset = 0; ; offset += size) {
    const u = new URL(`${src.endpoint}/query`);
    u.searchParams.set('where', src.where);
    u.searchParams.set('outFields', src.protectedField ?? '*');
    u.searchParams.set('outSR', '4326');
    u.searchParams.set('returnGeometry', 'true');
    u.searchParams.set('resultOffset', String(offset));
    u.searchParams.set('resultRecordCount', String(size));
    u.searchParams.set('f', 'geojson');
    const page = await getJson(u);
    if (page.error) throw new Error(`ArcGIS error ${page.error.code}: ${page.error.message}`);
    features.push(...(page.features ?? []));
    const more = page.exceededTransferLimit || page.properties?.exceededTransferLimit || (page.features ?? []).length === size;
    if (!more || !(page.features ?? []).length) break;
  }
  return features;
}

// Flatten LineString / MultiLineString features into simplified, rounded line parts.
function toLines(features, field) {
  const lines = [];
  for (const f of features) {
    const g = f.geometry;
    if (!g) continue;
    const parts = g.type === 'LineString' ? [g.coordinates] : g.type === 'MultiLineString' ? g.coordinates : [];
    for (const p of parts) {
      const coords = p.filter((c) => Array.isArray(c) && Number.isFinite(c[0]) && Number.isFinite(c[1])).map((c) => [c[0], c[1]]);
      if (coords.length < 2) continue;
      const miles = lineMiles(coords);
      if (miles <= 0) continue;
      const simple = simplify(coords, 1e-5).map(round);
      lines.push({ coords: simple, miles, type: field ? String(f.properties?.[field] ?? '') : '' });
    }
  }
  return lines;
}

async function run() {
  const SOURCES = JSON.parse(readFileSync(resolve(here, 'cities.json'), 'utf8'));
  mkdirSync(OUT, { recursive: true });
  const manifestPath = resolve(OUT, 'cities.json');
  const prev = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : { cities: [], skipped: [] };
  const cities = new Map(prev.cities.map((c) => [c.slug, c]));
  const skipped = new Map((prev.skipped ?? []).map((c) => [c.slug, c]));

  for (const src of SOURCES) {
    if (only.length && !only.includes(src.slug)) continue;
    if (src.enabled === false) {
      skipped.set(src.slug, { slug: src.slug, name: src.name, reason: src.notes || 'No verified official dataset' });
      cities.delete(src.slug);
      continue;
    }
    process.stdout.write(`${src.name.padEnd(16)} `);
    try {
      const raw = src.type === 'socrata' ? await fetchSocrata(src) : await fetchArcgis(src);
      const lines = toLines(raw, src.protectedField);
      if (!lines.length) throw new Error('no protected lanes matched the filter');
      const miles = lines.reduce((s, l) => s + l.miles, 0);
      const byType = {};
      for (const l of lines) byType[l.type || 'protected'] = (byType[l.type || 'protected'] ?? 0) + l.miles;
      const geojson = {
        type: 'FeatureCollection',
        features: lines.map((l) => ({ type: 'Feature', properties: { t: l.type, mi: Math.round(l.miles * 1000) / 1000 }, geometry: { type: 'LineString', coordinates: l.coords } })),
      };
      writeFileSync(resolve(OUT, `${src.slug}.geojson`), JSON.stringify(geojson));
      cities.set(src.slug, {
        slug: src.slug,
        name: src.name,
        center: src.center,
        zoom: src.zoom,
        laneMiles: Math.round(miles * 10) / 10,
        segments: lines.length,
        byType: Object.fromEntries(Object.entries(byType).map(([k, v]) => [k, Math.round(v * 10) / 10])),
        filter: src.where,
        sourceName: src.sourceName,
        sourcePage: src.sourcePage,
        retrieved: today,
      });
      skipped.delete(src.slug);
      console.log(`${miles.toFixed(1)} mi in ${lines.length} segments`);
    } catch (e) {
      console.log(`skipped: ${e.message}`);
      if (!cities.has(src.slug)) skipped.set(src.slug, { slug: src.slug, name: src.name, reason: e.message, tried: today });
    }
  }

  const order = SOURCES.map((s) => s.slug);
  const sort = (a, b) => order.indexOf(a.slug) - order.indexOf(b.slug);
  const manifest = {
    note: 'Generated by web/scripts/fetch-city-data.mjs. Lane-miles are centreline miles of existing protected lanes, computed from each city’s own geometry.',
    cities: [...cities.values()].sort(sort),
    skipped: [...skipped.values()].sort(sort),
  };
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  if (!manifest.cities.length) {
    console.error('No city data was written.');
    process.exit(1);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await run();
