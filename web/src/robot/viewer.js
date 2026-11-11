// Loads public/models/lk-01.glb into a canvas. Two modes:
//   hero    - slow turntable, drag to turn, no UI
//   inspect - orbit, exploded view, hotspots, dimension lines
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const MODEL_URL = `${import.meta.env.BASE_URL}models/lk-01.glb`;
let gltfPromise;
const loadModel = () => (gltfPromise ??= new GLTFLoader().loadAsync(MODEL_URL));

const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

export function webglAvailable() {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

// Hotspots: part name, label, one line of detail, local anchor offset (m) from the part's centre.
export const HOTSPOTS = [
  { part: 'sensor', label: 'Stereo camera + strobe', text: 'Two lenses 410 mm off the ground, tilted 20° down. A cross-polarized strobe makes glass flash so the on-board detector reacts in under 50 ms.', offset: [0, 0.03, 0.04] },
  { part: 'sensor', label: 'Gemini vision', text: 'Flagged frames go to Google DeepMind Gemini Robotics-ER 2, which confirms glass, points at each cluster and counts the pieces, ruling out ice, plastic and wet leaves.', offset: [0.16, 0.06, 0.02] },
  { part: 'broom_left', label: 'Side brooms', text: 'Two 340 mm nylon brooms sweep a 900 mm path into a centre roller and vacuum.', offset: [0, 0.02, 0.06] },
  { part: 'hopper', label: 'Sealed glass hopper', text: '60 L bin with a puncture-proof liner. Glass goes in; nothing rattles back out onto the lane.', offset: [0, 0.06, 0] },
  { part: 'mast', label: 'Beacon + GNSS', text: 'Amber beacon for visibility at 4 a.m. RTK GNSS places every cleared spot in a 25 m lane cell.', offset: [0.24, 0.04, -0.42] },
  { part: 'chassis', label: 'Dock contacts', text: 'Rear contacts let the robot charge itself at the depot between night runs, about 3 hours.', offset: [0, -0.02, -0.66] },
];

export async function mountViewer(container, { mode = 'hero', onReady } = {}) {
  const inspect = mode === 'inspect';
  const canvas = document.createElement('canvas');
  canvas.className = 'viewer-canvas';
  canvas.setAttribute('aria-label', 'Interactive 3D model of the LK-01 bike-lane sweeper');
  container.prepend(canvas);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.7;

  const camera = new THREE.PerspectiveCamera(inspect ? 32 : 28, 1, 0.05, 50);
  camera.position.set(inspect ? 2.1 : 2.5, inspect ? 1.25 : 1.05, inspect ? 2.4 : 2.6);

  const key = new THREE.DirectionalLight(0xffe2c4, 2.2);
  key.position.set(2.5, 4, 2);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, { left: -1.5, right: 1.5, top: 1.5, bottom: -1.5, near: 0.5, far: 10 });
  key.shadow.radius = 4;
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x9fe8ff, 1.4);
  rim.position.set(-3, 2, -3);
  scene.add(rim);
  scene.add(new THREE.HemisphereLight(0x8fa6d6, 0x0a0d14, 0.6));

  // A short stretch of green lane with lane lines, so scale reads at a glance.
  const ground = new THREE.Group();
  const laneMat = new THREE.MeshStandardMaterial({ color: 0x2f7d55, roughness: 0.85 });
  const lane = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 6), laneMat);
  lane.rotation.x = -Math.PI / 2;
  lane.receiveShadow = true;
  ground.add(lane);
  const lineMat = new THREE.MeshStandardMaterial({ color: 0xe9e6dc, roughness: 0.6 });
  for (const x of [-0.8, 0.8]) {
    const l = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 6), lineMat);
    l.rotation.x = -Math.PI / 2;
    l.position.set(x, 0.001, 0);
    ground.add(l);
  }
  const fade = new THREE.Mesh(new THREE.CircleGeometry(3, 48), new THREE.ShadowMaterial({ opacity: 0.35 }));
  fade.rotation.x = -Math.PI / 2;
  fade.position.y = 0.002;
  fade.receiveShadow = true;
  ground.add(fade);
  scene.add(ground);
  scene.fog = new THREE.Fog(0x080c15, 3.5, 7);

  const controls = new OrbitControls(camera, canvas);
  controls.target.set(0, 0.25, 0);
  controls.enableDamping = true;
  controls.enablePan = false;
  controls.minDistance = 1.2;
  controls.maxDistance = 5;
  controls.maxPolarAngle = Math.PI * 0.49;
  controls.autoRotate = !reduced();
  controls.autoRotateSpeed = inspect ? 0.6 : 0.9;
  controls.enableZoom = inspect;
  controls.update();

  let gltf;
  try {
    gltf = await loadModel();
  } catch (err) {
    canvas.remove();
    renderer.dispose();
    throw err;
  }
  const robot = gltf.scene.clone(true);
  robot.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  scene.add(robot);

  // GLTFLoader wraps the exported root in a scene node; the named parts sit under LK-01.
  const body = robot.getObjectByName('LK-01') ?? robot;
  const parts = {};
  for (const g of body.children) {
    parts[g.name] = { obj: g, home: g.position.clone(), explode: new THREE.Vector3(...(g.userData.explode ?? [0, 0, 0])) };
  }

  // ---------- exploded view ----------
  let explodeTarget = 0;
  let explodeT = 0;
  const setExploded = (on) => {
    explodeTarget = on ? 1 : 0;
    if (reduced()) explodeT = explodeTarget;
  };

  // ---------- dimension lines ----------
  const dims = new THREE.Group();
  dims.visible = false;
  scene.add(dims);
  const dimMat = new THREE.LineBasicMaterial({ color: 0xffad4d });
  const dimLabels = [];
  const dimLine = (a, b, label) => {
    const g = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(...a), new THREE.Vector3(...b)]);
    dims.add(new THREE.Line(g, dimMat));
    for (const p of [a, b]) {
      const t = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(...p).add(new THREE.Vector3(0, -0.03, 0)), new THREE.Vector3(...p).add(new THREE.Vector3(0, 0.03, 0))]);
      dims.add(new THREE.Line(t, dimMat));
    }
    dimLabels.push({ pos: new THREE.Vector3((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2), label });
  };
  dimLine([0.48, 0.02, -0.65], [0.48, 0.02, 0.65], '1300 mm');
  dimLine([-0.4, 0.62, -0.7], [0.4, 0.62, -0.7], '800 mm');
  dimLine([0.48, 0, -0.72], [0.48, 0.55, -0.72], '550 mm');
  dimLine([-0.45, 0.005, 0.85], [0.45, 0.005, 0.85], '900 mm sweep');

  // ---------- HTML overlays (hotspots + dimension labels) ----------
  const overlay = document.createElement('div');
  overlay.className = 'viewer-overlay';
  container.append(overlay);
  const hotspotEls = [];
  const dimEls = dimLabels.map((d) => {
    const el = document.createElement('span');
    el.className = 'dim-label';
    el.textContent = d.label;
    el.hidden = true;
    overlay.append(el);
    return el;
  });

  let activeHotspot = -1;
  const card = document.createElement('div');
  card.className = 'hotspot-card';
  card.hidden = true;
  card.setAttribute('role', 'status');
  if (inspect) {
    container.append(card);
    HOTSPOTS.forEach((h, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'hotspot';
      b.textContent = String(i + 1);
      b.setAttribute('aria-label', h.label);
      b.addEventListener('click', () => showHotspot(i === activeHotspot ? -1 : i));
      overlay.append(b);
      hotspotEls.push(b);
    });
  }
  function showHotspot(i) {
    activeHotspot = i;
    hotspotEls.forEach((b, k) => b.classList.toggle('on', k === i));
    if (i < 0) {
      card.hidden = true;
      return;
    }
    card.hidden = false;
    card.innerHTML = '';
    const t = document.createElement('strong');
    t.textContent = `${i + 1}. ${HOTSPOTS[i].label}`;
    const p = document.createElement('p');
    p.textContent = HOTSPOTS[i].text;
    card.append(t, p);
    controls.autoRotate = false;
  }

  const centre = (name) => {
    if (!parts[name]) return new THREE.Vector3(0, 0.3, 0);
    const box = new THREE.Box3().setFromObject(parts[name].obj);
    return box.getCenter(new THREE.Vector3());
  };
  const v = new THREE.Vector3();
  function place(el, worldPos, w, h) {
    v.copy(worldPos).project(camera);
    const behind = v.z > 1;
    el.style.transform = `translate(${((v.x + 1) / 2) * w}px, ${((1 - v.y) / 2) * h}px) translate(-50%, -50%)`;
    el.style.visibility = behind ? 'hidden' : 'visible';
  }

  // ---------- sizing + loop ----------
  let w = 0;
  let h = 0;
  const resize = () => {
    w = container.clientWidth;
    h = container.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // keep the whole robot in frame on tall phone screens
    camera.position.setLength(camera.aspect < 0.9 ? (inspect ? 4.1 : 4.2) : inspect ? 3.45 : 3.6);
    camera.updateProjectionMatrix();
  };
  new ResizeObserver(resize).observe(container);
  resize();

  let visible = true;
  new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    if (visible) loop();
  }).observe(container);

  const clock = new THREE.Clock();
  let raf = 0;
  function loop() {
    cancelAnimationFrame(raf);
    if (!visible || document.hidden) return;
    const dt = Math.min(clock.getDelta(), 0.05);
    if (explodeT !== explodeTarget) {
      explodeT += Math.sign(explodeTarget - explodeT) * dt * 2.2;
      explodeT = THREE.MathUtils.clamp(explodeT, 0, 1);
    }
    const e = explodeT * explodeT * (3 - 2 * explodeT);
    for (const p of Object.values(parts)) p.obj.position.copy(p.home).addScaledVector(p.explode, e);
    controls.update();
    renderer.render(scene, camera);
    if (inspect) {
      HOTSPOTS.forEach((hs, i) => place(hotspotEls[i], centre(hs.part).add(new THREE.Vector3(...hs.offset)), w, h));
      dimLabels.forEach((d, i) => {
        dimEls[i].hidden = !dims.visible;
        if (dims.visible) place(dimEls[i], d.pos, w, h);
      });
    }
    raf = requestAnimationFrame(loop);
  }
  document.addEventListener('visibilitychange', () => !document.hidden && loop());
  canvas.addEventListener('pointerdown', () => {
    if (!inspect) controls.autoRotate = false;
  });
  loop();
  container.classList.add('ready');
  onReady?.();

  return {
    setExploded,
    setDimensions(on) {
      dims.visible = on;
      if (on) setExploded(false);
    },
    setAutoRotate(on) {
      controls.autoRotate = on && !reduced();
    },
    showHotspot,
  };
}
