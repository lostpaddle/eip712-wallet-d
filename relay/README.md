# 自建 Relay（最小实现）

WalletConnect v2 `irn` 协议的最小可运行 Relay：topic 订阅/发布路由 + 离线消息缓存（TTL）。

## 本地运行

```bash
npm install
npm run dev
# ws://localhost:8787 ，健康检查 http://localhost:8787/health
```

## Docker 运行

```bash
docker build -t eip712-relay .
docker run -d -p 8787:8787 --name eip712-relay eip712-relay
```

## 客户端如何指向本 Relay

- 网页端 / 移动端 SDK 初始化时设置：
  ```ts
  SignClient.init({ relayUrl: 'ws://localhost:8787' /* 生产为 wss://relay.your-domain.com */ })
  ```
- **两端必须指向同一个 Relay**，否则无法握手。

## 生产化建议

本实现不含鉴权、限流、多实例广播与监控，生产环境请评估：

- [bitvora/wallet-relay](https://github.com/bitvora/wallet-relay)（社区轻量实现）
- [Shugur-Network/relay](https://github.com/Shugur-Network/relay)（Go + CockroachDB，多节点）
- 多实例部署时，topic 路由需要 Redis Pub/Sub 或消息总线在实例间转发。
