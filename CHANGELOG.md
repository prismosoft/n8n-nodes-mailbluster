# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

- Read full HTTP responses before n8n error wrapping so GET Retry-After
  headers survive; safely inspect wrapped cause/errorResponse as a fallback.
  Keep successful API bodies unchanged and never retry writes.

- Default lead and order-customer subscriptions to false and require explicit
  local consent confirmation before setting subscription state to true.
  Existing workflows that subscribe contacts must add the confirmation.
- Never automatically retry writes, even for 429 and transient server errors.
- Set a 10-second HTTP timeout, support HTTP-date Retry-After for GET retries,
  and stop rather than shorten retry delays exceeding 120 seconds.

### Added

- A separate read-only CI job for the real n8n Retry-After regression, with
  loopback-only network isolation, pinned runtime versions and no live secrets.

- Real n8n CLI regression against an isolated local HTTPS fixture, plus
  offline regressions for full responses and wrapped errors.

- Offline regression tests for consent, request policy, timeout forwarding,
  Retry-After handling, and the per-execution limiter boundary.
- Source-build installation guidance when the npm package is unavailable and
  documented limits for custom API calls and workflow-level retries.

## [0.1.0] - 2026-10-07

### Added

- MailBluster API-key credentials with connection testing.
- Full documented Developer API coverage for Leads, Fields, Products, and Orders.
- Automatic MD5 hashing when a lead email is supplied to read, update, or delete operations.
- Pagination for Product and Order list operations.
- Custom authenticated API call operation for forward compatibility.
- MailBluster-aware request throttling and transient-error retries.
- n8n AI-tool compatibility and item-linking support.
- CI, npm provenance publishing workflow, tests, documentation, and MIT license.
