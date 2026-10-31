# n8n-nodes-mailbluster

[![npm version](https://img.shields.io/npm/v/n8n-nodes-mailbluster.svg)](https://www.npmjs.com/package/n8n-nodes-mailbluster)
[![CI](https://github.com/prismosoft/n8n-nodes-mailbluster/actions/workflows/ci.yml/badge.svg)](https://github.com/prismosoft/n8n-nodes-mailbluster/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

[n8n](https://n8n.io/) community node for the MailBluster Developer API.

It supports the complete documented MailBluster Developer API surface for **Leads, Fields, Products, and Orders**, plus an authenticated **Custom API Call** operation for forward compatibility.

> This package is an independent community integration and is not affiliated with or endorsed by MailBluster.

## Features

- Full CRUD coverage for MailBluster Leads, Fields, Products, and Orders where the API exposes it.
- Product and Order pagination with **Return All** and **Limit** controls.
- Accepts a lead email directly for Get, Update, and Delete and automatically generates the MD5 lead hash required by MailBluster.
- Custom lead fields, metadata, tags, double opt-in, and override-existing support.
- Order customer data, campaign attribution, line items, and ecommerce metadata.
- n8n AI-tool support (`usableAsTool`).
- Correct n8n paired-item linking for multi-item workflows.
- Per-execution throttling for MailBluster's published API limits: 10 requests/second and 100 requests/minute.
- Explicit 10-second HTTP timeout and bounded retries for GET requests only.
- Subscription disabled by default, with a local confirmation gate before subscribing leads or order customers.
- Custom authenticated API requests for newly introduced MailBluster endpoints without waiting for a package update.
- Strict TypeScript, n8n node linting, unit tests, CI, and npm provenance publishing.

## Supported operations

| Resource | Operations |
| --- | --- |
| Lead | Create, Get, Update, Delete |
| Field | Create, Get Many, Update, Delete |
| Product | Create, Get, Get Many, Update, Delete |
| Order | Create, Get, Get Many, Update, Delete |
| Custom API Call | GET, POST, PUT, PATCH, DELETE |

MailBluster's Developer API does **not** provide campaign-sending endpoints. The public API is intended for managing leads, fields, products, and ecommerce/order data.

## Installation

### Availability and reviewed source builds

The public npm registry returned 404 for this package during the October 31, 2026
review. The presence of a publishing workflow is not evidence of a published release.
Check `npm view n8n-nodes-mailbluster version` before using the registry installation
instructions below. A 404 means those instructions are not currently usable.

For a reviewed source build, check out the exact reviewed commit (not a moving
branch), then run:

```bash
npm ci
npm run lint
npm test
npm pack --ignore-scripts
```

The resulting local tarball can be installed in a self-hosted n8n community-node
directory. This does not publish to npm, and is not a claim of n8n Cloud availability.
Do not configure credentials while performing offline validation: n8n's credential
test makes a live GET request to `/fields`.

### n8n Community Nodes UI

1. In n8n, open **Settings → Community Nodes**.
2. Select **Install**.
3. Enter:

   ```text
   n8n-nodes-mailbluster
   ```

4. Confirm the installation.

### Self-hosted n8n with npm

From the n8n user directory:

```bash
npm install n8n-nodes-mailbluster
```

Restart n8n after installation.

## Credentials

1. Sign in to MailBluster.
2. Open the Brand you want to connect.
3. Go to **Settings → API Keys**.
4. Create a new API key.
5. In n8n, create a **MailBluster API** credential and paste the key into **API Key**.
6. Save the credential. n8n tests it against MailBluster's Fields endpoint.

The API key is stored through n8n's credential system and is sent to MailBluster in the `Authorization` header.

## Lead operations

### Create

Supports email, subscription state, first/last name, timezone, IP address, custom fields, metadata, tags, double opt-in, and override-existing behavior.

**Subscription consent:** Subscribed defaults to **false**. Enabling it requires
**Consent Confirmed** to be explicitly enabled as well. The confirmation is an
operator assertion, not proof of consent or a consent-storage system, and is not
sent to MailBluster. Existing workflows that explicitly set Subscribed to true
must add this confirmation before upgrading; otherwise they stop before sending.
Explicit false is preserved. Adding subscription state to a lead update also
requires confirmation when setting it to true.

Double Opt-In and Override Existing remain false by default. Selecting Double
Opt-In requests a confirmation email and the provider ignores `subscribed` for
that flow; it is not enabled automatically.

Example custom fields:

```json
{
  "companySize": "10-20",
  "plan": "Pro"
}
```

Example metadata:

```json
{
  "company": "Prismosoft",
  "role": "Founder"
}
```

### Get / Update / Delete

MailBluster requires a lead hash in these endpoint paths. You can provide either the lead's email address or an already-computed MD5 lead hash. When an email is provided, this node computes the MD5 hash automatically.

Update supports mutable lead properties including custom fields, metadata, subscription state, and tag additions/removals.

## Field operations

MailBluster Fields are custom merge fields.

- **Create** requires a field label and merge tag.
- **Get Many** returns all fields exposed by the MailBluster API.
- **Update** requires the field ID, label, and merge tag.
- **Delete** requires the field ID.

## Product operations

- Create products with an external product ID and name.
- Retrieve one product by ID.
- Retrieve multiple products with MailBluster's `pageNo` pagination.
- Update a product name.
- Delete a product.

For **Get Many**, the node follows MailBluster's `meta.nextPageNo` value when **Return All** is enabled.

## Order operations

Create orders with an external Order ID, customer email and optional customer data, currency, total price, one or more line items, and optional MailBluster Campaign ID for attribution.

Order updates support customer data, items, currency, total price, and campaign attribution.

## Custom API Call

Use **Resource → Custom API Call** when MailBluster adds an endpoint that this package does not yet expose as a first-class operation.

The endpoint is relative to:

```text
https://api.mailbluster.com/api
```

For example:

```text
/products
```

Authentication is added automatically. Query parameters and request bodies accept JSON.

## API limits and concurrency

MailBluster documents a default Developer API limit of:

- **10 requests per second**
- **100 requests per minute**

This node throttles requests within each node execution. Separate concurrent n8n executions can still share the same MailBluster account-level limit, so very high concurrency may still receive a `429` from MailBluster. Coordinate concurrency externally when multiple workflows use the same account; this node is not a distributed account-wide limiter.

MailBluster does not support bulk lead changes through the Developer API. n8n can process multiple incoming items, but each lead is sent as an individual API request.

### Timeout, retries, and uncertain write outcomes

- Each HTTP request passes `timeout: 10000` to n8n's HTTP helper. This is a
  per-request transport timeout, not a deadline for the entire workflow.
- POST, PUT, PATCH and DELETE are attempted **once**, including after 429 or 5xx.
  A failure or timeout does not prove a write was not applied. Reconcile the
  remote state before manually resubmitting.
- GET may make up to four attempts for 429, 500, 502, 503 and 504. Numeric
  Retry-After and HTTP-date are supported. A delay exceeding 120 seconds stops
  the operation instead of retrying early. Missing/invalid headers use 1, 2, 4
  seconds. Network errors without a retryable HTTP status are not retried.
- Leave n8n's separate **Retry On Fail** setting off for writes. Workflow-level
  retries and manual re-execution are outside this helper's policy.

Order creation similarly defaults the customer to unsubscribed. Explicitly
subscribing a customer requires Customer Options → Consent Confirmed. In an order
update's Customer JSON, use `"consentConfirmed": true` alongside
`"subscribed": true`; the confirmation is checked locally and removed from the
request. Omitting subscription state in an update leaves it untouched.

**Custom API Call is a raw interface:** its payload is not covered by the
resource-specific consent checks. Its operator must validate permission and the
payload explicitly. The same transport timeout and no-write-retry policy apply.

## Development

Requirements:

- A currently supported Node.js LTS release
- npm
- An n8n instance for interactive testing

```bash
npm ci
npm run lint
npm run build
npm test
npm run dev
```

`npm test` builds the TypeScript sources and runs offline tests. HTTP calls are
replaced with local stubs; clocks and retry waits are simulated. No real API key
or MailBluster account is required. Tests verify that the timeout is passed to
n8n; they do not establish cancellation behavior in a deployed n8n instance.

## Releasing to npm

The repository includes a GitHub Actions publishing workflow using npm provenance, matching current n8n community-node publishing requirements.

Recommended setup is npm **Trusted Publishing** with GitHub Actions:

- Repository owner: `prismosoft`
- Repository: `n8n-nodes-mailbluster`
- Workflow: `publish.yml`

As a fallback, add a granular npm automation token as the repository secret `NPM_TOKEN`.

A version tag such as `0.1.0` triggers the publish workflow.

## Compatibility

The package uses the current n8n community-node package format with `@n8n/node-cli`, `n8nNodesApiVersion: 1`, and strict node metadata.

## MailBluster documentation

- Developer API: https://app.mailbluster.com/api-doc
- API key and integration help: https://mailbluster.com/help/integration

## Security

See [SECURITY.md](SECURITY.md). Never include MailBluster API keys or real subscriber data in GitHub issues, logs, or test fixtures.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT © 2026 Prismosoft. See [LICENSE](LICENSE).
