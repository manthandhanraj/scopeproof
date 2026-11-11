import assert from 'node:assert/strict';
import { once } from 'node:events';
import { cp, mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const live = process.argv.includes('--live');
const source = new URL('../', import.meta.url);
const checkout = await mkdtemp(join(tmpdir(), 'scopeproof-verify-'));
const publicFiles = ['package.json', 'auth.js', 'auth.test.js', 'server.js', 'server.test.js', 'public', 'scripts', 'README.md', 'DEPLOYMENT.md', 'SUBMISSION.md', 'render.yaml', 'LICENSE', '.env.example', '.gitignore'];
for (const name of publicFiles) await cp(new URL(name, source), join(checkout, name), { recursive: true });
console.log('Fresh source copy prepared without credentials or existing invoice data.');

const tests = spawnSync(process.execPath, ['--test'], { cwd: checkout, encoding: 'utf8' });
assert.equal(tests.status, 0, tests.stdout + tests.stderr);
console.log('PASS: local tests in fresh source copy.');

const { app } = await import(pathToFileURL(join(checkout, 'server.js')).href);
const server = app(':memory:').listen(0, '127.0.0.1');
await once(server, 'listening');
const base = `http://127.0.0.1:${server.address().port}`;
try {
  const login = await (await fetch(base)).text();
  const loginScript = await (await fetch(`${base}/login.js`)).text();
  assert.ok(login.includes('Try demo'));
  for (const id of [...loginScript.matchAll(/el\('([^']+)'\)/g)].map(match => match[1])) {
    assert.ok(login.includes(`id="${id}"`), `Missing login element: ${id}`);
  }
  const session = await fetch(`${base}/api/auth/demo`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}',
  });
  assert.equal(session.status, 200);
  const cookie = session.headers.get('set-cookie').split(';')[0];
  const request = (path, options = {}) => fetch(base + path, { ...options, headers: { ...options.headers, cookie } });
  for (const path of ['/', '/app.js', '/style.css', '/logo.svg', '/favicon.svg']) {
    const response = await request(path);
    assert.equal(response.status, 200);
    assert.ok((await response.text()).length > 100);
  }
  for (const path of ['/.env', '/scopeproof.sqlite', '/server.js']) {
    assert.equal((await request(path)).status, 404);
  }
  const html = await (await request('/')).text();
  const script = await (await request('/app.js')).text();
  for (const id of [...script.matchAll(/el\('([^']+)'\)/g)].map(match => match[1])) {
    assert.ok(html.includes(`id="${id}"`), `Missing UI element: ${id}`);
  }
  console.log('PASS: actual HTTP entry points, UI element references, and private file exclusion.');

  if (live) {
    for (const key of ['GEMINI_API_KEY', 'PAYPAL_CLIENT_ID', 'PAYPAL_CLIENT_SECRET', 'PAYPAL_SANDBOX_BUYER']) {
      assert.ok(process.env[key]?.trim(), `Missing local setting: ${key}`);
    }
    const brief = 'Signed scope: Design one landing page for $300 USD.';
    const sample = [
      'Designer: The mobile redesign is outside the signed scope. I can do it for $75 USD.',
      'Client: Approved, please add the mobile redesign for $75 USD.',
      'Client: What would rush delivery cost?',
      'Designer: Rush delivery would add $80 USD.',
      'Client: Let me check and get back to you about rush delivery.',
    ].join('\n');
    const cases = [
      ['approved and pending', sample, 37500, 'pending', 8000],
      ['cancelled approval', `${sample}\nClient: Cancel the mobile redesign. I only want the original landing page.`, 30000, 'cancelled', 7500],
      ['conflicting prices', 'Designer: The redesign quote lists $75 USD, but my follow-up lists $95 USD. Which price do you approve?\nClient: Go ahead with the redesign. I will confirm which of those prices applies tomorrow.', 30000, 'needs_review', null],
    ];
    for (const [name, chat, total, status, cents] of cases) {
      const response = await request('/api/analyze', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ brief, chat }),
      });
      const review = await response.json();
      assert.equal(response.status, 200, review.error);
      assert.equal(review.items.filter(item => item.status === 'approved').reduce((sum, item) => sum + item.cents, 0), total);
      assert.ok(review.items.some(item => item.status === status && item.cents === cents));
      console.log(`PASS: live Gemini ${name}, billable $${(total / 100).toFixed(2)}.`);
    }
    const credentials = Buffer.from(`${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`).toString('base64');
    const tokenResponse = await fetch('https://api-m.sandbox.paypal.com/v1/oauth2/token', {
      method: 'POST', headers: { authorization: `Basic ${credentials}`, 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'client_credentials', scope: 'https://uri.paypal.com/services/invoicing' }),
    });
    assert.equal(tokenResponse.status, 200, 'PayPal Sandbox authorization failed.');
    const token = await tokenResponse.json();
    const invoices = await fetch('https://api-m.sandbox.paypal.com/v2/invoicing/invoices?page_size=1', {
      headers: { authorization: `Bearer ${token.access_token}` },
    });
    assert.equal(invoices.status, 200, 'PayPal Sandbox invoice access failed.');
    console.log('PASS: live PayPal Sandbox authorization and invoice read access.');
  }
  const template = await readFile(join(checkout, '.env.example'), 'utf8');
  assert.ok(template.includes('GEMINI_API_KEY=\n') || template.includes('GEMINI_API_KEY=\r\n'));
  console.log(`Verification complete. Fresh copy: ${checkout}`);
} finally {
  await new Promise(resolve => server.close(resolve));
}
