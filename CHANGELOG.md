# Changelog

All notable changes to this package are documented here. This project follows [semver](https://semver.org).

## 0.1.0

First release, built against Edgaze OpenAPI 1.1.0.

- `client.workflows`: `list` (paginated), `retrieve`, `versions`, `acceptUpdate`.
- `client.runs`: `create` (with an automatic idempotency key), `retrieve`, `list` (cursor pagination), `cancel`, `events` (paginated), `stream` (Server-Sent Events with automatic resume), `wait` and `createAndWait`.
- Webhook verification: `unwrapWebhook`, `verifyWebhookSignature`, `signWebhookPayload`, and `client.webhooks.unwrap`.
- Typed errors per HTTP status, carrying `code`, `details` and the request id.
- Retries with exponential backoff that honours `Retry-After`; per-attempt timeouts; abort signals.
- ESM and CommonJS builds with types; no runtime dependencies.
