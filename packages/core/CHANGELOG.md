# Changelog

## 0.1.1

### Patch Changes

- 3e8a3f6: Prevent Interceptors from calling `next()` more than once, report unknown API
  errors by default without changing the client response, and redact rejected Zod
  input plus non-stable issue fields unless input capture is explicitly enabled.

## 0.1.0 — 2026-08-18

Initial public release of the framework-neutral Core contracts, immutable
plugin registry, and deterministic request pipeline runtime.
Route context parameter generics accept both type aliases and interface
declarations without requiring a string index signature.
