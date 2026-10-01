import SignClient from '@walletconnect/sign-client'
import type { ProposalTypes, RequestTypes } from '@walletconnect/types'
import { CHAINS, METHODS, EVENTS } from '../config'
import { ensureWallet, signTypedData, type TypedDataPayload } from '../wallet/signer'

type Listener = (payload: unknown) => void

/**
 * WalletConnect 钱包端（responder 角色）
 * 职责：pair 配对 → 批准/拒绝会话 → 响应签名请求
 */
export class WalletNode {
  private signClient: SignClient | null = null
  private address: string | null = null
  private listeners = new Map<string, Set<Listener>>()

  on(event: 'proposal' | 'request' | 'log', listener: Listener): () => void {
    let set = this.listeners.get(event)
    if (!set) {
      set = new Set()
      this.listeners.set(event, set)
    }
    set.add(listener)
    return () => set!.delete(listener)
  }

  private emit(event: string, payload: unknown): void {
    this.listeners.get(event)?.forEach((fn) => fn(payload))
  }

  async init(relayUrl: string): Promise<string> {
    const wallet = await ensureWallet()
    this.address = wallet.address

    this.signClient = await SignClient.init({
      projectId: 'selfhosted-demo',
      relayUrl,
    })

    this.signClient.on('session_proposal', (proposal: ProposalTypes.Struct) => {
      this.emit('proposal', proposal)
    })
    this.signClient.on('session_request', (event: RequestTypes.Event) => {
      this.emit('request', event)
    })

    return this.address
  }

  /** 通过扫码 / Deep Link / 粘贴得到 wc: URI 后配对 */
  async pair(uri: string): Promise<void> {
    if (!this.signClient) throw new Error('WalletNode 尚未初始化')
    await this.signClient.pair({ uri })
    this.emit('log', '已发起配对，等待会话提案')
  }

  async approveProposal(proposal: ProposalTypes.Struct): Promise<void> {
    if (!this.signClient || !this.address) throw new Error('WalletNode 尚未初始化')
    await this.signClient.approve({
      id: proposal.id,
      namespaces: {
        eip155: {
          accounts: CHAINS.map((chain) => `${chain}:${this.address}`),
          methods: METHODS,
          events: EVENTS,
        },
      },
    })
    this.emit('log', '会话已批准')
  }

  async rejectProposal(proposal: ProposalTypes.Struct): Promise<void> {
    if (!this.signClient) throw new Error('WalletNode 尚未初始化')
    await this.signClient.reject({
      id: proposal.id,
      reason: { code: 5000, message: 'User rejected session' },
    })
    this.emit('log', '会话已拒绝')
  }

  /** 用户确认签名请求：本地签名并回传结果 */
  async approveRequest(event: RequestTypes.Event): Promise<void> {
    if (!this.signClient) throw new Error('WalletNode 尚未初始化')
    const { id, topic, params } = event
    const request = params.request

    try {
      if (request.method === 'eth_signTypedData_v4') {
        const [, jsonString] = request.params as [string, string]
        const payload = JSON.parse(jsonString) as TypedDataPayload
        const signature = await signTypedData(payload)
        await this.signClient.respond({
          topic,
          response: { id, jsonrpc: '2.0', result: signature },
        })
        this.emit('log', `已签名并回传：${signature.slice(0, 18)}...`)
        return
      }
      throw new Error(`不支持的方法：${request.method}`)
    } catch (err) {
      await this.signClient.respond({
        topic,
        response: {
          id,
          jsonrpc: '2.0',
          error: { code: 4200, message: err instanceof Error ? err.message : 'Signing failed' },
        },
      })
    }
  }

  async rejectRequest(event: RequestTypes.Event): Promise<void> {
    if (!this.signClient) throw new Error('WalletNode 尚未初始化')
    await this.signClient.respond({
      topic: event.topic,
      response: {
        id: event.id,
        jsonrpc: '2.0',
        error: { code: 5000, message: 'User rejected request' },
      },
    })
    this.emit('log', '签名请求已拒绝')
  }
}
