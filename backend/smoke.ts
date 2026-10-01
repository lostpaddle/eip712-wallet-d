/**
 * 后端端到端冒烟：
 *  用例1 正常签名上送 -> verified: true
 *  用例2 同一 requestId 重放 -> 410（一次性核销）
 *  用例3 他人私钥签同一载荷 -> 401（地址不匹配）
 *
 * 运行：npm run smoke（需先启动后端）
 */
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'

const API = process.env.API_BASE ?? 'http://localhost:3000'

async function fetchTypedData(address: string) {
  const res = await fetch(`${API}/api/typed-data?address=${address}`)
  if (!res.ok) throw new Error(`typed-data ${res.status}: ${await res.text()}`)
  return (await res.json()) as { requestId: string; typedData: any }
}

async function postVerify(body: unknown) {
  const res = await fetch(`${API}/api/verify`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  return { status: res.status, body: await res.json() }
}

async function main() {
  const account = privateKeyToAccount(generatePrivateKey())
  const attacker = privateKeyToAccount(generatePrivateKey())

  // 用例 1：本人签名
  const { requestId, typedData } = await fetchTypedData(account.address)
  const signature = await account.signTypedData({
    domain: typedData.domain,
    types: typedData.types,
    primaryType: typedData.primaryType,
    message: typedData.message,
  })
  const r1 = await postVerify({ requestId, address: account.address, signature })
  console.log('用例1 正常验签 ->', r1.status, JSON.stringify(r1.body))
  if (r1.status !== 200 || r1.body.verified !== true) throw new Error('用例1 失败')

  // 用例 2：重放
  const r2 = await postVerify({ requestId, address: account.address, signature })
  console.log('用例2 重放攻击 ->', r2.status, JSON.stringify(r2.body))
  if (r2.status !== 410) throw new Error('用例2 失败：重放未被拒绝')

  // 用例 3：他人签名
  const t2 = await fetchTypedData(account.address)
  const forged = await attacker.signTypedData({
    domain: t2.typedData.domain,
    types: t2.typedData.types,
    primaryType: t2.typedData.primaryType,
    message: { ...t2.typedData.message, wallet: attacker.address },
  })
  const r3 = await postVerify({ requestId: t2.requestId, address: account.address, signature: forged })
  console.log('用例3 伪造签名 ->', r3.status, JSON.stringify(r3.body))
  if (r3.status !== 401) throw new Error('用例3 失败：伪造签名未被拒绝')

  console.log('BACKEND_SMOKE_OK')
  process.exit(0)
}

main().catch((e) => {
  console.error('BACKEND_SMOKE_FAIL', e)
  process.exit(1)
})
