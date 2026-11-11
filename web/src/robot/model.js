// LK-01 parametric model. Pure three.js with no DOM access, so the same code runs in Node
// (scripts/build-model.mjs exports it to public/models/lk-01.glb) and in the browser.
// Units are metres. Front of the robot is +Z, up is +Y. Numbers match prototype/drawings.py.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const DIMS = {
  length: 1.3, width: 0.8, height: 0.55,
  shellTop: 0.5, tubBottom: 0.08, tubTop: 0.28,
  wheelRadius: 0.11, track: 0.73, axleFront: 0.4, axleRear: -0.42,
  broomRadius: 0.17, broomX: 0.28, broomZ: 0.47, sweepPath: 0.9,
  cameraHeight: 0.41, cameraTiltDeg: 20,
};

// Deterministic pseudo-random so the exported GLB is byte-stable between builds.
function rng(seed) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}

function materials() {
  const std = (o) => new THREE.MeshStandardMaterial(o);
  return {
    shell: new THREE.MeshPhysicalMaterial({ name: 'shell-white', color: 0xeceae4, roughness: 0.3, clearcoat: 0.8, clearcoatRoughness: 0.2 }),
    graphite: std({ name: 'graphite', color: 0x23262b, roughness: 0.55, metalness: 0.3 }),
    frame: std({ name: 'frame-aluminium', color: 0x8a9099, roughness: 0.4, metalness: 0.85 }),
    rubber: std({ name: 'rubber', color: 0x131313, roughness: 0.92 }),
    green: new THREE.MeshPhysicalMaterial({ name: 'lane-green', color: 0x2f8f5b, roughness: 0.38, clearcoat: 0.6 }),
    smoked: new THREE.MeshPhysicalMaterial({ name: 'smoked-glass', color: 0x0c0f13, roughness: 0.08, metalness: 0.1, clearcoat: 1 }),
    lens: new THREE.MeshPhysicalMaterial({ name: 'lens', color: 0x1b2a3a, roughness: 0.03, metalness: 0.9, clearcoat: 1 }),
    bristle: std({ name: 'bristle-nylon', color: 0xd8902a, roughness: 0.65 }),
    amber: std({ name: 'beacon-amber', color: 0xffa13a, emissive: 0xff8a1a, emissiveIntensity: 1.6, roughness: 0.25 }),
    ledWhite: std({ name: 'led-white', color: 0xffffff, emissive: 0xeaf4ff, emissiveIntensity: 2.2 }),
    ledRed: std({ name: 'led-red', color: 0x400000, emissive: 0xff2a1a, emissiveIntensity: 2 }),
    strobe: std({ name: 'strobe-ring', color: 0xffffff, emissive: 0xcfe9ff, emissiveIntensity: 1.6 }),
    copper: std({ name: 'dock-contact', color: 0xc9a14a, metalness: 1, roughness: 0.25 }),
    battery: std({ name: 'battery-case', color: 0x2b3440, roughness: 0.5, metalness: 0.5 }),
    hv: std({ name: 'hv-orange', color: 0xe8792a, roughness: 0.5 }),
    hopper: std({ name: 'hopper-liner', color: 0x3a4250, roughness: 0.6, metalness: 0.2 }),
    board: std({ name: 'compute-heatsink', color: 0x5b626c, roughness: 0.35, metalness: 0.9 }),
  };
}

