/**
 * 最小 WalletConnect v2 Relay（irn 协议）
 *
 * 支持的 JSON-RPC 方法：
 *   irn_subscribe       { topic }                     -> { id }
 *   irn_batchSubscribe  { topics: string[] }           -> { id }
 *   irn_publish         { topic, message, ttl, tag }   -> true
 *
 * 服务端主动推送：
 *   irn_subscription    { id, data: { topic, message } }
 *
 * 仅用于开发/测试与闭环内网。生产环境请评估社区完整实现或官方公共 Relay。
 */
import http from 'node:http'
import { WebSocketServer, WebSocket } from 'ws'

const PORT = Number(process.env.PORT ?? 8787)

interface CachedMessage {
  message: string
  expiry: number
  delivered: WeakSet<WebSocket>
}

const topicSubscribers = new Map<string, Set<WebSocket>>()
const topicCache = new Map<string, CachedMessage[]>()

let nextSubscriptionId = 1
let nextPushId = -1

class ClientState {
  readonly subscriptions = new Map<number, string>()
}
const clientStates = new WeakMap<WebSocket, ClientState>()

const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'content-type': 'text/plain' })
    res.end('relay ok')
    return
  }
  res.writeHead(404)
  res.end()
})

const wss = new WebSocketServer({ server, path: '/' })

wss.on('connection', (socket) => {
  clientStates.set(socket, new ClientState())

  socket.on('message', (raw) => {
    let payload: unknown
    try {
      payload = JSON.parse(raw.toString())
    } catch {
      return
    }
    const isBatch = Array.isArray(payload)
    const requests = (isBatch ? payload : [payload]) as JsonRpcRequest[]
    const responses = requests
      .map((req) => handleRequest(socket, req))
      .filter((r): r is JsonRpcResponse => r !== null)
    if (responses.length === 0) return
    socket.send(JSON.stringify(isBatch ? responses : responses[0]))
  })

  socket.on('close', () => {
    const state = clientStates.get(socket)
    if (!state) return
    for (const topic of state.subscriptions.values()) {
      topicSubscribers.get(topic)?.delete(socket)
    }
  })

  socket.on('error', () => socket.terminate())
})

// 服务端 WebSocket 层心跳，清理死连接
setInterval(() => {
  for (const socket of wss.clients) {
    if (socket.readyState === WebSocket.OPEN) socket.ping()
  }
}, 30_000).unref()

// 过期离线消息清理
setInterval(() => {
  const now = Date.now()
  for (const [topic, messages] of topicCache) {
    const live = messages.filter((m) => m.expiry > now)
    if (live.length === 0) topicCache.delete(topic)
    else if (live.length !== messages.length) topicCache.set(topic, live)
  }
}, 60_000).unref()

function handleRequest(socket: WebSocket, req: JsonRpcRequest): JsonRpcResponse | null {
  const { id, method, params } = req
  try {
    switch (method) {
      case 'irn_subscribe': {
        const subId = subscribe(socket, params.topic)
        return { jsonrpc: '2.0', id, result: { id: String(subId) } }
      }
      case 'irn_batchSubscribe': {
        let subId = 0
        for (const topic of params.topics as string[]) subId = subscribe(socket, topic)
        return { jsonrpc: '2.0', id, result: { id: String(subId) } }
      }
      case 'irn_publish': {
        publish(params)
        return { jsonrpc: '2.0', id, result: true }
      }
      default:
        return { jsonrpc: '2.0', id, error: { code: -32601, message: `Method not found: ${method}` } }
    }
  } catch (err) {
    return {
      jsonrpc: '2.0',
      id,
      error: { code: -32603, message: err instanceof Error ? err.message : 'Internal error' },
    }
  }
}

function subscribe(socket: WebSocket, topic: string): number {
  let set = topicSubscribers.get(topic)
  if (!set) {
    set = new Set()
    topicSubscribers.set(topic, set)
  }
  set.add(socket)

  const state = clientStates.get(socket)!
  const subId = nextSubscriptionId++
  state.subscriptions.set(subId, topic)

  // 回放该 topic 尚未投递给当前连接的离线消息
  const messages = topicCache.get(topic)
  if (messages) {
    for (const cached of messages) {
      if (!cached.delivered.has(socket)) {
        cached.delivered.add(socket)
        push(socket, subId, topic, cached.message)
      }
    }
  }
  return subId
}

function publish(params: IrnPublishParams): void {
  const { topic, message, ttl } = params
  const entry: CachedMessage = {
    message,
    expiry: Date.now() + ttl * 1000,
    delivered: new WeakSet(),
  }
  const list = topicCache.get(topic) ?? []
  list.push(entry)
  topicCache.set(topic, list)

  const state = (sockets: Set<WebSocket>) => {
    for (const socket of sockets) {
      const clientState = clientStates.get(socket)
      if (!clientState) continue
      const subId = [...clientState.subscriptions.entries()].find(([, t]) => t === topic)?.[0] ?? 0
      entry.delivered.add(socket)
      push(socket, subId, topic, message)
    }
  }
  topicSubscribers.get(topic)?.forEach((s) => state(new Set([s])))
}

function push(socket: WebSocket, subId: number, topic: string, message: string): void {
  if (socket.readyState !== WebSocket.OPEN) return
  socket.send(
    JSON.stringify({
      jsonrpc: '2.0',
      id: nextPushId--,
      method: 'irn_subscription',
      params: { id: String(subId), data: { topic, message } },
    }),
  )
}

server.listen(PORT, () => {
  console.log(`[relay] WalletConnect minimal relay listening on ws://0.0.0.0:${PORT}`)
})

interface JsonRpcRequest {
  id: number | string
  jsonrpc: '2.0'
  method: string
  params: any
}
interface JsonRpcResponse {
  id: number | string
  jsonrpc: '2.0'
  result?: unknown
  error?: { code: number; message: string }
}
interface IrnPublishParams {
  topic: string
  message: string
  ttl: number
  tag?: number
}
