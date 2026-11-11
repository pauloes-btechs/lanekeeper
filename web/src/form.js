import { DEMO_ENDPOINT, SUPABASE_PUBLISHABLE_KEY } from './config.js';

const EMAIL = /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i;

// Same rules as supabase/functions/request-demo/handler.ts; the server checks again.
export function validateForm(v) {
  const errors = {};
  if ((v.name ?? '').trim().length < 2) errors.name = 'Enter your name.';
  if (!EMAIL.test((v.email ?? '').trim())) errors.email = 'Enter a valid work email.';
  if ((v.city ?? '').trim().length < 2) errors.city = 'Choose or enter a city.';
  if ((v.organization ?? '').trim().length < 2) errors.organization = 'Enter your agency or organization.';
  const m = (v.laneMiles ?? '').toString().trim();
  if (m && (!Number.isFinite(Number(m)) || Number(m) < 0 || Number(m) > 100000)) errors.laneMiles = 'Enter lane miles as a number, or leave it blank.';
  return errors;
}

const FIELD_IDS = { name: 'f-name', email: 'f-email', city: 'f-city', organization: 'f-org', laneMiles: 'f-miles', role: 'f-role', message: 'f-msg' };

function showErrors(form, errors) {
  form.querySelectorAll('.err').forEach((e) => e.remove());
  form.querySelectorAll('[aria-invalid]').forEach((e) => e.removeAttribute('aria-invalid'));
  let first;
  for (const [k, msg] of Object.entries(errors)) {
    const input = form.querySelector(`#${FIELD_IDS[k]}`);
    if (!input) continue;
    input.setAttribute('aria-invalid', 'true');
    const p = document.createElement('span');
    p.className = 'err';
    p.id = `${input.id}-err`;
    p.textContent = msg;
    input.setAttribute('aria-describedby', p.id);
    input.after(p);
    first ??= input;
  }
  first?.focus();
}

export function initDemoForm(form) {
  const status = form.querySelector('#form-status');
  const button = form.querySelector('button[type="submit"]');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const values = Object.fromEntries(new FormData(form).entries());
    const errors = validateForm(values);
    showErrors(form, errors);
    status.className = 'form-status';
    if (Object.keys(errors).length) {
      status.textContent = 'Check the highlighted fields.';
      status.classList.add('bad');
      return;
    }
    button.disabled = true;
    status.textContent = 'Sending…';
    try {
      const res = await fetch(DEMO_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: SUPABASE_PUBLISHABLE_KEY },
        body: JSON.stringify({ ...values, page: location.pathname }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok) {
        form.reset();
        status.textContent = 'Thanks. Your request is in, and we’ll reply to your work email within two business days.';
        status.classList.add('ok');
      } else if (res.status === 422 && body.fields) {
        showErrors(form, body.fields);
        status.textContent = body.error;
        status.classList.add('bad');
      } else {
        status.textContent = body.error || 'Something went wrong. Please try again.';
        status.classList.add('bad');
      }
    } catch {
      status.textContent = 'We couldn’t reach the server. Check your connection and try again.';
      status.classList.add('bad');
    } finally {
      button.disabled = false;
    }
  });
}
