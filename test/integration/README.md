# Isolated n8n regression

This opt-in check runs the built component in the real n8n CLI against a local
HTTPS server. It verifies capped Retry-After seconds/dates, real waiting for
seconds/dates, invalid-header fallback, unchanged response bodies and single
write attempts. `npm test` remains the fast, fully stubbed suite.

Requires Linux, Node 24, `unshare`, `ip`, OpenSSL, and permission to create a
network namespace and bind port 443. Use a disposable sandbox, not production.
Install dependencies before isolation (this setup step requires the registry):

```sh
mkdir -p /tmp/mailbluster-runtime
cd /tmp/mailbluster-runtime
npm install n8n@2.45.7
openssl req -x509 -newkey rsa:2048 -nodes -keyout server.key \
  -out server.crt -days 1 -subj '/CN=api.mailbluster.com' \
  -addext 'subjectAltName=DNS:api.mailbluster.com'
```

From the repository root:

```sh
npm ci
npm run build
export N8N_TEST_DIR=/tmp/mailbluster-runtime
unshare -n sh -c 'ip link set lo up; node test/integration/n8n-local.cjs'
```

The namespace has loopback only. A child-only DNS override maps the API hostname
to that local HTTPS server; only the test certificate is added to child trust.
No production URL, credentials, or source code is changed. Temporary n8n state
uses a synthetic credential and is deleted on completion. Retry On Fail is off.
Do not run outside the isolated namespace or substitute real credentials.

Validated with n8n 2.45.7 / Node 24.22.1. Other versions, queue workers,
concurrent workflows and the browser UI are not covered by this check.

## GitHub Actions

The `CI` workflow runs this regression in its own `n8n-integration` job on
pull requests and pushes to `main`. It pins Ubuntu 24.04, Node 24.22.1 and
n8n 2.45.7. Package installation happens before network isolation; the test
process and its children have loopback access only. No repository secrets,
MailBluster account or production credentials are needed.

The job uses `sudo` only to enter the isolated namespace and serve local HTTPS
on port 443, with the exact Node binary selected by setup-node. It fails if
namespace creation or a regression assertion fails. Only the test's textual
output is retained for seven days, not the TLS key, n8n state or credentials.
The separate `validate` job runs lint, the offline suite/build and a package
dry-run. Publishing remains in the existing separate release workflow.

Fork pull requests may require a repository maintainer to approve the workflow
run under GitHub's fork policy; this workflow does not use `pull_request_target`
or attempt to bypass that approval.
