# Troubleshooting

**English** · [简体中文](../../zh-CN/user-guide/troubleshooting.md)

## Do I need next.config.ts?

No. Import an application-owned Factory from each Route Handler.

## Why is body missing from context?

`body` exists only when the route declares a body resolver. Otherwise call
`await request.json()` or `await request.text()`.

## Why does a Guard not see body/query?

Guards intentionally run before declared argument resolution so unauthorized
requests do not consume the body.

## Why does JSON return 400 INVALID_JSON?

`jsonBody()` parses JSON. Check the payload or use `textBody()` and the native
request API for non-JSON content.

## Why are repeated query values arrays?

`query()` preserves repeated keys. `?tag=a&tag=b` becomes a read-only array.
Use native URL parsing for another shape.

## Why is the response not wrapped?

The default serializer only converts values to JSON. Use an Interceptor for an
envelope and return a native `Response` for streams, files, redirects, or
special statuses.

## Why is an Edge plugin rejected?

Align the route export and Factory declaration:

```ts
export const runtime = 'edge'
export const route = createRoute({ runtime: 'edge', plugins: [edgePlugin] })
```

The declaration is an early diagnostic, not a substitute for keeping Node-only
imports out of an Edge entrypoint.
