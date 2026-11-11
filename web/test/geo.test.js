import { describe, it, expect } from 'vitest';
import { haversineMi, lineMiles, simplify } from '../scripts/fetch-city-data.mjs';

describe('lane-mile geometry', () => {
  it('measures a known distance', () => {
    // Union Square to Columbus Circle, Manhattan: about 2.4 miles as the crow flies
    const d = haversineMi([-73.9903, 40.7359], [-73.9819, 40.7681]);
    expect(d).toBeGreaterThan(2.2);
    expect(d).toBeLessThan(2.4);
  });
  it('adds up a polyline', () => {
    const pts = [[-74, 40.7], [-74, 40.71], [-74, 40.72]];
    expect(lineMiles(pts)).toBeCloseTo(haversineMi(pts[0], pts[2]), 6);
  });
  it('simplify keeps ends and drops collinear points', () => {
    const pts = [[0, 0], [1, 1e-7], [2, 0], [3, 1]];
    const s = simplify(pts, 1e-5);
    expect(s[0]).toEqual([0, 0]);
    expect(s.at(-1)).toEqual([3, 1]);
    expect(s.length).toBe(3);
  });
});
