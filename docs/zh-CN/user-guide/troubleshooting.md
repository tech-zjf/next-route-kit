# 问题排查

[English](../../en/user-guide/troubleshooting.md) · **简体中文**

## 需要 next.config.ts 吗？

不需要。每个 Route Handler 显式 import 应用自己的 Factory。

## 为什么 context 里没有 body？

只有声明了 `body` 才会提供这个属性。否则直接使用
`await request.json()` 或 `await request.text()`。

## 为什么 Guard 不能读取 body/query？

这是有意设计：Guard 在声明的参数解析前执行，未授权请求不需要消费 Body。

## 为什么 JSON 返回 400 INVALID_JSON？

`jsonBody()` 会解析 JSON。检查请求内容；非 JSON 请求使用 `textBody()` 或原生
Request API。

## 为什么重复 Query 值是数组？

`query()` 保留重复 Key，`?tag=a&tag=b` 会变成只读数组。需要其他形状时直接
使用原生 URL API。

## 为什么响应没有统一包装？

默认 serializer 只负责把值转换成 JSON。统一 Envelope 使用 Interceptor；流、文件、
跳转和特殊状态码直接返回原生 `Response`。

## 为什么 Edge 插件不兼容？

保持 Route 导出和 Factory 声明一致：

```ts
export const runtime = 'edge'
export const route = createRoute({ runtime: 'edge', plugins: [edgePlugin] })
```

这是提前诊断，不会替你把 Node-only import 变成 Edge 兼容。
