const el = id => document.getElementById(id);
const format = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const money = cents => format.format(cents / 100);
const sampleBrief = 'Signed scope: Design one landing page for $300 USD.';
const sampleChat = [
  'Designer: The mobile redesign is outside the signed scope. I can do it for $75 USD.',
  'Client: Approved, please add the mobile redesign for $75 USD.',
  'Client: What would rush delivery cost?',
  'Designer: Rush delivery would add $80 USD.',
  'Client: Let me check and get back to you about rush delivery.',
].join('\n');
const cancellation = 'Client: Cancel the mobile redesign. I only want the original landing page.';
const statusLabels = { approved: 'Approved', pending: 'Pending', cancelled: 'Cancelled', needs_review: 'Needs review' };
let operation;
let submitted;
let busy = false;
let sourceVersion = 0;
let previousReview;
let reviewItems = [];
let receiptOperation;
let serverInstance;

async function request(url, data) {
  const response = await fetch(url, data === undefined ? {} : {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(data),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Request failed. Try again.');
  return result;
}

function node(tag, value, className) {
  const item = document.createElement(tag);
  if (className) item.className = className;
  item.textContent = value;
  return item;
}

function selectedItems() {
  return [...el('items').querySelectorAll('input:checked')].map(input => ({
    name: input.dataset.name, cents: Number(input.dataset.cents),
  }));
}

const totalCents = items => items.reduce((total, item) => total + (item.cents ?? 0), 0);

function updateTotal() {
  const items = selectedItems();
  const cents = totalCents(items);
  const excluded = reviewItems.length - items.length;
  const unpriced = reviewItems.filter(item => item.cents === null).length;
  el('total').textContent = money(cents);
  el('total-top').textContent = money(cents);
  el('included-count').textContent = `${items.length} of ${reviewItems.length} items included`;
  el('excluded-total').textContent = money(totalCents(reviewItems) - cents);
  el('excluded-count').textContent = `${excluded} excluded${unpriced ? ` · ${unpriced} without a confirmed price` : ''}`;
  el('confirmed').checked = false;
  el('issue').disabled = !items.length;
}

function sourceLabel(source) {
  return `${source.label} · line ${source.line}`;
}

function renderReview(items, inputs) {
  reviewItems = items;
  el('items').replaceChildren();
  for (const item of items) {
    const card = node('article', '', 'charge');
    const heading = node('div', '', 'charge-title');
    heading.append(node('strong', item.name), node('span', item.cents === null ? 'Price unclear' : money(item.cents)));
    card.append(heading, node('span', statusLabels[item.status], `badge ${item.status}`), node('p', item.reason, 'hint'));
    if (item.decision) {
      const decision = node('blockquote', '', 'decisive');
      decision.append(node('span', `Decisive evidence · ${sourceLabel(item.decision)}`), node('p', item.decision.text));
      card.append(decision);
    }
    const timeline = node('details', '', 'timeline');
    timeline.open = item.status === 'cancelled' || item.status === 'needs_review';
    timeline.append(node('summary', `Decision timeline · ${item.evidence.length} source ${item.evidence.length === 1 ? 'line' : 'lines'}`));
    const steps = node('ol', '');
    for (const source of item.evidence) {
      const step = node('li', '');
      step.append(node('span', sourceLabel(source)), node('p', source.text));
      steps.append(step);
    }
    timeline.append(steps);
    card.append(timeline);
    if (item.status === 'approved') {
      const label = node('label', '', 'confirm item-toggle');
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.checked = true;
      input.dataset.name = item.name;
      input.dataset.cents = item.cents;
      input.addEventListener('change', updateTotal);
      label.append(input, ' Include in invoice');
      card.append(label);
    }
    el('items').append(card);
  }
  if (!items.length) el('items').append(node('p', 'No billable evidence was identified. Review your inputs and try again.', 'hint'));
  el('empty').hidden = true;
  el('invoice').hidden = false;
  el('review-summary').hidden = false;
  el('invoice-message').textContent = '';
  el('issue').firstChild.textContent = 'Issue PayPal invoice ';
  el('email').disabled = false;
  el('confirmed').disabled = false;
  submitted = null;
  operation = crypto.randomUUID();
  updateTotal();

  const approved = totalCents(items.filter(item => item.status === 'approved'));
  const appended = previousReview?.brief === inputs.brief && inputs.chat.startsWith(`${previousReview.chat}\n`);
  const change = el('review-change');
  change.hidden = !appended;
  if (appended) {
    const delta = approved - previousReview.approved;
    change.textContent = `After the latest messages: ${money(previousReview.approved)} → ${money(approved)} (${delta > 0 ? '+' : ''}${money(delta)}).`;
  }
  previousReview = { ...inputs, approved };
  el('scenario').hidden = inputs.brief !== sampleBrief || inputs.chat !== sampleChat;
}

function invalidateReview() {
  sourceVersion++;
  el('analysis-message').textContent = '';
  el('scenario').hidden = true;
  if (submitted) return;
  el('empty').hidden = false;
  el('invoice').hidden = true;
  el('review-summary').hidden = true;
  el('review-change').hidden = true;
}

el('brief').addEventListener('input', invalidateReview);
el('chat').addEventListener('input', invalidateReview);
el('sample').addEventListener('click', () => {
  el('brief').value = sampleBrief;
  el('chat').value = sampleChat;
  invalidateReview();
  el('brief').focus();
});

el('try-cancellation').addEventListener('click', () => {
  if (busy) return;
  el('chat').value = `${sampleChat}\n${cancellation}`;
  invalidateReview();
  el('analyze').requestSubmit();
});

el('analyze').addEventListener('submit', async event => {
  event.preventDefault();
  if (busy) return;
  busy = true;
  const version = sourceVersion;
  const inputs = { brief: el('brief').value, chat: el('chat').value };
  const button = event.currentTarget.querySelector('button');
  button.disabled = true;
  el('analysis-message').textContent = 'Gemini is comparing the brief and client messages…';
  try {
    const review = await request('/api/analyze', inputs);
    if (version !== sourceVersion) return;
    renderReview(review.items, inputs);
    el('analysis-message').textContent = `${review.items.length} items reviewed · ${review.model}`;
  } catch (error) {
    if (version === sourceVersion) el('analysis-message').textContent = error.message;
  } finally {
    busy = false;
    button.disabled = false;
  }
});

function showReceipt(data) {
  if (data.reference) {
    receiptOperation = data.reference;
    try { localStorage.setItem('scopeproof.invoice', receiptOperation); } catch { /* Browser storage can be unavailable. */ }
  }
  el('receipt').hidden = false;
  el('status').textContent = data.status.replaceAll('_', ' ');
  el('receipt-id').textContent = `${data.id}${data.amount ? ` · ${money(Number(data.amount) * 100)}` : ''}`;
  el('buyer').hidden = !data.buyerUrl;
  if (data.buyerUrl) el('buyer').href = data.buyerUrl;
}

async function refreshReceipt() {
  const current = receiptOperation;
  const receipt = await request(`/api/invoice/${current}`);
  if (current !== receiptOperation) return;
  showReceipt(receipt);
  el('receipt-message').textContent = 'Status verified with PayPal Sandbox.';
}

el('email').addEventListener('input', () => { el('confirmed').checked = false; });

el('invoice').addEventListener('submit', async event => {
  event.preventDefault();
  if (busy) return;
  busy = true;
  el('issue').disabled = true;
  submitted ||= { operation, instance: serverInstance, email: el('email').value.trim(), items: selectedItems(), confirmed: el('confirmed').checked };
  receiptOperation = submitted.operation;
  try { localStorage.setItem('scopeproof.invoice', receiptOperation); } catch { /* Browser storage can be unavailable. */ }
  el('email').disabled = true;
  el('confirmed').disabled = true;
  el('items').querySelectorAll('input').forEach(input => { input.disabled = true; });
  el('invoice-message').textContent = 'Waiting for PayPal Sandbox…';
  try {
    showReceipt(await request('/api/invoice', submitted));
    el('receipt-message').textContent = 'Status verified with PayPal Sandbox.';
    el('invoice-message').textContent = 'Invoice verified with PayPal Sandbox.';
  } catch (error) {
    el('invoice-message').textContent = error.message;
    el('issue').firstChild.textContent = 'Retry same invoice ';
    el('issue').disabled = false;
  } finally {
    busy = false;
  }
});

el('refresh').addEventListener('click', async () => {
  if (busy) return;
  busy = true;
  el('refresh').disabled = true;
  try {
    await refreshReceipt();
  } catch (error) {
    el('receipt-message').textContent = error.message;
  } finally {
    el('refresh').disabled = false;
    busy = false;
  }
});

request('/api/config').then(({ buyer, instance }) => {
  serverInstance = instance;
  if (!el('email').value) el('email').value = buyer;
}).catch(() => {});

try {
  receiptOperation = localStorage.getItem('scopeproof.invoice');
  if (receiptOperation) refreshReceipt().catch(error => {
    el('receipt').hidden = false;
    el('status').textContent = 'Check previous invoice';
    el('receipt-message').textContent = `${error.message} Check the Sandbox Invoicing dashboard before issuing another invoice.`;
  });
} catch { /* The rest of the app also works without browser storage. */ }
