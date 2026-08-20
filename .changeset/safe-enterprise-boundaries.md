---
'@next-route-kit/core': patch
'next-route-kit': patch
'@next-route-kit/zod': minor
---

Prevent Interceptors from calling `next()` more than once, report unknown API
errors by default without changing the client response, and redact rejected Zod
input plus non-stable issue fields unless input capture is explicitly enabled.
