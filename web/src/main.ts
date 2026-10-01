import SignClient from '@walletconnect/sign-client'
import QRCode from 'qrcode'
import type { TypedData } from './types'

const API_BASE = 'http://localhost:3000'

const state: {
  signClient?: InstanceType<typeof SignClient>
  sessionTopic?: string
  address?: string
  requestId?: string
  typedData?: TypedData
} = {}

const $ = (id: string) => document.getElementById(id)!
const log = (msg: string) => {
  const el = $('log')
  el.textContent += `${new Date().toLocaleTimeString()}  ${msg}\n`
  el.scrollTop = el.scrollHeight
}

async function initClient() {
  const relayUrl = ($('relayUrl') as HTMLInputElement).value.trim()
  state.signClient = await SignClient.init({
    projectId: 'selfhosted-demo', // 自建 Relay 不校验；用官方 Relay 时填真实 Project ID
    relayUrl,
  })
  log(`已连接 Relay：${relayUrl}`)
  ;($('connectBtn') as HTMLButtonElement).disabled = false
}

async function connect() {
  const signClient = state.signClient!
  const { uri, approval } = await signClient.connect({
    requiredNamespaces: {
      eip155: {
        methods: ['eth_signTypedData_v4', 'personal_sign'],
        chains: ['eip155:1'],
        events: [],
      },
    },
  })

  if (uri) {
    await QRCode.toCanvas($('qr') as HTMLCanvasElement, uri, { width: 240 })
    $('uri').textContent = uri
    log('配对 URI 已生成，请用手机 App 扫码（或复制 URI）')
  }

  const session = await approval()
  state.sessionTopic = session.topic
  state.address = session.namespaces.eip155.accounts[0].split(':')[2]
  log(`钱包已连接：${state.address}`)
  ;($('signBtn') as HTMLButtonElement).disabled = false
}

async function requestSignature() {
  const signClient = state.signClient!
  const address = state.address!

  // 1. 从后端获取一次性 EIP-712 载荷
  const res = await fetch(`${API_BASE}/api/typed-data?address=${address}`)
  if (!res.ok) throw new Error(await res.text())
  const body = await res.json()
  state.requestId = body.requestId
  state.typedData = body.typedData as TypedData
  log(`已获取待签载荷 requestId=${state.requestId}`)

  // 2. 通过 Relay 向手机钱包发起 EIP-712 签名
  const signature = (await signClient.request({
    topic: state.sessionTopic!,
    chainId: 'eip155:1',
    request: {
      method: 'eth_signTypedData_v4',
      params: [
        address,
        JSON.stringify({
          domain: state.typedData.domain,
          types: state.typedData.types,
          primaryType: state.typedData.primaryType,
          message: state.typedData.message,
        }),
      ],
    },
  })) as string
  log(`收到签名：${signature.slice(0, 20)}...`)

  // 3. 上送后端验签
  const verifyRes = await fetch(`${API_BASE}/api/verify`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ requestId: state.requestId, address, signature }),
  })
  const verifyBody = await verifyRes.json()
  log(verifyRes.ok ? `验签通过：${JSON.stringify(verifyBody)}` : `验签失败：${JSON.stringify(verifyBody)}`)
}

$('initBtn').addEventListener('click', () => initClient().catch((e) => log(`初始化失败：${e.message}`)))
$('connectBtn').addEventListener('click', () => connect().catch((e) => log(`连接失败：${e.message}`)))
$('signBtn').addEventListener('click', () => requestSignature().catch((e) => log(`签名流程失败：${e.message}`)))