export function buildRobot() {
  const M = materials();
  const D = DIMS;
  const root = new THREE.Group();
  root.name = 'LK-01';

  // A named part group. `explode` is the offset (m) the part moves in the exploded view.
  const part = (name, label, explode) => {
    const g = new THREE.Group();
    g.name = name;
    g.userData = { part: name, label, explode };
    root.add(g);
    return g;
  };
  const mesh = (parent, geo, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.rotation.set(rx, ry, rz);
    parent.add(m);
    return m;
  };
  const rbox = (w, h, d, r, seg = 4) => new RoundedBoxGeometry(w, h, d, seg, r);

  // ---------- chassis: tub, bumpers, lights, pickup roller ----------
  const chassis = part('chassis', 'Chassis and pickup', [0, 0, 0]);
  mesh(chassis, rbox(D.width, 0.2, D.length, 0.04, 6), M.graphite, 0, 0.18, 0);
  mesh(chassis, rbox(D.width - 0.02, 0.05, D.length - 0.02, 0.02), M.green, 0, 0.295, 0);
  mesh(chassis, rbox(D.width - 0.04, 0.06, 0.05, 0.025, 3), M.rubber, 0, 0.13, 0.627);
  mesh(chassis, rbox(D.width - 0.04, 0.05, 0.04, 0.02, 3), M.rubber, 0, 0.13, -0.63);
  mesh(chassis, rbox(0.6, 0.022, 0.012, 0.006, 2), M.ledWhite, 0, 0.245, 0.652);
  for (const x of [-0.3, 0.3]) mesh(chassis, rbox(0.12, 0.03, 0.012, 0.006, 2), M.ledRed, x, 0.245, -0.652);
  for (const x of [-0.08, 0.08]) mesh(chassis, new THREE.BoxGeometry(0.05, 0.02, 0.012), M.copper, x, 0.17, -0.655);
  // skid plate and axles
  mesh(chassis, rbox(0.6, 0.012, 1.1, 0.005, 2), M.frame, 0, 0.078, 0);
  for (const z of [D.axleFront, D.axleRear]) {
    mesh(chassis, new THREE.CylinderGeometry(0.018, 0.018, D.track - 0.07, 16), M.frame, 0, D.wheelRadius, z, 0, 0, Math.PI / 2);
  }
  // wheel arches
  for (const x of [-1, 1]) for (const z of [D.axleFront, D.axleRear]) {
    const arch = new THREE.TorusGeometry(0.128, 0.012, 8, 24, Math.PI);
    mesh(chassis, arch, M.rubber, x * (D.width / 2 - 0.001), D.wheelRadius + 0.004, z, 0, Math.PI / 2, 0);
  }
  // centre pickup: roller brush under the body with a vacuum intake behind it
  mesh(chassis, rbox(0.62, 0.05, 0.16, 0.02, 3), M.graphite, 0, 0.085, 0.16);
  {
    const R = rng(7);
    const core = new THREE.CylinderGeometry(0.03, 0.03, 0.58, 16);
    core.rotateZ(Math.PI / 2);
    const tufts = [core];
    for (let i = 0; i < 150; i++) {
      const t = new THREE.CylinderGeometry(0.003, 0.004, 0.03, 4);
      t.translate(0, 0.042, 0);
      t.rotateX(R() * Math.PI * 2);
      t.translate(-0.28 + (i / 150) * 0.56, 0, 0);
      tufts.push(t);
    }
    mesh(chassis, mergeGeometries(tufts), M.bristle, 0, 0.052, 0.16);
  }
  mesh(chassis, rbox(0.5, 0.03, 0.06, 0.012, 2), M.rubber, 0, 0.062, 0.05);
  // side reflectors
  for (const x of [-1, 1]) for (const z of [0.5, -0.52]) {
    mesh(chassis, new THREE.BoxGeometry(0.006, 0.02, 0.07), z > 0 ? M.amber : M.ledRed, x * (D.width / 2 + 0.001), 0.2, z);
  }

  // ---------- battery and compute: revealed when the shell lifts ----------
  const power = part('power', 'Battery and edge computer', [0, 0.16, 0]);
  mesh(power, rbox(0.5, 0.12, 0.46, 0.015, 2), M.battery, 0, 0.36, 0.12);
  for (let i = 0; i < 6; i++) mesh(power, new THREE.BoxGeometry(0.46, 0.006, 0.012), M.frame, 0, 0.423, -0.06 + i * 0.072);
  mesh(power, new THREE.BoxGeometry(0.502, 0.02, 0.1), M.hv, 0, 0.36, 0.3);
  mesh(power, new THREE.CylinderGeometry(0.012, 0.012, 0.2, 10), M.hv, 0.2, 0.33, -0.2, Math.PI / 2, 0, 0);
  // edge computer with heat-sink fins, behind the camera
  mesh(power, rbox(0.24, 0.04, 0.16, 0.008, 2), M.graphite, 0, 0.33, 0.46);
  for (let i = 0; i < 9; i++) mesh(power, new THREE.BoxGeometry(0.008, 0.03, 0.14), M.board, -0.096 + i * 0.024, 0.365, 0.46);

  // ---------- upper shell ----------
  const shell = part('shell', 'Upper shell', [0, 0.42, 0]);
  mesh(shell, rbox(D.width - 0.06, 0.2, D.length - 0.16, 0.035, 6), M.shell, 0, 0.4, 0);
  mesh(shell, rbox(D.width - 0.1, 0.085, 0.02, 0.008), M.smoked, 0, 0.41, 0.565);
  // panel seams and cooling louvres
  for (const x of [-1, 1]) {
    mesh(shell, new THREE.BoxGeometry(0.004, 0.19, 0.006), M.graphite, x * (D.width / 2 - 0.029), 0.4, 0.08);
    for (let i = 0; i < 5; i++) {
      mesh(shell, new THREE.BoxGeometry(0.006, 0.008, 0.16), M.graphite, x * (D.width / 2 - 0.0285), 0.44 - i * 0.02, 0.36);
    }
    mesh(shell, rbox(0.01, 0.03, 0.09, 0.004, 2), M.graphite, x * (D.width / 2 - 0.028), 0.42, -0.2);
  }
  mesh(shell, new THREE.BoxGeometry(D.width - 0.1, 0.004, 0.006), M.graphite, 0, 0.5005, 0.07);

  // ---------- sensor pod: stereo camera + polarized strobe ----------
  const sensor = part('sensor', 'Stereo camera and strobe', [0, 0.1, 0.34]);
  {
    const pod = new THREE.Group();
    pod.position.set(0, D.cameraHeight, 0.578);
    pod.rotation.x = THREE.MathUtils.degToRad(D.cameraTiltDeg);
    sensor.add(pod);
    mesh(pod, rbox(0.3, 0.07, 0.03, 0.012, 3), M.smoked, 0, 0, 0);
    for (const x of [-0.07, 0.07]) {
      mesh(pod, new THREE.CylinderGeometry(0.026, 0.026, 0.02, 32), M.graphite, x, 0, 0.018, Math.PI / 2, 0, 0);
      mesh(pod, new THREE.CylinderGeometry(0.021, 0.021, 0.006, 32), M.frame, x, 0, 0.027, Math.PI / 2, 0, 0);
      mesh(pod, new THREE.SphereGeometry(0.018, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), M.lens, x, 0, 0.026, Math.PI / 2, 0, 0);
    }
    mesh(pod, new THREE.TorusGeometry(0.03, 0.004, 12, 48), M.strobe, 0, 0, 0.019);
    mesh(pod, new THREE.CylinderGeometry(0.008, 0.008, 0.004, 16), M.lens, 0, 0, 0.018, Math.PI / 2, 0, 0);
  }
  // ultrasonic stop sensors in the bumper line
  for (const x of [-0.3, -0.1, 0.1, 0.3]) {
    mesh(sensor, new THREE.CylinderGeometry(0.012, 0.012, 0.008, 16), M.frame, x, 0.2, 0.653, Math.PI / 2, 0, 0);
  }

  // ---------- hopper: sealed glass bin with a smoked lid ----------
  const hopper = part('hopper', 'Sealed glass hopper', [0, 0.72, -0.12]);
  mesh(hopper, rbox(0.62, 0.035, 0.44, 0.015), M.smoked, 0, 0.5175, -0.3);
  mesh(hopper, rbox(0.22, 0.018, 0.035, 0.008, 3), M.frame, 0, 0.543, -0.11);
  for (const x of [-0.22, 0.22]) mesh(hopper, new THREE.CylinderGeometry(0.01, 0.01, 0.06, 12), M.frame, x, 0.52, -0.525, 0, 0, Math.PI / 2);
  // bin body sits inside the shell: visible in the exploded view
  mesh(hopper, rbox(0.56, 0.17, 0.38, 0.03), M.hopper, 0, 0.41, -0.3);
  mesh(hopper, new THREE.BoxGeometry(0.565, 0.012, 0.385), M.hv, 0, 0.49, -0.3);

  // ---------- beacon, GNSS antenna, rear camera ----------
  const mast = part('mast', 'Beacon and GNSS', [0, 0.95, 0]);
  mesh(mast, new THREE.CylinderGeometry(0.036, 0.04, 0.012, 24), M.graphite, 0.24, 0.506, -0.42 + 0.84 * 0);
  mesh(mast, new THREE.CylinderGeometry(0.03, 0.034, 0.038, 24), M.amber, 0.24, 0.531, -0.42 + 0.84 * 0);
  mesh(mast, new THREE.CylinderGeometry(0.045, 0.05, 0.016, 28), M.shell, -0.24, 0.508, 0.36);
  mesh(mast, new THREE.CylinderGeometry(0.05, 0.05, 0.004, 28), M.graphite, -0.24, 0.502, 0.36);
  mesh(mast, rbox(0.07, 0.035, 0.03, 0.01, 2), M.smoked, 0, 0.44, -0.582);
  mesh(mast, new THREE.CylinderGeometry(0.011, 0.011, 0.008, 20), M.lens, 0, 0.44, -0.6, Math.PI / 2, 0, 0);

  // ---------- side brooms ----------
  const broom = (name, label, s) => {
    const g = part(name, label, [s * 0.2, -0.02, 0.3]);
    const b = new THREE.Group();
    b.position.set(s * D.broomX, 0.07, D.broomZ);
    g.add(b);
    mesh(b, new THREE.CylinderGeometry(0.075, 0.08, 0.05, 32), M.graphite);
    mesh(b, new THREE.CylinderGeometry(0.03, 0.03, 0.03, 20), M.frame, 0, 0.04, 0);
    // drive arm back to the chassis
    const arm = mesh(b, rbox(0.045, 0.03, 0.2, 0.01, 2), M.frame, -s * 0.05, 0.05, -0.1);
    arm.rotation.y = s * 0.45;
    mesh(b, new THREE.CylinderGeometry(0.02, 0.02, 0.05, 16), M.graphite, -s * 0.095, 0.05, -0.19);
    const R = rng(s > 0 ? 11 : 23);
    const tufts = [];
    const n = 240;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + R() * 0.05;
      const splay = 1.0 + R() * 0.16;
      const t = new THREE.CylinderGeometry(0.0022, 0.003, 0.13, 4);
      t.translate(0, -0.065, 0);
      t.rotateZ(splay); // lean outward
      t.rotateY(-a);
      t.translate(Math.cos(a) * 0.06, 0, Math.sin(a) * 0.06);
      tufts.push(t);
    }
    mesh(b, mergeGeometries(tufts), M.bristle);
    return g;
  };
  broom('broom_left', 'Side broom', -1);
  broom('broom_right', 'Side broom', 1);

  // ---------- wheels ----------
  const tireProfile = [];
  for (let i = 0; i <= 14; i++) {
    const t = (i / 14) * Math.PI;
    // rounded-shoulder tyre cross-section, 70 mm wide
    tireProfile.push(new THREE.Vector2(D.wheelRadius - 0.03 + Math.sin(t) * 0.03, -0.035 + (i / 14) * 0.07));
  }
  const tireGeo = new THREE.LatheGeometry(tireProfile, 40);
  tireGeo.rotateZ(Math.PI / 2);
  const treads = [];
  for (let i = 0; i < 28; i++) {
    const t = new THREE.BoxGeometry(0.06, 0.006, 0.012);
    t.translate(0, D.wheelRadius - 0.001, 0);
    t.rotateX((i / 28) * Math.PI * 2);
    treads.push(t);
  }
  const treadGeo = mergeGeometries(treads);
  const spokeGeos = [];
  for (let i = 0; i < 5; i++) {
    const s = new THREE.BoxGeometry(0.012, 0.062, 0.016);
    s.translate(0, 0.04, 0);
    s.rotateX((i / 5) * Math.PI * 2);
    spokeGeos.push(s);
  }
  const spokeGeo = mergeGeometries(spokeGeos);
  const wheel = (name, x, z) => {
    const g = part(name, 'Drive wheel', [Math.sign(x) * 0.22, 0, 0]);
    const w = new THREE.Group();
    w.position.set(x, D.wheelRadius, z);
    g.add(w);
    mesh(w, tireGeo, M.rubber);
    mesh(w, treadGeo, M.rubber);
    mesh(w, new THREE.CylinderGeometry(0.078, 0.078, 0.05, 32, 1, true), M.frame, 0, 0, 0, 0, 0, Math.PI / 2);
    mesh(w, spokeGeo, M.frame, Math.sign(x) * 0.012, 0, 0);
    mesh(w, new THREE.CylinderGeometry(0.024, 0.024, 0.062, 20), M.graphite, 0, 0, 0, 0, 0, Math.PI / 2);
    // hub motor housing on the inside
    mesh(w, new THREE.CylinderGeometry(0.05, 0.05, 0.03, 24), M.graphite, -Math.sign(x) * 0.03, 0, 0, 0, 0, Math.PI / 2);
    return g;
  };
  wheel('wheel_fl', -D.track / 2, D.axleFront);
  wheel('wheel_fr', D.track / 2, D.axleFront);
  wheel('wheel_rl', -D.track / 2, D.axleRear);
  wheel('wheel_rr', D.track / 2, D.axleRear);

  root.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  return root;
}

// Bounding box of the assembled robot, used by the tests and the dimension overlay.
export function measure(root = buildRobot()) {
  const box = new THREE.Box3().setFromObject(root);
  const size = box.getSize(new THREE.Vector3());
  return { width: size.x, height: box.max.y, length: size.z, min: box.min, max: box.max };
}
