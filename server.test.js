import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Readable } from 'node:stream';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test, { beforeEach } from 'node:test';
import { app, groundItems } from './server.js';

beforeEach(t => {
  for (const key of ['RENDER', 'NODE_ENV', 'DEMO_USERNAME', 'DEMO_PASSWORD', 'SESSION_SECRET', 'SUPABASE_URL', 'SUPABASE_ANON_KEY']) {
    const original = process.env[key];
    delete process.env[key];
    t.after(() => { if (original === undefined) delete process.env[key]; else process.env[key] = original; });
  }
});

test('hosted demo requires credentials and protects its UI and APIs', async t => {
  process.env.NODE_ENV = 'production';
  assert.throws(() => app(':memory:'), /SESSION_SECRET/);
  process.env.DEMO_USERNAME = 'judge';
  process.env.DEMO_PASSWORD = 'a-long-test-password';
  const server = app(':memory:');
  t.after(() => server.emit('close'));
  const get = (url, cookie, payload) => new Promise(resolve => {
    const res = {
      headers: {}, setHeader(name, value) { this.headers[name] = value; },
      writeHead(status) { this.status = status; return this; },
      end(content) { resolve({ status: this.status, headers: this.headers, content: String(content) }); },
    };
    const req = Readable.from(payload === undefined ? [] : [Buffer.from(JSON.stringify(payload))]);
    Object.assign(req, { method: payload === undefined ? 'GET' : 'POST', url, headers: { cookie, 'content-type': 'application/json' } });
    server.emit('request', req, res);
  });
  assert.equal((await get('/health')).status, 200);
  assert.match((await get('/')).content, /Try demo/);
  for (const url of ['/api/config', '/api/invoice/unknown']) {
    const response = await get(url);
    assert.equal(response.status, 401);
    assert.equal(response.headers['WWW-Authenticate'], undefined);
  }
  const session = await get('/api/auth/demo', undefined, {});
  const cookie = session.headers['Set-Cookie'].split(';')[0];
  assert.match(session.headers['Set-Cookie'], /HttpOnly; SameSite=Lax/);
  assert.match((await get('/', cookie)).content, /Invoice review/);
  assert.equal((await get('/.env', cookie)).status, 404);
  assert.equal((await get('/api/config', cookie + 'tampered')).status, 401);
});

test('grounding sorts original evidence and holds unsupported or conflicting charges', () => {
  const sources = [{ label: 'Chat', line: 3, text: 'Approved at $75.' }, { label: 'Chat', line: 5, text: 'Cancel it.' }];
  const item = { name: 'Redesign', status: 'approved', cents: 7500, lines: [1], decisionLine: 1, reason: 'Approval given.' };
  const [cancelled] = groundItems([{ ...item, status: 'cancelled', lines: [2, 1, 2], decisionLine: 2 }], sources);
  assert.deepEqual(cancelled.evidence, sources);
  assert.equal(cancelled.decision, sources[1]);
  for (const variant of [{ cents: null }, { cents: 75 }, { cents: 9900 }, { decisionLine: 2 }, { status: 'needs_review' }]) {
    const [held] = groundItems([{ ...item, ...variant }], sources);
    assert.equal(held.status, 'needs_review');
    assert.equal(held.cents, null);
  }
  assert.throws(() => groundItems([{ ...item, lines: [3] }], sources), /valid source references/);
});

