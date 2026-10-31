const test = require('node:test');
const assert = require('node:assert/strict');
const { harness } = require('./helpers/offline.cjs');

for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
  for (const statusCode of [429, 500, 502, 503, 504]) {
    test(`${method} ${statusCode} is sent once without retry`, async () => {
      const h = harness({}, async () => { throw { statusCode }; });
      await assert.rejects(h.send(method));
      assert.equal(h.calls.length, 1);
      assert.deepEqual(h.sleeps, []);
      assert.equal(h.calls[0].options.timeout, 10_000);
    });
  }
}

test('every request explicitly delegates a 10-second timeout to n8n', async () => {
  const h = harness();
  await h.send('GET');
  assert.equal(h.calls[0].options.timeout, 10_000);
  assert.equal(h.calls[0].credentialType, 'mailBlusterApi');
});

test('GET transient failures make at most four attempts', async () => {
  const h = harness({}, async () => { throw { statusCode: 503 }; });
  await assert.rejects(h.send('GET'));
  assert.equal(h.calls.length, 4);
  assert.deepEqual(h.sleeps, [1000, 2000, 4000]);
});

for (const [name, error] of [
  ['401', { statusCode: 401 }], ['network', new Error('network unavailable')],
  ['timeout', Object.assign(new Error('timeout'), { code: 'ETIMEDOUT' })],
  ['JSON parse', new SyntaxError('invalid JSON')],
]) {
  test(`GET ${name} is not retried`, async () => {
    const h = harness({}, async () => { throw error; });
    await assert.rejects(h.send('GET'));
    assert.equal(h.calls.length, 1);
    assert.deepEqual(h.sleeps, []);
  });
}

for (const [header, expectedDelay] of [
  ['120', 120_000], ['Fri, 30 Oct 2026 12:00:30 GMT', 30_000],
  ['Fri, 30 Oct 2026 11:59:00 GMT', 0], ['invalid', 1000], ['-1', 1000],
]) {
  test(`GET handles Retry-After ${header}`, async () => {
    let count = 0;
    const h = harness({}, async () => {
      if (++count === 1) throw { response: { status: 429, headers: { 'retry-after': header } } };
      return { success: true };
    });
    await h.send('GET');
    assert.equal(h.calls.length, 2);
    assert.deepEqual(h.sleeps, [expectedDelay]);
  });
}

for (const header of ['121', '86400', '9'.repeat(400)]) {
  test(`GET will not shorten an excessive retry delay (${header.length} characters)`, async () => {
    const h = harness({}, async () => {
      throw { statusCode: 429, response: { headers: { 'retry-after': header } } };
    });
    await assert.rejects(h.send('GET'));
    assert.equal(h.calls.length, 1);
    assert.deepEqual(h.sleeps, []);
  });
}

test('limiter waits on the eleventh request in one execution', async () => {
  const h = harness();
  const limiter = new h.transport.MailBlusterRateLimiter();
  for (let i = 0; i < 11; i++) await limiter.wait();
  assert.deepEqual(h.sleeps, [1020]);
});

test('separate limiters do not provide an account-wide guarantee', async () => {
  const h = harness();
  const first = new h.transport.MailBlusterRateLimiter();
  const second = new h.transport.MailBlusterRateLimiter();
  for (let i = 0; i < 10; i++) { await first.wait(); await second.wait(); }
  assert.deepEqual(h.sleeps, []);
});
