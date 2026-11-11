import assert from 'node:assert/strict';
import test from 'node:test';
import { authentication } from './auth.js';

test('signup handles confirmation and sign-in without storing provider credentials in the cookie', async t => {
  const previous = { url: process.env.SUPABASE_URL, key: process.env.SUPABASE_ANON_KEY };
  process.env.SUPABASE_URL = 'https://auth.supabase.co';
  process.env.SUPABASE_ANON_KEY = 'public-test-key';
  t.after(() => {
    if (previous.url === undefined) delete process.env.SUPABASE_URL; else process.env.SUPABASE_URL = previous.url;
    if (previous.key === undefined) delete process.env.SUPABASE_ANON_KEY; else process.env.SUPABASE_ANON_KEY = previous.key;
  });
  let confirmed = false;
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(new URL(url).hostname, 'auth.supabase.co');
    assert.equal(options.headers.apikey, 'public-test-key');
    assert.equal(JSON.parse(options.body).password, 'a-new-password');
    return Response.json(confirmed ? { access_token: 'provider-token', user: { id: 'user-456', email: 'person@example.test' } } : { user: { id: 'user-456' } });
  });
  const auth = authentication('a-long-test-session-secret', true);
  const res = { headers: {}, setHeader(name, value) { this.headers[name] = value; } };
  const input = { email: 'person@example.test', password: 'a-new-password' };
  assert.equal((await auth.action('/api/auth/signup', input, res)).signedIn, false);
  assert.equal(res.headers['Set-Cookie'], undefined);
  confirmed = true;
  assert.equal((await auth.action('/api/auth/login', input, res)).signedIn, true);
  const cookie = res.headers['Set-Cookie'];
  assert.match(cookie, /HttpOnly; SameSite=Lax/);
  assert.match(cookie, /Secure/);
  assert.ok(!cookie.includes('provider-token'));
  assert.ok(!cookie.includes(input.password));
  assert.equal(auth.user({ headers: { cookie } }).id, 'user-456');
  await auth.action('/api/auth/logout', {}, res);
  assert.match(res.headers['Set-Cookie'], /Max-Age=0/);
});
