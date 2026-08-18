# Changelog

## 0.1.0 — 2026-08-18

Initial public release of the Next.js App Router Route Factory, built-in body
and query sources, JSON response serializer, exception filters, immutable
scopes, and runtime compatibility diagnostics. Custom body/query resolvers keep
their public argument location in pipe metadata, and response-aware interceptors
can preserve native `Response` values. Input helpers are intentionally limited
to `body` and `query`; params, headers, URL, and cookies remain on the native
handler context and `Request`.
