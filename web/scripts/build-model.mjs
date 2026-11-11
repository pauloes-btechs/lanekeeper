// Exports the LK-01 model to web/public/models/lk-01.glb.
// Run with `npm run model` after changing src/robot/model.js, and commit the result.
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// GLTFExporter reads its buffers through FileReader, which Node does not have.
globalThis.FileReader = class {
  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then((buf) => {
      this.result = buf;
      this.onloadend?.();
    });
  }
  readAsDataURL(blob) {
    blob.arrayBuffer().then((buf) => {
      this.result = `data:${blob.type};base64,${Buffer.from(buf).toString('base64')}`;
      this.onloadend?.();
    });
  }
};

const { GLTFExporter } = await import('three/addons/exporters/GLTFExporter.js');
const { buildRobot, measure } = await import('../src/robot/model.js');

const robot = buildRobot();
const size = measure(robot);
let tris = 0;
robot.traverse((o) => {
  if (o.isMesh) tris += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3;
});

const glb = await new GLTFExporter().parseAsync(robot, { binary: true });
const out = resolve(dirname(fileURLToPath(import.meta.url)), '../public/models/lk-01.glb');
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, Buffer.from(glb));
console.log(
  `lk-01.glb ${(glb.byteLength / 1024).toFixed(0)} KB, ${Math.round(tris).toLocaleString('en-US')} triangles, ` +
    `${(size.length * 1000).toFixed(0)} x ${(size.width * 1000).toFixed(0)} x ${(size.height * 1000).toFixed(0)} mm`,
);
