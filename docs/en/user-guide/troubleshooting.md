# Troubleshooting

[简体中文](../../zh-CN/user-guide/troubleshooting.md) · **English**

## Do I need to edit `next.config.ts`?

No. Import an application-owned Factory from each `app/**/route.ts` file. The
package intentionally does not scan files or inject runtime components through
Next configuration.

## Why did a Guard not receive `input`?

That is intentional. The order is Middleware → Guard → Input Resolver. Guards
can authorize from `request`, hydrated `params`, and `state` without consuming a
request body. Move work that requires parsed input into an Input Pipe or the
handler.

## Why did a JSON request return `400 INVALID_JSON`?

`jsonBody()` and `readBody()` parse the body as JSON. Check the request's body
and `content-type` handling. If the endpoint accepts text instead, use
`textBody()`.

## Why is a repeated query value an array?

`query()` preserves repeated URL keys. `?tag=a&tag=b` becomes
`{ tag: ['a', 'b'] }`; a key used once remains a string. Validate or normalize
that shape in an Input Pipe.

## Why did my handler result not get the expected wrapper?

The default serializer only converts a value to JSON. Configure
`jsonResponse({ transform })` on the Factory or a scope for a shared envelope.
Return an explicit `Response` for downloads, streams, custom status codes, or
content types.

## Why was `undefined` rejected?

An undefined handler result has no unambiguous HTTP representation. Return a
JSON value, `null`, or an explicit `Response` such as `new Response(null, {
status: 204 })`.

## Why is a plugin rejected for Edge?

Set the Factory runtime and the Next route-module runtime to the same value:

```ts
export const runtime = 'edge'
export const route = createRoute({ runtime: 'edge', plugins: [edgePlugin] })
```

The diagnostic checks declared plugin metadata. It cannot make a Node-only
import Edge-compatible; keep Node-only dependencies out of Edge entrypoints.

## Why did `OPTIONS` bypass my pipeline?

If a Route Handler does not explicitly export `OPTIONS`, Next.js may generate an
automatic response. Export `OPTIONS = route({ ... })` when CORS or other
cross-cutting behavior must pass through the Factory.

## Can I disable a global Guard for one route?

Not in `0.1.0`. Inherited components cannot be silently removed. Create a
separate Factory with the intended security policy so the route's policy is
visible at its import site.

## Where should I report a compatibility issue?

Reproduce it with the smallest Route Handler possible, include the Next.js
version, Node.js or Edge runtime, route module exports, and the output of:

```bash
pnpm typecheck
pnpm build
pnpm verify:next:dev
```

Then open an issue in the [repository issue tracker](https://github.com/tech-zjf/next-route-kit/issues).
