# Changelog

## 0.2.0

### Minor Changes

- 3e8a3f6: Prevent Interceptors from calling `next()` more than once, report unknown API
  errors by default without changing the client response, and redact rejected Zod
  input plus non-stable issue fields unless input capture is explicitly enabled.

### Patch Changes

- Updated dependencies [3e8a3f6]
    - @next-route-kit/core@0.1.1

## 0.1.0 — 2026-08-18

Initial public release of the optional Zod 4 Pipe and validation
ExceptionFilter adapter.