test('HTTP handlers for UI, AI review, confirmation, invoice recovery, and status refresh', async t => {
  process.env.DEMO_USERNAME = 'judge';
  process.env.DEMO_PASSWORD = 'a-long-test-password';
  process.env.RENDER = 'true';
  const config = { GEMINI_API_KEY: 'test', PAYPAL_CLIENT_ID: 'test', PAYPAL_CLIENT_SECRET: 'test' };
  for (const [key, value] of Object.entries(config)) {
    const original = process.env[key];
    process.env[key] = value;
    t.after(() => { if (original === undefined) delete process.env[key]; else process.env[key] = original; });
  }
  let drafts = 0;
  let sends = 0;
  let analyses = 0;
  let state = 'DRAFT';
  const id = 'INV2-AAAA-BBBB-CCCC-DDDD';
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    const { hostname, pathname } = new URL(url);
    if (hostname === 'accounts.supabase.co') {
      assert.equal(pathname, '/auth/v1/token');
      return Response.json({ access_token: 'verified-provider-session', user: { id: 'account-123', email: 'judge@example.test' } });
    }
    if (hostname === 'generativelanguage.googleapis.com') {
      if (++analyses === 1) return Response.json({ error: { status: 'UNAVAILABLE' } }, { status: 503 });
      const { contents } = JSON.parse(options.body);
      assert.equal(JSON.parse(contents[0].parts[0].text).length, 3);
      return Response.json({ candidates: [{ content: { parts: [{ text: JSON.stringify({ items: [
        { name: 'Landing page', cents: 30000, status: 'approved', lines: [1], decisionLine: 1, reason: 'Signed.' },
        { name: 'Mobile redesign', cents: 7500, status: 'approved', lines: [2], decisionLine: 2, reason: 'Explicit approval.' },
        { name: 'Rush fee', cents: 8000, status: 'pending', lines: [3], decisionLine: 3, reason: 'Discussed only.' },
      ] }) }] } }] });
    }
    assert.equal(hostname, 'api-m.sandbox.paypal.com');
    if (pathname === '/v1/oauth2/token') {
      assert.equal(options.body.get('scope'), 'https://uri.paypal.com/services/invoicing');
      return Response.json({ access_token: 'test' });
    }
    if (pathname === '/v2/invoicing/invoices') {
      drafts++;
      const payload = JSON.parse(options.body);
      assert.deepEqual(payload.items.map(item => item.unit_amount.value), ['300.00', '75.00']);
      return Response.json({ href: `https://${hostname}${pathname}/${id}` }, { status: 201 });
    }
    if (pathname.endsWith('/send')) {
      sends++;
      if (sends === 1) return Response.json({ name: 'TEMPORARY_ERROR' }, { status: 503 });
      assert.deepEqual(JSON.parse(options.body), { send_to_recipient: false, send_to_invoicer: false });
      state = 'UNPAID';
      return new Response(null, { status: 204 });
    }
    assert.ok(pathname.endsWith(`/${id}`));
    return Response.json({ status: state, amount: { value: '375.00' }, detail: {
      metadata: { recipient_view_url: 'https://www.sandbox.paypal.com/invoice/p/test' },
    } });
  });

  const database = join(mkdtempSync(join(tmpdir(), 'scopeproof-test-')), 'invoices.sqlite');
  let server = app(database);
  t.after(() => server.emit('close'));
  let cookie;
  const request = (path, payload) => new Promise(resolve => {
    const req = Readable.from(payload === undefined ? [] : [Buffer.from(JSON.stringify(payload))]);
    req.method = payload === undefined ? 'GET' : 'POST';
    req.headers = { cookie };
    if (payload !== undefined) req.headers['content-type'] = 'application/json';
    req.url = path;
    const res = {
      headers: {},
      setHeader(name, value) { this.headers[name] = value; },
      writeHead(status) { this.status = status; return this; },
      end(content) { resolve(new Response(content, { status: this.status, headers: this.headers })); },
    };
    server.emit('request', req, res);
  });
  const session = await request('/api/auth/demo', {});
  cookie = session.headers.get('set-cookie').split(';')[0];
  assert.match(await (await request('/')).text(), /Invoice review/);
  assert.equal((await request('/app.js')).status, 200);
  assert.equal((await request('/style.css')).status, 200);
  const review = await (await request('/api/analyze', {
    brief: 'Signed landing page $300.', chat: 'Client: Approve mobile redesign $75.\nClient: Maybe rush for $80?',
  })).json();
  assert.equal(review.items[2].evidence[0].line, 2);
  assert.equal(analyses, 2);
  const operation = randomUUID();
  const { instance } = await (await request('/api/config')).json();
  const payload = { operation, instance, email: 'buyer@example.test', items: review.items.filter(item => item.status === 'approved') };
  assert.equal((await request('/api/invoice', payload)).status, 400);
  assert.equal(drafts, 0);
  payload.confirmed = true;
  assert.equal((await request('/api/invoice', payload)).status, 502);
  const receipt = await (await request('/api/invoice', payload)).json();
  assert.equal(receipt.status, 'UNPAID');
  assert.equal(receipt.amount, '375.00');
  assert.equal(drafts, 1);
  assert.equal(sends, 2);
  assert.equal((await request('/api/invoice', { ...payload, email: 'different@example.test' })).status, 409);
  state = 'PAID';
  assert.equal((await (await request(`/api/invoice/${operation}`)).json()).status, 'PAID');
  server.emit('close');
  server = app(database);
  assert.equal((await (await request(`/api/invoice/${operation}`)).json()).status, 'PAID');
  payload.instance = (await (await request('/api/config')).json()).instance;
  assert.equal((await (await request('/api/invoice', payload)).json()).status, 'PAID');
  assert.equal(drafts, 1);
  assert.equal(sends, 2);
  server.emit('close');
  server = app(':memory:');
  assert.equal((await (await request(`/api/invoice/${receipt.reference}`)).json()).status, 'PAID');
  assert.equal((await request(`/api/invoice/${receipt.reference.slice(0, -1)}x`)).status, 404);
  assert.equal((await request('/api/invoice', payload)).status, 409);
  assert.equal(drafts, 1);
  server.emit('close');
  process.env.SUPABASE_URL = 'https://accounts.supabase.co';
  process.env.SUPABASE_ANON_KEY = 'public-test-key';
  server = app(database);
  const accountLogin = await request('/api/auth/login', { email: 'judge@example.test', password: 'test-password' });
  assert.equal(accountLogin.status, 200);
  cookie = accountLogin.headers.get('set-cookie').split(';')[0];
  assert.equal((await request(`/api/invoice/${receipt.reference}`)).status, 404);
  assert.equal((await request(`/api/invoice/${operation}`)).status, 404);
});
