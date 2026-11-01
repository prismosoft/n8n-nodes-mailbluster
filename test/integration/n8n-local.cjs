// Opt-in integration regression: real n8n CLI + real HTTPS, loopback only.
// See test/integration/README.md. Not part of the stubbed npm test suite.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const https = require('node:https');
const dns = require('node:dns');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const exec = promisify(execFile);

if (process.env.MB_DNS_CHILD === '1') {
  const lookup = dns.lookup.bind(dns);
  dns.lookup = (hostname, options, callback) => {
    if (hostname !== 'api.mailbluster.com') return lookup(hostname, options, callback);
    if (typeof options === 'function') { callback = options; options = {}; }
    process.nextTick(() => options?.all
      ? callback(null, [{ address: '127.0.0.1', family: 4 }])
      : callback(null, '127.0.0.1', 4));
  };
} else {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}

async function main() {
  assert.deepEqual(Object.keys(os.networkInterfaces()), ['lo'],
    'Run in a dedicated Linux network namespace with only loopback enabled');
  const runtime = path.resolve(process.env.N8N_TEST_DIR || '');
  assert.ok(process.env.N8N_TEST_DIR, 'N8N_TEST_DIR is required');
  const repo = path.resolve(__dirname, '../..');
  const state = fs.mkdtempSync(path.join(os.tmpdir(), 'mailbluster-integration-'));
  const cases = [
    { name: 'cap-seconds', method: 'GET', header: '300', expected: 1 },
    { name: 'cap-date', method: 'GET', date: 300000, expected: 1 },
    { name: 'seconds', method: 'GET', header: '2', expected: 2, minGap: 2000 },
    { name: 'date', method: 'GET', date: 3000, expected: 2 },
    { name: 'invalid', method: 'GET', header: 'invalid', expected: 2, minGap: 1000 },
    { name: 'write-503', method: 'POST', header: '0', expected: 1 },
    { name: 'write-429', method: 'POST', header: '0', status: 429, expected: 1 },
  ].map(c => ({ ...c, requests: [] }));
  const server = https.createServer({
    key: fs.readFileSync(path.join(runtime, 'server.key')),
    cert: fs.readFileSync(path.join(runtime, 'server.crt')),
  }, (req, res) => {
    req.resume();
    const c = cases.find(item => req.url === `/api/test/${item.name}`);
    if (!c) { res.writeHead(404); res.end(); return; }
    c.requests.push(Date.now());
    assert.equal(req.method, c.method);
    if (c.requests.length === 1) {
      const header = c.date ? new Date(Date.now() + c.date).toUTCString() : c.header;
      if (c.date) c.notBefore = Date.parse(header);
      res.writeHead(c.status || 503, { 'content-type': 'application/json', 'retry-after': header });
      res.end('{"message":"local fixture failure"}');
    } else {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end('{"fixtureSuccess":true}');
    }
  });
  const env = {
    ...process.env, MB_DNS_CHILD: '1',
    NODE_OPTIONS: `--require=${__filename}`,
    NODE_EXTRA_CA_CERTS: path.join(runtime, 'server.crt'),
    N8N_USER_FOLDER: state, N8N_CUSTOM_EXTENSIONS: path.join(repo, 'dist'),
    N8N_DIAGNOSTICS_ENABLED: 'false', N8N_VERSION_NOTIFICATIONS_ENABLED: 'false',
    N8N_TEMPLATES_ENABLED: 'false', N8N_PERSONALIZATION_ENABLED: 'false',
    N8N_COMMUNITY_PACKAGES_ENABLED: 'false', N8N_LICENSE_AUTO_RENEW_ENABLED: 'false',
    N8N_RUNNERS_ENABLED: 'false', N8N_LOG_LEVEL: 'info',
    HTTP_PROXY: '', HTTPS_PROXY: '', ALL_PROXY: '', NO_PROXY: '*',
    http_proxy: '', https_proxy: '', all_proxy: '', no_proxy: '*',
  };
  async function cli(args) {
    return (await exec(process.execPath, [path.join(runtime, 'node_modules/n8n/bin/n8n'), ...args],
      { cwd: state, env, timeout: 120000, maxBuffer: 10 * 1024 * 1024 })).stdout;
  }
  try {
    await new Promise(resolve => server.listen(443, '127.0.0.1', resolve));
    const nodes = [{ id: 'start', name: 'Start', type: 'n8n-nodes-base.manualTrigger',
      typeVersion: 1, position: [0, 0], parameters: {} }];
    const connections = {};
    let previous = 'Start';
    for (const c of cases) {
      nodes.push({ id: c.name, name: c.name, type: 'CUSTOM.mailBluster', typeVersion: 1,
        position: [200, 0], continueOnFail: true, retryOnFail: false,
        credentials: { mailBlusterApi: { id: 'localFixture', name: 'Local fixture' } },
        parameters: { resource: 'api', operation: 'request', apiMethod: c.method,
          apiEndpoint: `/test/${c.name}`, apiBody: '{}', apiQuery: '{}' } });
      connections[previous] = { main: [[{ node: c.name, type: 'main', index: 0 }]] };
      previous = c.name;
    }
    fs.writeFileSync(path.join(state, 'credentials.json'), JSON.stringify([{
      id: 'localFixture', name: 'Local fixture', type: 'mailBlusterApi',
      data: { apiKey: 'synthetic-local-test-value' },
    }]), { mode: 0o600 });
    fs.writeFileSync(path.join(state, 'workflow.json'), JSON.stringify([{
      id: 'localRetryRegression', name: 'Local regression', active: false,
      nodes, connections, settings: { executionOrder: 'v1' },
    }]));
    await cli(['import:credentials', `--input=${state}/credentials.json`]);
    await cli(['import:workflow', `--input=${state}/workflow.json`]);
    const output = await cli(['execute', '--id=localRetryRegression', '--rawOutput']);
    const execution = JSON.parse(output.slice(output.indexOf('{\n')));
    assert.equal(execution.finished, true);
    for (const c of cases) {
      assert.equal(c.requests.length, c.expected, `${c.name}: wire count`);
      const value = execution.data.resultData.runData[c.name][0].data.main[0][0].json;
      if (c.expected === 1) assert.ok(value.error, `${c.name}: expected failure`);
      else {
        assert.deepEqual(value, { fixtureSuccess: true });
        if (c.minGap) assert.ok(c.requests[1] - c.requests[0] >= c.minGap);
        if (c.notBefore) assert.ok(c.requests[1] >= c.notBefore);
      }
      console.log(`${c.name}: PASS (${c.requests.length} requests, offsets ${c.requests.map(t => t - c.requests[0]).join(',')}ms)`);
    }
  } finally {
    server.closeAllConnections();
    server.close();
    fs.rmSync(state, { recursive: true, force: true });
  }
}
