# 问题排查

[English](../../en/user-guide/troubleshooting.md) · **简体中文**

## 需要修改 `next.config.ts` 吗？

不需要。在每个 `app/**/route.ts` 中导入应用自己的 Factory 即可。包不会扫描文件，也不会通过 Next 配置注入运行时组件。

## 为什么 Guard 没有拿到 `input`？

这是设计如此。执行顺序是 Middleware → Guard → Input Resolver。Guard 应该使用 `request`、hydrate 后的 `params` 和 `state` 做权限判断，而不需要消费请求 Body。依赖解析后输入的逻辑应放到 Input Pipe 或 Handler。

## 为什么 JSON 请求返回 `400 INVALID_JSON`？

`jsonBody()` 和 `readBody()` 会把 Body 按 JSON 解析。请检查请求 Body 和 `content-type`。如果接口接收文本，请使用 `textBody()`。

## 为什么重复 Query 值变成数组？

`query()` 会保留重复 URL Key。`?tag=a&tag=b` 会变成 `{ tag: ['a', 'b'] }`，只出现一次的 Key 仍然是字符串。可以在 Input Pipe 中校验或归一化该结构。

## 为什么 Handler 返回值没有得到预期的统一包装？

默认 Serializer 只负责把值转换为 JSON。需要统一 Envelope 时，在 Factory 或 Scope 配置 `jsonResponse({ transform })`。下载、流、特殊状态码或特殊 Content-Type 请直接返回 `Response`。

## 为什么返回 `undefined` 会失败？

`undefined` 没有明确的 HTTP 表达方式。请返回 JSON 值、`null` 或显式 `Response`，例如 `new Response(null, { status: 204 })`。

## 为什么插件被判定为不兼容 Edge？

让 Factory Runtime 与 Next 路由模块的 Runtime 保持一致：

```ts
export const runtime = 'edge'
export const route = createRoute({ runtime: 'edge', plugins: [edgePlugin] })
```

该诊断只检查插件声明的 metadata，不能把 Node-only import 变成 Edge 兼容。Node-only 依赖必须排除在 Edge entrypoint 之外。

## 为什么 `OPTIONS` 没有经过 Pipeline？

如果 Route Handler 没有显式导出 `OPTIONS`，Next.js 可能自动生成响应。需要 CORS 或其他横切逻辑经过 Factory 时，请显式导出 `OPTIONS = route({ ... })`。

## 可以为一个路由关闭全局 Guard 吗？

在 `0.1.0` 中不可以。继承组件不能被静默移除。请创建具有目标安全策略的独立 Factory，让路由的安全策略在 import 位置清晰可见。

## 如何提交兼容性问题？

请用最小 Route Handler 复现，并提供 Next.js 版本、Node.js 或 Edge Runtime、路由模块导出，以及以下命令输出：

```bash
pnpm typecheck
pnpm build
pnpm verify:next:dev
```

然后在[仓库 Issue](https://github.com/tech-zjf/next-route-kit/issues) 中提交问题。
