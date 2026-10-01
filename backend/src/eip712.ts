import { randomBytes } from 'node:crypto'
import type { TypedData } from './types.js'

export const DOMAIN = {
  name: 'EIP712 Mobile Demo',
  version: '1',
  chainId: 1,
} as const

export const TYPES = {
  Verification: [
    { name: 'wallet', type: 'address' },
    { name: 'nonce', type: 'uint256' },
    { name: 'issuedAt', type: 'uint256' },
    { name: 'expiresAt', type: 'uint256' },
    { name: 'scope', type: 'string' },
  ],
} as const

export const PRIMARY_TYPE = 'Verification'
export const PAYLOAD_TTL_SECONDS = 300

export interface PendingPayload {
  address: string
  typedData: TypedData
  expiresAt: number // 毫秒时间戳
}

/**
 * 由服务端生成一次性 EIP-712 载荷。
 * 生产环境：载荷与 requestId 的映射写入 Redis，TTL = PAYLOAD_TTL_SECONDS。
 */
export function buildTypedData(address: string): { requestId: string; typedData: TypedData } {
  const nowSeconds = Math.floor(Date.now() / 1000)
  const nonce = BigInt('0x' + randomBytes(32).toString('hex')).toString()

  const typedData: TypedData = {
    domain: DOMAIN,
    types: TYPES,
    primaryType: PRIMARY_TYPE,
    message: {
      wallet: address,
      nonce,
      issuedAt: String(nowSeconds),
      expiresAt: String(nowSeconds + PAYLOAD_TTL_SECONDS),
      scope: 'auth.login',
    },
  }

  const requestId = randomBytes(16).toString('hex')
  return { requestId, typedData }
}
