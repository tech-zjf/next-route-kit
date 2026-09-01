# ADR-0012: Enforce production request and response contracts

- Status: accepted
- Date: 2026-09-01

## Context

The initial public API left four contract gaps:

- automatic body readers buffered the full request without a package-owned byte
  limit;
- asynchronous serializer failures could reject outside the ExceptionFilter
  boundary;
- applications could describe required locals without a runtime operation that
  produced them;
- the optional API envelope accepted only string codes and object-shaped data.

Zod validation also transformed values at runtime without carrying the schema
output type into the Route Handler.

## Decision

The Next adapter limits automatic body readers to 1 MiB by default. A Factory or
Route can lower `maxBodyBytes`; inherited limits cannot be relaxed. Endpoints that
need a larger automatic JSON limit use a separate explicitly configured Factory.
Streaming, multipart, and upload handlers remain on the native Request boundary.

Serializer promises are awaited inside the Pipeline error boundary. A Factory can
set `nativeResponse: 'reject'` when every successful result must pass through the
configured serializer; the default remains `passthrough` for native Next.js
compatibility.

`Factory.withLocals(provider)` runs a provider in the Guard stage, merges its
actual output into request locals, and returns a Factory whose Handler locals type
includes that output. A provider may throw an authentication or authorization
error before body parsing. Existing mutable Middleware and Guard locals remain
available for compatibility, but documentation uses providers when a later scope
requires newly established fields.

`@next-route-kit/zod` exposes `zodBody(schema)` and `zodQuery(schema)` as
schema-bound Input Sources. `zodPipe()` remains available for Factory-wide and
advanced transformations; Core remains independent of Zod.

The optional `{ code, msg, data }` policy accepts string or numeric codes and
preserves data exactly, including arrays, primitives, and null. `mapData` remains
the explicit mechanism for applications that want an object-specific list shape.

## Consequences

- public JSON endpoints have a deterministic package-owned memory boundary;
- serializer failures use the same error mapping as the rest of the request;
- typed authenticated scopes are backed by a runtime provider instead of a cast;
- schema transformations and Handler input types share one declaration;
- existing projects that relied on automatic `{ value: ... }` wrapping must add
  an explicit `mapData` function;
- strict response scopes reject native Responses from Middleware, Guards, and
  Handlers, while ExceptionFilter responses remain valid error boundaries.
