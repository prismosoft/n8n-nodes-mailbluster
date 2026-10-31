const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const workflow = require('n8n-workflow');

// Load built production modules with only the clock/sleep replaced.
// HTTP is never available: the context below always supplies a local stub.
function harness(parameters = {}, request = async () => ({ message: 'Lead added', lead: { id: 1 } })) {
  const root = path.resolve(__dirname, '../../dist');
  const modules = new Map();
  const calls = [];
  const sleeps = [];
  let now = Date.UTC(2026, 9, 30, 12);
  class Clock extends Date {
    static now() { return now; }
  }
  const fakeWorkflow = {
    ...workflow,
    sleep: async (ms) => { sleeps.push(ms); now += ms; },
  };
  function load(relative) {
    const filename = path.resolve(root, relative);
    if (!filename.startsWith(root + path.sep)) throw new Error('Unexpected module path');
    if (modules.has(filename)) return modules.get(filename).exports;
    const module = { exports: {} };
    modules.set(filename, module);
    const localRequire = (id) => {
      if (id === 'n8n-workflow') return fakeWorkflow;
      if (id === 'node:crypto') return require(id);
      if (id.startsWith('.')) {
        return load(path.relative(root, path.resolve(path.dirname(filename), id + '.js')));
      }
      throw new Error(`Unexpected dependency: ${id}`);
    };
    const wrapper = vm.runInThisContext(
      `(function(require, module, exports, Date) {${fs.readFileSync(filename, 'utf8')}\n})`,
      { filename },
    );
    wrapper(localRequire, module, module.exports, Clock);
    return module.exports;
  }
  const node = {
    id: 'offline', name: 'Offline', type: 'mailBluster', typeVersion: 1,
    position: [0, 0], parameters: {},
  };
  const context = {
    getNode: () => node,
    getNodeParameter: (name, _index, fallback) =>
      Object.hasOwn(parameters, name) ? parameters[name] : fallback,
    helpers: {
      httpRequestWithAuthentication: async (credentialType, options) => {
        calls.push({ credentialType, options });
        return request(options);
      },
    },
  };
  const transport = load('nodes/MailBluster/helpers/transport.js');
  const execution = load('nodes/MailBluster/helpers/execute.js');
  return {
    load, calls, sleeps, context, transport,
    run: (resource, operation) => execution.executeMailBlusterOperation.call(
      context, new transport.MailBlusterRateLimiter(), resource, operation, 0,
    ),
    send: (method) => transport.mailBlusterApiRequest.call(
      context, new transport.MailBlusterRateLimiter(), method, '/leads',
      method === 'GET' ? undefined : { email: 'test@example.com', subscribed: false },
    ),
  };
}

module.exports = { harness };
