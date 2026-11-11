import { describe, it, expect } from 'vitest';
import { buildRobot, measure, DIMS } from '../src/robot/model.js';

describe('LK-01 model', () => {
  const robot = buildRobot();
  const m = measure(robot);

  it('body fits the 1300 x 800 x 550 mm envelope (bumpers and brooms aside)', () => {
    expect(m.height).toBeGreaterThan(0.54);
    expect(m.height).toBeLessThan(0.56);
    expect(m.length).toBeLessThan(DIMS.length + 0.03);
  });

  it('brooms span the 900 mm sweep path', () => {
    const outer = DIMS.broomX + DIMS.broomRadius;
    expect(outer * 2).toBeCloseTo(DIMS.sweepPath, 2);
    expect(m.width).toBeGreaterThan(DIMS.sweepPath);
  });

  it('has every part the site labels and explodes', () => {
    const names = robot.children.map((c) => c.name);
    for (const n of ['chassis', 'power', 'shell', 'sensor', 'hopper', 'mast', 'broom_left', 'broom_right', 'wheel_fl', 'wheel_rr']) {
      expect(names).toContain(n);
    }
    for (const c of robot.children) expect(c.userData.explode).toHaveLength(3);
  });
});
