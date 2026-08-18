# ADR-0010: Use an explicit request lifecycle

## Status

Accepted.

## Context

The Route Factory originally resolved route params and input before entering
middleware and guards. That made malformed request bodies win over authorization
and prevented middleware from preparing request-local state used by input
resolvers.

The package should preserve a familiar separation of concerns while keeping the
App Router Route Handler contract.

## Decision

The public lifecycle is:

```text
Middleware
  ↓
Guard
  ↓
Interceptor (enter)
  ↓
Input Resolver
  ↓
Pipe
  ↓
Handler
  ↓
Interceptor (exit)
  ↓
Middleware (exit)
  ↓
Response Serializer
```

Middleware and guards run before route input resolution. A denied guard never
reads or parses the request body. The Next adapter hydrates `context.params`
before middleware as framework metadata; this does not read request input. Input
resolvers run once per request, pipes transform each declared argument, and
interceptors wrap both input preparation and the handler result.

The Next adapter appends a default ExceptionFilter after user filters. It maps
`HttpError` and malformed JSON into safe JSON responses; unknown errors are not
serialized with their internal message and remain available to Next.js's own
error boundary.

## Consequences

- authentication and authorization can short-circuit before body parsing;
- middleware can prepare request-local state for input resolution;
- input pipes and interceptors have deterministic, documented order;
- input and error behavior is tested independently from Next.js routing;
- the Core pipeline remains framework-neutral and does not import Next.js.

## Rejected alternative

Resolving input before middleware and guards was rejected because it makes body
parsing a prerequisite for authorization and diverges from the intended request
processing model.
