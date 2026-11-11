const el = id => document.getElementById(id);
let mode = 'login';
let busy = false;

function setMode(next) {
  if (busy) return;
  mode = next;
  for (const type of ['login', 'signup']) {
    el(`${type}-tab`).classList.toggle('selected', mode === type);
    el(`${type}-tab`).setAttribute('aria-pressed', String(mode === type));
  }
  el('account-submit').textContent = mode === 'signup' ? 'Create account' : 'Sign in';
  el('account-password').autocomplete = mode === 'signup' ? 'new-password' : 'current-password';
  el('auth-message').textContent = '';
}

async function authenticate(action, input = {}) {
  if (busy) return;
  busy = true;
  el('demo').disabled = true;
  el('account-submit').disabled = true;
  el('auth-message').textContent = action === 'demo' ? 'Opening your demo workspace…' : 'Please wait…';
  try {
    const response = await fetch(`/api/auth/${action}`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(input),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Please try again.');
    if (result.signedIn) location.assign('/');
    else el('auth-message').textContent = result.message;
  } catch (error) {
    el('auth-message').textContent = error.message;
  } finally {
    busy = false;
    el('demo').disabled = false;
    el('account-submit').disabled = false;
  }
}

el('login-tab').addEventListener('click', () => setMode('login'));
el('signup-tab').addEventListener('click', () => setMode('signup'));
el('demo').addEventListener('click', () => authenticate('demo'));
el('account-form').addEventListener('submit', event => {
  event.preventDefault();
  authenticate(mode, { email: el('account-email').value.trim(), password: el('account-password').value });
});
