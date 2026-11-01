const test = require('node:test');
const assert = require('node:assert/strict');
const { harness } = require('./helpers/offline.cjs');

const lead = { email: 'test@example.com', subscribed: false, additionalFields: {}, tags: {} };

test('all exposed subscription defaults are false', () => {
  const h = harness();
  const descriptions = [
    ...h.load('nodes/MailBluster/descriptions/lead.js').leadDescription,
    ...h.load('nodes/MailBluster/descriptions/order.js').orderDescription,
  ];
  let count = 0;
  function visit(items) {
    for (const item of items) {
      if (item.name === 'subscribed') { assert.equal(item.default, false); count++; }
      if (Array.isArray(item.options)) visit(item.options);
    }
  }
  visit(descriptions);
  assert.equal(count, 3);
});

for (const subscribed of [undefined, null, 'true', 1]) {
  test(`create rejects non-boolean subscribed=${subscribed}`, async () => {
    const h = harness({ ...lead, subscribed });
    await assert.rejects(h.run('lead', 'create'), /explicit boolean/);
    assert.equal(h.calls.length, 0);
  });
}

for (const consentConfirmed of [undefined, false, 'true', 1]) {
  test(`subscribing requires literal consent true (${consentConfirmed})`, async () => {
    const h = harness({ ...lead, subscribed: true, consentConfirmed });
    await assert.rejects(h.run('lead', 'create'), /Confirm permission/);
    assert.equal(h.calls.length, 0);
  });
}

test('false is preserved; additional fields cannot override the subscription decision', async () => {
  const h = harness({ ...lead, additionalFields: { subscribed: true } });
  await h.run('lead', 'create');
  assert.equal(h.calls[0].options.body.subscribed, false);
});

test('confirmed subscription passes without sending the local consent flag', async () => {
  const h = harness({ ...lead, subscribed: true, consentConfirmed: true });
  const result = await h.run('lead', 'create');
  assert.equal(h.calls[0].options.body.subscribed, true);
  assert.equal(Object.hasOwn(h.calls[0].options.body, 'consentConfirmed'), false);
  assert.equal(result[0].json.lead.id, 1);
});

test('explicit double opt-in and false subscription are preserved', async () => {
  const h = harness({ ...lead, additionalFields: { doubleOptIn: true } });
  await h.run('lead', 'create');
  assert.equal(h.calls[0].options.body.doubleOptIn, true);
  assert.equal(h.calls[0].options.body.subscribed, false);
});

test('update subscription requires consent, but other updates do not', async () => {
  const h = harness({ leadIdentifier: lead.email, updateFields: { subscribed: true } });
  await assert.rejects(h.run('lead', 'update'), /Confirm permission/);
  assert.equal(h.calls.length, 0);
  const other = harness({ leadIdentifier: lead.email, updateFields: { firstName: 'Test' } });
  await other.run('lead', 'update');
  assert.equal(Object.hasOwn(other.calls[0].options.body, 'subscribed'), false);
});

test('update strips the consent field and preserves explicit false', async () => {
  for (const subscribed of [true, false]) {
    const h = harness({
      leadIdentifier: lead.email, updateFields: { subscribed, consentConfirmed: true },
    });
    await h.run('lead', 'update');
    assert.deepEqual(h.calls[0].options.body, { subscribed });
  }
});

test('consent-only update does not result in an empty write', async () => {
  const h = harness({ leadIdentifier: lead.email, updateFields: { consentConfirmed: true } });
  await assert.rejects(h.run('lead', 'update'), /at least one field/);
  assert.equal(h.calls.length, 0);
});

const order = {
  orderId: 'offline-order', customerEmail: lead.email, currency: 'USD', totalPrice: 1,
  items: { item: [{ productId: 'offline-product', quantity: 1, unitPrice: 1 }] },
};

test('order customer defaults to unsubscribed', async () => {
  const h = harness(order);
  await h.run('order', 'create');
  assert.equal(h.calls[0].options.body.customer.subscribed, false);
});

test('order subscription requires confirmation and strips its local flag', async () => {
  const blocked = harness({ ...order, customerOptions: { subscribed: true } });
  await assert.rejects(blocked.run('order', 'create'), /Confirm permission/);
  assert.equal(blocked.calls.length, 0);
  const h = harness({ ...order, customerOptions: { subscribed: true, consentConfirmed: true } });
  await h.run('order', 'create');
  assert.equal(h.calls[0].options.body.customer.subscribed, true);
  assert.equal(Object.hasOwn(h.calls[0].options.body.customer, 'consentConfirmed'), false);
});

test('order customer update also checks and removes consent confirmation', async () => {
  const blocked = harness({
    ...order, orderUpdateFields: { customer: '{"subscribed":true}' },
  });
  await assert.rejects(blocked.run('order', 'update'), /Confirm permission/);
  assert.equal(blocked.calls.length, 0);
  const h = harness({
    ...order, orderUpdateFields: { customer: '{"subscribed":true,"consentConfirmed":true}' },
  });
  await h.run('order', 'update');
  assert.deepEqual(h.calls[0].options.body.customer, { subscribed: true });
});
