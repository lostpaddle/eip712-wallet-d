import { ethers } from 'ethers'
import { loadPrivateKey, savePrivateKey } from './keyStore'

export interface TypedDataPayload {
  domain: Record<string, unknown>
  types: Record<string, Array<{ name: string; type: string }>>
  primaryType: string
  message: Record<string, unknown>
}

/** 首次启动自动生成钱包并安全存储；之后从安全区载入 */
export async function ensureWallet(): Promise<ethers.Wallet> {
  let privateKey = await loadPrivateKey()
  if (!privateKey) {
    const created = ethers.Wallet.createRandom()
    privateKey = created.privateKey
    await savePrivateKey(privateKey)
  }
  return new ethers.Wallet(privateKey)
}

/** EIP-712 本地签名（私钥不离开设备） */
export async function signTypedData(payload: TypedDataPayload): Promise<string> {
  const wallet = await ensureWallet()
  // ethers v6：signTypedData(domain, types, message)
  // types 中若含 EIP712Domain 键需剔除，避免重复定义
  const { EIP712Domain: _ignored, ...structTypes } = payload.types as Record<string, unknown>
  return wallet.signTypedData(
    payload.domain as ethers.TypedDataDomain,
    structTypes as ethers.TypedDataField[],
    payload.message as Record<string, unknown>,
  )
}
