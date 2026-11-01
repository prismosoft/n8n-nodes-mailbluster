const test = require('node:test');
const assert = require('node:assert/strict');
const { harness } = require('./helpers/offline.cjs');
const { NodeApiError } = require('n8n-workflow');

test('real NodeApiError preserves Retry-After on a plain full-response error', async () => {
  let h;
  const upstream = {
    response: { status: 503, headers: { 'retry-after': '300' } },
  };
  h = harness({}, async () => {
    throw new NodeApiError(h.context.getNode(), upstream);
  });
  await assert.rejects(h.send('GET'));
  assert.equal(h.calls.length, 1);
  assert.deepEqual(h.sleeps, []);
});

test('HTTP failure response retains headers before n8n error wrapping', async () => {
  const h = harness({}, async () => ({
    statusCode: 503, headers: { 'retry-after': '300' }, body: { message: 'unavailable' },
  }));
  await assert.rejects(h.send('GET'));
  assert.equal(h.calls.length, 1);
  assert.equal(h.calls[0].options.returnFullResponse, true);
  assert.equal(h.calls[0].options.ignoreHttpStatusErrors, true);
  assert.deepEqual(h.sleeps, []);
});

test('full successful response unwraps the original API body', async () => {
  const body = { message: 'added', lead: { id: 1 } };
  const h = harness({}, async () => ({ statusCode: 201, headers: {}, body }));
  assert.deepEqual(await h.send('POST'), body);
});

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

for (const wrapper of ['cause', 'errorResponse']) {
  for (const [header, delays, attempts] of [
    ['300', [], 1],
    ['Fri, 30 Oct 2026 12:05:00 GMT', [], 1],
    ['2', [2000], 2],
    ['Fri, 30 Oct 2026 12:00:30 GMT', [30000], 2],
    ['0', [0], 2],
    ['invalid', [1000], 2],
  ]) {
    test(`GET reads Retry-After ${header} from n8n ${wrapper}`, async () => {
      let count = 0;
      const original = Object.assign(new Error('upstream'), {
        response: { status: 503, headers: { 'Retry-After': header } },
      });
      const wrapped = Object.assign(new Error('n8n wrapper'), { httpCode: '503' });
      Object.defineProperty(wrapped, wrapper, { value: original });
      const h = harness({}, async () => {
        if (++count === 1) throw wrapped;
        return { success: true };
      });
      if (attempts === 1) await assert.rejects(h.send('GET'));
      else await h.send('GET');
      assert.equal(h.calls.length, attempts);
      assert.deepEqual(h.sleeps, delays);
    });
  }
}

test('cyclic wrapped errors without Retry-After fall back safely', async () => {
  const error = { httpCode: '503' };
  error.cause = error;
  const h = harness({}, async () => { throw error; });
  await assert.rejects(h.send('GET'));
  assert.equal(h.calls.length, 4);
  assert.deepEqual(h.sleeps, [1000, 2000, 4000]);
});

test('write with wrapped Retry-After still never retries', async () => {
  const h = harness({}, async () => {
    throw { httpCode: '429', cause: { response: { headers: { 'retry-after': '0' } } } };
  });
  await assert.rejects(h.send('POST'));
  assert.equal(h.calls.length, 1);
  assert.deepEqual(h.sleeps, []);
});

test('separate limiters do not provide an account-wide guarantee', async () => {
  const h = harness();
  const first = new h.transport.MailBlusterRateLimiter();
  const second = new h.transport.MailBlusterRateLimiter();
  for (let i = 0; i < 10; i++) { await first.wait(); await second.wait(); }
  assert.deepEqual(h.sleeps, []);
});
