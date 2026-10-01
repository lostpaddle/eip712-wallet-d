/**
 * Relay 冒烟：A/B 两个连接订阅同一 topic，A publish，B 应收到 irn_subscription
 * 运行：npm run smoke
 */
import WebSocket from 'ws'

const URL = process.env.RELAY_URL ?? 'ws://localhost:8787'
const topic = '0x' + 'ab'.repeat(32)

function rpc(id: number, method: string, params: unknown) {
  return { jsonrpc: '2.0', id, method, params }
}

function connect(): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(URL)
    ws.on('open', () => resolve(ws))
    ws.on('error', reject)
  })
}

async function main() {
  const a = await connect()
  const b = await connect()

  const received = new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('B 未在 3 秒内收到消息')), 3000)
    b.on('message', (raw) => {
      const msg = JSON.parse(raw.toString())
      if (msg.method === 'irn_subscription' && msg.params.data.topic === topic) {
        clearTimeout(timer)
        console.log('[relay smoke] B 收到投递，message =', msg.params.data.message)
        resolve()
      }
    })
  })

  a.send(JSON.stringify(rpc(1, 'irn_subscribe', { topic })))
  b.send(JSON.stringify(rpc(2, 'irn_subscribe', { topic })))

  await new Promise((r) => setTimeout(r, 300))
  a.send(
    JSON.stringify(
      rpc(3, 'irn_publish', { topic, message: 'hello-relay', ttl: 60, tag: 1100 }),
    ),
  )

  await received
  a.close()
  b.close()
  console.log('RELAY_SMOKE_OK')
  process.exit(0)
}

main().catch((e) => {
  console.error('RELAY_SMOKE_FAIL', e)
  process.exit(1)
})
