# ADR-0006: Preserve Input Source Metadata

- Status: accepted
- Date: 2026-08-18

## Context

`Pipe` already receives an `ArgumentMetadata` argument, but the first adapter
implementation always passed `{ type: 'custom', name: 'route-arguments' }`.
That made it impossible for a validator or schema adapter to distinguish body,
query, params, headers, and custom input without coupling itself to the Next
adapter.

## Decision

`RouteContext` may carry an optional `argumentMetadata` value. The Core Pipeline
passes field metadata to each `Pipe`. If a caller creates a context without
metadata, Core uses the `custom/route-arguments` fallback for an advanced
whole-args pipe.

The Next adapter derives immutable metadata when compiling a route:

- a single `InputSource` exposes its source `location` and `name`, which the
  adapter maps to `ArgumentMetadata.type`;
- a composed input map exposes a `custom/route-arguments` container and a
  field-level `fields` map;
- literal fields in a mixed map are marked `custom` and named after their key;
- resolver functions use the fallback metadata because their
  runtime origin cannot be known at compile time.

## Consequences

- Core remains validator- and schema-library agnostic.
- Optional Zod, Valibot, OpenAPI, or custom adapters can use one public
  metadata contract.
- Existing route contexts and Core callers remain source-compatible because the
  context property is optional.
- Metadata describes origin, not validation rules or parsed values; those remain
  the responsibility of Pipes and optional packages.
