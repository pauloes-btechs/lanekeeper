import '@fontsource/ibm-plex-sans/latin-400.css';
import '@fontsource/ibm-plex-sans/latin-500.css';
import '@fontsource/ibm-plex-sans/latin-600.css';
import '@fontsource/ibm-plex-mono/latin-400.css';
import '@fontsource/ibm-plex-mono/latin-500.css';
import './style.css';
import { estimateCity, SCENARIOS } from './estimator.js';
import { initDemoForm } from './form.js';

const $ = (s) => document.querySelector(s);
const usd = (n) => (n >= 1e6 ? `$${(n / 1e6).toFixed(n >= 1e7 ? 1 : 2)}M` : `$${Math.round(n / 1000).toLocaleString('en-US')}k`);
const num = (n, d = 0) => n.toLocaleString('en-US', { maximumFractionDigits: d, minimumFractionDigits: d });

// Run fn once the element is within `margin` of the viewport.
function whenNear(el, fn, margin = '300px') {
  if (!el) return;
  if (!('IntersectionObserver' in window)) return fn();
  const io = new IntersectionObserver((entries) => {
    if (entries.some((e) => e.isIntersecting)) {
      io.disconnect();
      fn();
    }
  }, { rootMargin: margin });
  io.observe(el);
}

// ---------- 3D viewers (three.js loads only when a stage nears view) ----------
let viewerModule;
const loadViewer = () => (viewerModule ??= import('./robot/viewer.js'));

async function startViewer(stage, mode) {
  const mod = await loadViewer();
  if (!mod.webglAvailable()) {
    stage.classList.add('no-webgl');
    return null;
  }
  try {
    return await mod.mountViewer(stage, { mode });
  } catch (err) {
    console.warn('3D viewer failed, showing the render instead', err);
    stage.querySelectorAll('.viewer-canvas, .viewer-overlay, .hotspot-card').forEach((n) => n.remove());
    stage.classList.remove('ready');
    stage.classList.add('no-webgl');
    return null;
  }
}

whenNear($('#hero-stage'), () => startViewer($('#hero-stage'), 'hero'), '0px');

whenNear($('#inspect-stage'), async () => {
  const stage = $('#inspect-stage');
  const viewer = await startViewer(stage, 'inspect');
  const chips = stage.querySelectorAll('[data-view]');
  const partButtons = document.querySelectorAll('[data-hotspot]');
  if (!viewer) {
    partButtons.forEach((b) => (b.disabled = true));
    return;
  }
  chips.forEach((c) =>
    c.addEventListener('click', () => {
      chips.forEach((x) => x.setAttribute('aria-pressed', String(x === c)));
      viewer.setExploded(c.dataset.view === 'exploded');
      viewer.setDimensions(c.dataset.view === 'dimensions');
    }),
  );
  partButtons.forEach((b) =>
    b.addEventListener('click', () => {
      const i = Number(b.dataset.hotspot);
      const on = !b.classList.contains('on');
      partButtons.forEach((x) => x.classList.toggle('on', on && x === b));
      viewer.showHotspot(on ? i : -1);
    }),
  );
});

// ---------- cities: manifest, map, estimator ----------
const state = { city: null, passes: 1, scenario: 'base' };
let cityMap;

function renderEstimate() {
  const c = state.city;
  if (!c) return;
  const e = estimateCity(c.laneMiles, { scenario: state.scenario, passesPerWeek: state.passes });
  $('#est-robots').textContent = num(e.robots);
  $('#est-nightly').textContent = num(e.milesPerNight, 1);
  $('#est-robot-cost').textContent = usd(e.robotCost);
  $('#est-staffed-cost').textContent = usd(e.staffedCost);
  $('#est-sweepers').textContent = `${num(e.sweepers)} staffed sweeper${e.sweepers === 1 ? '' : 's'} with operators for the same coverage`;
  $('#est-saving').textContent = e.saving >= 0 ? `${usd(e.saving)} a year less` : `${usd(-e.saving)} a year more`;
}

function renderCity() {
  const c = state.city;
  $('#city-miles').innerHTML = '';
  const b = document.createElement('b');
  b.textContent = `${num(c.laneMiles, 1)} miles`;
  $('#city-miles').append(b, ` of protected lanes in ${c.segments.toLocaleString('en-US')} segments`);
  const src = $('#city-source');
  src.textContent = 'Lane data: ';
  const a = document.createElement('a');
  a.href = c.sourcePage;
  a.textContent = c.sourceName;
  a.rel = 'noopener';
  src.append(a, `, retrieved ${c.retrieved}. Protected lanes only.`);
  renderEstimate();
  cityMap?.show(c).catch((err) => console.warn(err));
}

async function initCities() {
  const select = $('#city-select');
  let manifest;
  try {
    const r = await fetch(`${import.meta.env.BASE_URL}data/cities.json`);
    manifest = await r.json();
  } catch {
    $('#city-miles').textContent = 'City data could not load. Refresh to try again.';
    return;
  }
  const cities = manifest.cities;
  const datalist = $('#city-options');
  for (const c of cities) {
    const o = document.createElement('option');
    o.value = c.slug;
    o.textContent = c.name;
    select.append(o);
    const d = document.createElement('option');
    d.value = c.name;
    datalist.append(d);
  }
  const fromHash = cities.find((c) => `#city-${c.slug}` === location.hash);
  state.city = fromHash ?? cities[0];
  select.value = state.city.slug;
  select.addEventListener('change', () => {
    state.city = cities.find((c) => c.slug === select.value);
    renderCity();
  });
  document.querySelectorAll('input[name="passes"]').forEach((i) =>
    i.addEventListener('change', () => {
      state.passes = Number(i.value);
      renderEstimate();
    }),
  );
  document.querySelectorAll('input[name="scenario"]').forEach((i) =>
    i.addEventListener('change', () => {
      state.scenario = i.value;
      renderEstimate();
    }),
  );
  renderCity();

  // Prefill the demo form from the city being explored.
  select.addEventListener('change', () => {
    const f = $('#f-city');
    if (!f.dataset.touched) f.value = state.city.name;
    const m = $('#f-miles');
    if (!m.dataset.touched) m.value = state.city.laneMiles;
  });
  for (const id of ['#f-city', '#f-miles']) $(id).addEventListener('input', (e) => (e.target.dataset.touched = '1'));
}

whenNear($('#city'), async () => {
  await initCities();
  const el = $('#map');
  const { webglAvailable } = await loadViewer();
  if (!webglAvailable()) {
    $('#map-fallback').hidden = false;
    return;
  }
  try {
    const { createCityMap } = await import('./map.js');
    cityMap = await createCityMap(el);
    if (state.city) await cityMap.show(state.city);
  } catch (err) {
    console.warn('Map failed to load', err);
    $('#map-fallback').hidden = false;
  }
});

// keep the assumptions table tied to the model
$('#as-staffed').textContent = `$${SCENARIOS.base.today.perMi.toFixed(2)}`;
$('#as-robot').textContent = `$${SCENARIOS.base.robot.perMi.toFixed(2)}`;

initDemoForm($('#demo-form'));
