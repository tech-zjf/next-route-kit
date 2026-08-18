# ADR-0006: Preserve Input Source Metadata

- Status: accepted
- Date: 2026-08-18

## Context

`InputPipe` already receives an `InputMetadata` argument, but the first adapter
implementation always passed `{ location: 'custom', name: 'route-input' }`.
That made it impossible for a validator or schema adapter to distinguish body,
query, params, headers, and custom input without coupling itself to the Next
adapter.

## Decision

`RouteContext` may carry an optional `inputMetadata` value. The Core Pipeline
passes that value unchanged to every `InputPipe`. If a caller creates a legacy
context without metadata, Core preserves the existing
`custom/route-input` fallback.

The Next adapter derives immutable metadata when compiling a route:

- a single `InputSource` exposes its `location` and `name`;
- a composed input map exposes a `custom/route-input` container and a
  field-level `fields` map;
- literal fields in a mixed map are marked `custom` and named after their key;
- resolver functions and direct values use the fallback metadata because their
  runtime origin cannot be known at compile time.

## Consequences

- Core remains validator- and schema-library agnostic.
- Optional Zod, Valibot, OpenAPI, or custom adapters can use one public
  metadata contract.
- Existing route contexts and Core callers remain source-compatible because the
  context property is optional.
- Metadata describes origin, not validation rules or parsed values; those remain
  the responsibility of Input Pipes and optional packages.
