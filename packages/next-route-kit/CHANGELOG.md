# Changelog

## 0.1.1

### Patch Changes

- 3e8a3f6: Prevent Interceptors from calling `next()` more than once, report unknown API
  errors by default without changing the client response, and redact rejected Zod
  input plus non-stable issue fields unless input capture is explicitly enabled.
- Updated dependencies [3e8a3f6]
    - @next-route-kit/core@0.1.1

## 0.1.0 — 2026-08-18

Initial public release of the Next.js App Router Route Factory, built-in body
and query sources, JSON response serializer, exception filters, immutable
scopes, runtime compatibility diagnostics, and the opt-in `{ code, msg, data }`
API response plugin. `ApiException` carries application-owned business codes,
while `ApiResponsePluginOptions.mapError` lets optional adapters map their own
errors without coupling the main package to a validation library. Custom
body/query resolvers keep their public argument location in pipe metadata, and
response-aware interceptors can preserve native `Response` values. Input
helpers are intentionally limited to `body` and `query`; params, headers, URL,
and cookies remain on the native handler context and `Request`. Route parameter
generics accept both type aliases and interface declarations without requiring a
string index signature.
