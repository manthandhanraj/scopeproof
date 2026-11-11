import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { setImmediate } from 'node:timers/promises';
import { runInNewContext } from 'node:vm';
import test from 'node:test';

test('fresh visits stay empty until sample or previous receipt is requested', async () => {
  const script = await readFile(new URL('./public/app.js', import.meta.url), 'utf8');
  const storage = new Map([['scopeproof.invoice.demo', 'saved-reference']]);
  for (let visit = 0; visit < 2; visit++) {
    const elements = new Map();
    const calls = [];
    const element = id => {
      if (!elements.has(id)) elements.set(id, {
        value: '', hidden: id === 'receipt' || id === 'view-previous', handlers: {}, focus() {},
        addEventListener(type, callback) { this.handlers[type] = callback; },
      });
      return elements.get(id);
    };
    runInNewContext(script, {
      Intl, location: { assign() {} }, document: { getElementById: element },
      localStorage: { getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value) },
      fetch: async url => {
        calls.push(url);
        if (url === '/api/config') return Response.json({ buyer: 'buyer@personal.example.com', instance: 'test', user: { id: 'demo', demo: true } });
        if (url === '/api/auth/logout') return Response.json({ signedIn: false });
        return Response.json({ id: 'INV2-TEST', status: 'PAID', amount: '375.00', reference: 'saved-reference' });
      },
    });
    await setImmediate();
    assert.equal(element('brief').value, '');
    assert.equal(element('chat').value, '');
    assert.equal(element('receipt').hidden, true);
    assert.deepEqual(calls, ['/api/config']);
    await element('view-previous').handlers.click();
    assert.equal(element('receipt').hidden, false);
    assert.equal(element('status').textContent, 'PAID');
    element('sample').handlers.click();
    assert.match(element('brief').value, /Signed scope/);
    assert.match(element('chat').value, /mobile redesign/);
    assert.equal(element('receipt').hidden, true);
    await element('signout').handlers.click();
  }
});
