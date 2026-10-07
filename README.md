# n8n-nodes-mailbluster

[![npm version](https://img.shields.io/npm/v/n8n-nodes-mailbluster.svg)](https://www.npmjs.com/package/n8n-nodes-mailbluster)
[![CI](https://github.com/prismosoft/n8n-nodes-mailbluster/actions/workflows/ci.yml/badge.svg)](https://github.com/prismosoft/n8n-nodes-mailbluster/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

Production-ready [n8n](https://n8n.io/) community node for the MailBluster Developer API.

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
- Automatic retry with backoff for `429`, `500`, `502`, `503`, and `504` responses.
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

This node throttles requests within each node execution and retries transient failures. Separate concurrent n8n executions can still share the same MailBluster account-level limit, so very high concurrency may still receive a `429` from MailBluster.

MailBluster does not support bulk lead changes through the Developer API. n8n can process multiple incoming items, but each lead is sent as an individual API request.

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
