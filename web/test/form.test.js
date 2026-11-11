import { describe, it, expect } from 'vitest';
import { validateForm } from '../src/form.js';

const good = { name: 'Ada Lovelace', email: 'ada@sfmta.com', city: 'San Francisco', organization: 'SFMTA', laneMiles: '' };

describe('demo form validation', () => {
  it('accepts a complete request', () => expect(validateForm(good)).toEqual({}));
  it('flags missing required fields', () => {
    expect(Object.keys(validateForm({})).sort()).toEqual(['city', 'email', 'name', 'organization']);
  });
  it('rejects a bad email and non-numeric lane miles', () => {
    const e = validateForm({ ...good, email: 'ada@', laneMiles: 'lots' });
    expect(e.email).toBeTruthy();
    expect(e.laneMiles).toBeTruthy();
  });
  it('accepts decimal lane miles', () => expect(validateForm({ ...good, laneMiles: '41.5' })).toEqual({}));
});
