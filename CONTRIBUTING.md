# Contributing

## Setup

```bash
npm install
npm run check   # everything CI runs: generated types, typecheck, format, tests, build, package lint
```

## How the SDK is put together

- `spec/openapi.json` is the published [Edgaze OpenAPI document](https://github.com/edgaze-ai/edgaze-openapi). Update it with `npm run spec:pull`, never by hand.
- `src/generated/openapi.ts` is generated from it by `npm run generate`. Never edit it by hand; CI fails if it is stale.
- `src/types.ts` gives the generated schemas friendly names.
- `src/core/` holds the transport (retries, timeouts, errors), pagination, the SSE decoder and the run stream.
- `src/resources/` holds one file per API resource. Every method maps to one operation in the spec.

## When the API changes

A scheduled workflow pulls the spec daily and opens a pull request when it changed. The spec coverage tests (`tests/unit/spec-coverage.test.ts`) fail on that PR when the API gained an operation, a query parameter or a webhook event the SDK does not cover. To fix it:

1. Add the method or parameter in `src/resources/`, with a doc comment.
2. Add it to `SDK_CALLS` in the coverage test and write unit tests against the mock server in `tests/helpers/server.ts`.
3. Document it in the README and add a CHANGELOG entry.

## Tests

- `npm test` runs unit tests against a real local HTTP server, so retries, timeouts, aborts and streaming go through real sockets.
- `npm run test:live` runs against the real API. It needs `EDGAZE_API_KEY`; see the header of `tests/live/api.test.ts` for options. Runs are started only on free workflows.
- `node scripts/smoke-package.mjs` installs the packed tarball in a fresh project and uses it from ESM, CommonJS and TypeScript.

## Releasing

1. Bump `version` in `package.json` and `src/version.ts`, and add a `## <version>` section to `CHANGELOG.md`.
2. Merge to `main`, then tag: `git tag v<version> && git push origin v<version>`.
3. The release workflow checks everything, publishes to npm with provenance, and creates the GitHub release.
