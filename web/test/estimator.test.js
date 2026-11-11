import { describe, it, expect } from 'vitest';
import { SCENARIOS, estimateCity, DSNY_UNIT_CAPEX } from '../src/estimator.js';

// Expected values are the output of `python3 analysis/cost_model.py`.
const PY = {
  low: { today: [146_270, 5_000, 29.25], robot: [27_833, 2_461, 11.31] },
  base: { today: [166_270, 3_750, 44.34], robot: [37_500, 2_051, 18.28] },
  high: { today: [196_270, 2_500, 78.51], robot: [64_500, 1_436, 44.93] },
};

describe('cost model matches analysis/cost_model.py', () => {
  for (const [k, exp] of Object.entries(PY)) {
    it(`${k} scenario`, () => {
      const s = SCENARIOS[k];
      expect(Math.round(s.today.annual)).toBe(exp.today[0]);
      expect(Math.round(s.today.laneMi)).toBe(exp.today[1]);
      expect(s.today.perMi.toFixed(2)).toBe(exp.today[2].toFixed(2));
      expect(Math.round(s.robot.annual)).toBe(exp.robot[0]);
      expect(Math.round(s.robot.laneMi)).toBe(exp.robot[1]);
      expect(s.robot.perMi.toFixed(2)).toBe(exp.robot[2].toFixed(2));
    });
  }
  it('uses the DSNY unit cost', () => {
    expect(Math.round(DSNY_UNIT_CAPEX)).toBe(148_889);
  });
});

describe('estimateCity', () => {
  it('sizes both fleets for the same coverage', () => {
    const e = estimateCity(100, { scenario: 'base', passesPerWeek: 1 });
    expect(e.milesPerYear).toBe(5_200);
    expect(e.robots).toBe(Math.ceil(5_200 / SCENARIOS.base.robot.laneMi));
    expect(e.sweepers).toBe(Math.ceil(5_200 / SCENARIOS.base.today.laneMi));
    expect(e.robotCost).toBeCloseTo(e.robots * SCENARIOS.base.robot.annual);
  });
  it('robots are cheaper per lane-mile in every scenario', () => {
    for (const k of Object.keys(SCENARIOS)) expect(estimateCity(50, { scenario: k }).perMiRobot).toBeLessThan(estimateCity(50, { scenario: k }).perMiStaffed);
  });
  it('more passes need more robots', () => {
    expect(estimateCity(200, { passesPerWeek: 3 }).robots).toBeGreaterThan(estimateCity(200, { passesPerWeek: 1 }).robots);
  });
  it('rejects unknown scenarios', () => {
    expect(() => estimateCity(10, { scenario: 'nope' })).toThrow();
  });
});
