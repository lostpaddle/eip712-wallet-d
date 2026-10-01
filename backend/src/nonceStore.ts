import type { PendingPayload } from './eip712.js'

/**
 * Demo 内存存储：requestId -> 待签载荷
 * 生产环境替换为 Redis（SET key payload EX 300），接口保持不变。
 */
class NonceStore {
  private readonly store = new Map<string, PendingPayload>()

  put(requestId: string, payload: PendingPayload): void {
    this.store.set(requestId, payload)
  }

  /** 取出并立即核销（一次性），过期或不存在返回 null */
  consume(requestId: string): PendingPayload | null {
    const payload = this.store.get(requestId)
    if (!payload) return null
    this.store.delete(requestId)
    if (payload.expiresAt < Date.now()) return null
    return payload
  }
}

export const nonceStore = new NonceStore()
