# ADR-0007: Keep Zod validation in an optional adapter package

## Status

Accepted.

## Context

The Core pipeline needs a stable `Pipe` contract, but it should not choose
one schema library for every application. Importing Zod from Core would make
the base package larger, couple its release surface to Zod, and make a future
validator adapter harder to add. Validation errors also need a predictable
conversion into the existing `ExceptionFilter` stage.

## Decision

Publish `@next-route-kit/zod` as an independent package with Zod as a peer
dependency. The first adapter exposes:

- `ZodPipe` / `zodPipe(schema)` for async validation and parsed-output
  replacement;
- `zodBody(schema)` and `zodQuery(schema)` for schema-bound Next Route inputs
  whose Handler types come from the parsed Zod output;
- `ZodValidationError` with normalized, immutable, client-safe issues and
  argument metadata; rejected input is redacted unless `captureInput` is
  explicitly enabled;
- `ZodExceptionFilter` / `zodExceptionFilter(options)` for configurable JSON
  responses when the application wants a standalone Zod error shape.

The adapter depends only on `@next-route-kit/core` contracts. Core and
`next-route-kit` do not import Zod. The adapter uses the async parse API so
schemas with asynchronous refinements are supported.

`ZodExceptionFilter` is never installed by default. Applications that use the
main package's `{ code, msg, data }` response plugin should register `zodPipe()`
and map `ZodValidationError` through `apiResponsePlugin({ mapError })` instead;
the generic hook keeps the response contract without coupling the main package
to Zod.

## Consequences

Positive:

- applications opt in to Zod and keep the base install validator-agnostic;
- the same pipe and error mapper can be registered globally, on a scope, or on
  one route through the existing Factory configuration;
- a future Valibot, ArkType, or custom adapter can implement the same Core
  contracts without changing the pipeline.

Trade-off:

- the parsed output of a `Pipe` is a runtime pipeline transformation; the route
  handler's static input type still comes from its `body` or `query` definition.
  Applications should use schema-bound inputs for route-local schemas, or use
  `z.output` explicitly when a Factory-wide Pipe transforms a value.

## Rejected alternatives

- Put Zod directly in `next-route-kit`: rejected because it makes validation a
  mandatory dependency and mixes framework adapter and schema concerns.
- Make Core depend on a generic schema interface with built-in parsing:
  rejected because Core should only own lifecycle contracts, not validation
  policy or error response shape.
