# ADR-0011: Make inherited Scope components non-removable in 0.1.0

- Status: accepted
- Date: 2026-08-18

## Context

Global and business-scope Middleware and Guards commonly contain request IDs,
authentication, tenant checks, audit logging, and other cross-cutting policy.
An opt-out flag would make a route's security behavior depend on a local array
that is easy to miss during review.

## Decision

`Factory.extend()` only appends child contributions. It has no `disable`,
`remove`, or path-based override operation in the 0.1.0 public API. Inherited
Middleware, Guards, Input Pipes, Interceptors, and Error Mappers remain active
for every child route.

When a route needs a different policy, the application creates a separate
explicit Factory with the intended components. This keeps the security boundary
visible in imports and makes the effective pipeline deterministic.

## Consequences

- shared security behavior cannot be silently bypassed;
- Scope composition remains immutable and easy to test;
- public and authenticated domains use different explicit Factory modules;
- future opt-out support, if ever needed, must introduce an explicit mandatory
  policy and a dedicated review of its security semantics.
