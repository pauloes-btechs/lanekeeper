// MapLibre map of one city's protected lanes. Loaded only when the city section nears view.
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { BASEMAP_STYLE } from './config.js';

const LANE = '#3d9b6a';
const GLINT = '#9fe8ff';

// Plain dark style used when the basemap can't load (offline, blocked, tiles down).
const FALLBACK_STYLE = {
  version: 8,
  sources: {},
  layers: [{ id: 'bg', type: 'background', paint: { 'background-color': '#0b111d' } }],
};

async function pickStyle() {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 4000);
    const r = await fetch(BASEMAP_STYLE, { signal: ctrl.signal });
    clearTimeout(t);
    if (!r.ok) throw new Error(String(r.status));
    return BASEMAP_STYLE;
  } catch {
    return FALLBACK_STYLE;
  }
}

function boundsOf(geojson) {
  const b = new maplibregl.LngLatBounds();
  for (const f of geojson.features) for (const c of f.geometry.coordinates) b.extend(c);
  return b;
}

export async function createCityMap(el) {
  const style = await pickStyle();
  const map = new maplibregl.Map({
    container: el,
    style,
    center: [-73.97, 40.75],
    zoom: 11,
    attributionControl: { compact: true },
    cooperativeGestures: matchMedia('(pointer: coarse)').matches,
    dragRotate: false,
    pitchWithRotate: false,
  });
  map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
  if (style === FALLBACK_STYLE) {
    map.addControl(new maplibregl.AttributionControl({ customAttribution: 'Basemap unavailable · lane data from city open data' }));
  }
  await new Promise((res) => (map.loaded() ? res() : map.once('load', res)));

  map.addSource('lanes', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
  map.addLayer({ id: 'lanes-glow', type: 'line', source: 'lanes', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': LANE, 'line-width': ['interpolate', ['linear'], ['zoom'], 10, 4, 15, 14], 'line-blur': 6, 'line-opacity': 0.45 } });
  map.addLayer({ id: 'lanes', type: 'line', source: 'lanes', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': LANE, 'line-width': ['interpolate', ['linear'], ['zoom'], 10, 1.4, 15, 4.5] } });
  map.addLayer({ id: 'lanes-hover', type: 'line', source: 'lanes', filter: ['==', ['id'], -1], paint: { 'line-color': GLINT, 'line-width': ['interpolate', ['linear'], ['zoom'], 10, 3, 15, 7] } });

  const popup = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 8 });
  map.on('mousemove', 'lanes', (e) => {
    const f = e.features?.[0];
    if (!f) return;
    map.getCanvas().style.cursor = 'pointer';
    map.setFilter('lanes-hover', ['==', ['id'], f.id]);
    const type = f.properties.t || 'Protected lane';
    const ft = Math.round(Number(f.properties.mi) * 5280);
    popup.setLngLat(e.lngLat).setText(`${type} · ${ft.toLocaleString('en-US')} ft`).addTo(map);
  });
  map.on('mouseleave', 'lanes', () => {
    map.getCanvas().style.cursor = '';
    map.setFilter('lanes-hover', ['==', ['id'], -1]);
    popup.remove();
  });

  const cache = new Map();
  return {
    map,
    async show(city) {
      let data = cache.get(city.slug);
      if (!data) {
        const r = await fetch(`${import.meta.env.BASE_URL}data/${city.slug}.geojson`);
        if (!r.ok) throw new Error(`No lane data for ${city.name}`);
        data = await r.json();
        data.features.forEach((f, i) => (f.id = i));
        cache.set(city.slug, data);
      }
      map.getSource('lanes').setData(data);
      const b = boundsOf(data);
      const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (!b.isEmpty()) map.fitBounds(b, { padding: 28, duration: reduced ? 0 : 900, maxZoom: 13 });
      else map.jumpTo({ center: city.center, zoom: city.zoom });
    },
  };
}
