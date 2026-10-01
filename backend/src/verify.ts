import { recoverTypedDataAddress, getAddress } from 'viem'
import type { PendingPayload } from './eip712.js'

export interface VerifyResult {
  ok: boolean
  reason?: string
  recoveredAddress?: string
}

/**
 * 后端验签：
 * 1. 用服务端保存的原始载荷（而非前端上送内容）重建 EIP-712 哈希
 * 2. 从签名恢复地址
 * 3. 恢复地址、载荷中的 wallet、前端上送地址三者一致
 */
export async function verifySignature(
  payload: PendingPayload,
  address: string,
  signature: string,
): Promise<VerifyResult> {
  const { domain, types, primaryType, message } = payload.typedData

  let recovered: string
  try {
    recovered = await recoverTypedDataAddress({
      domain,
      types,
      primaryType,
      message,
      signature,
    } as Parameters<typeof recoverTypedDataAddress>[0])
  } catch {
    return { ok: false, reason: '签名格式无效或无法恢复地址' }
  }

  const expected = getAddress(address).toLowerCase()
  const signedWallet = String(message.wallet).toLowerCase()

  if (recovered.toLowerCase() !== expected) {
    return { ok: false, reason: '恢复地址与上送地址不匹配', recoveredAddress: recovered }
  }
  if (signedWallet !== expected) {
    return { ok: false, reason: '载荷中的 wallet 与上送地址不匹配', recoveredAddress: recovered }
  }

  return { ok: true, recoveredAddress: recovered }
}
