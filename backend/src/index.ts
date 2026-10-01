import express from 'express'
import cors from 'cors'
import { isAddress, getAddress } from 'viem'
import { buildTypedData, PAYLOAD_TTL_SECONDS, type PendingPayload } from './eip712.js'
import { nonceStore } from './nonceStore.js'
import { verifySignature } from './verify.js'

const app = express()
app.use(cors())
app.use(express.json())

app.get('/health', (_req, res) => res.json({ ok: true }))

/**
 * 下发一次性 EIP-712 待签载荷
 * GET /api/typed-data?address=0x...
 */
app.get('/api/typed-data', (req, res) => {
  const rawAddress = String(req.query.address ?? '')
  if (!isAddress(rawAddress)) {
    res.status(400).json({ error: 'address 参数不是合法的 EVM 地址' })
    return
  }
  const address = getAddress(rawAddress)
  const { requestId, typedData } = buildTypedData(address)

  const payload: PendingPayload = {
    address,
    typedData,
    expiresAt: Date.now() + PAYLOAD_TTL_SECONDS * 1000,
  }
  nonceStore.put(requestId, payload)

  res.json({ requestId, ttlSeconds: PAYLOAD_TTL_SECONDS, typedData })
})

/**
 * 验签并核销
 * POST /api/verify { requestId, address, signature }
 */
app.post('/api/verify', async (req, res) => {
  const { requestId, address, signature } = req.body ?? {}
  if (typeof requestId !== 'string' || typeof address !== 'string' || typeof signature !== 'string') {
    res.status(400).json({ error: '参数缺失：requestId / address / signature' })
    return
  }
  if (!isAddress(address)) {
    res.status(400).json({ error: 'address 不合法' })
    return
  }

  const payload = nonceStore.consume(requestId)
  if (!payload) {
    res.status(410).json({ error: '载荷不存在或已过期（每个签名请求仅可使用一次）' })
    return
  }

  const result = await verifySignature(payload, address, signature)
  if (!result.ok) {
    res.status(401).json({ verified: false, ...result })
    return
  }

  // 验签通过：此处可建立会话（签发 JWT）或执行业务操作
  res.json({
    verified: true,
    address: getAddress(address),
    // token: signJwt(address),
  })
})

const PORT = Number(process.env.PORT ?? 3000)
app.listen(PORT, () => {
  console.log(`[backend] API listening on http://localhost:${PORT}`)
})
