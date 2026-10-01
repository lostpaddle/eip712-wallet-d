import React, { useEffect, useRef, useState } from 'react'
import {
  Alert,
  Linking,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import type { ProposalTypes, RequestTypes } from '@walletconnect/types'
import { WalletNode } from './src/wc/WalletNode'
import { DEFAULT_RELAY_URL } from './src/config'

const DEEP_LINK_SCHEME = 'eip712demo://'

function App(): React.JSX.Element {
  const nodeRef = useRef<WalletNode>(new WalletNode())
  const [relayUrl, setRelayUrl] = useState(DEFAULT_RELAY_URL)
  const [pairUri, setPairUri] = useState('')
  const [address, setAddress] = useState('')
  const [ready, setReady] = useState(false)
  const [logs, setLogs] = useState<string[]>([])

  const appendLog = (msg: string) =>
    setLogs((prev) => [...prev, `${new Date().toLocaleTimeString()}  ${msg}`])

  useEffect(() => {
    const node = nodeRef.current
    const offProposal = node.on('proposal', (p) => {
      const proposal = p as ProposalTypes.Struct
      appendLog('收到会话提案')
      Alert.alert('会话连接请求', `DApp：${proposal.params.proposer.metadata.name}`, [
        { text: '拒绝', style: 'cancel', onPress: () => void node.rejectProposal(proposal) },
        { text: '批准', onPress: () => void node.approveProposal(proposal) },
      ])
    })
    const offRequest = node.on('request', (p) => {
      const event = p as RequestTypes.Event
      const request = event.params.request
      let description = request.method
      if (request.method === 'eth_signTypedData_v4') {
        try {
          const message = JSON.parse(request.params[1]).message
          description = JSON.stringify(message, null, 2)
        } catch {
          /* ignore */
        }
      }
      appendLog(`收到签名请求：${request.method}`)
      Alert.alert('签名请求（EIP-712）', description, [
        { text: '拒绝', style: 'cancel', onPress: () => void node.rejectRequest(event) },
        { text: '确认签名', onPress: () => void node.approveRequest(event) },
      ])
    })
    const offLog = node.on('log', (p) => appendLog(String(p)))

    // Deep Link：eip712demo://wc?uri=<encodeURIComponent(wc uri)>
    const handleDeepLink = (url: string | null) => {
      if (!url || !url.startsWith(DEEP_LINK_SCHEME)) return
      const query = url.slice(DEEP_LINK_SCHEME.length)
      const params = new URLSearchParams(query.split('?')[1] ?? '')
      const uri = params.get('uri')
      if (uri) {
        setPairUri(uri)
        appendLog('通过 Deep Link 获得配对 URI')
      }
    }
    void Linking.getInitialURL().then(handleDeepLink)
    const linkingSub = Linking.addEventListener('url', ({ url }) => handleDeepLink(url))

    return () => {
      offProposal()
      offRequest()
      offLog()
      linkingSub.remove()
    }
  }, [])

  const init = async () => {
    try {
      const addr = await nodeRef.current.init(relayUrl)
      setAddress(addr)
      setReady(true)
      appendLog(`钱包就绪：${addr}`)
    } catch (e) {
      appendLog(`初始化失败：${(e as Error).message}`)
    }
  }

  const pair = async () => {
    try {
      await nodeRef.current.pair(pairUri.trim())
    } catch (e) {
      appendLog(`配对失败：${(e as Error).message}`)
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>EIP-712 手机钱包 Demo</Text>

        <Text style={styles.label}>Relay 地址（真机填电脑局域网 IP）</Text>
        <TextInput
          style={styles.input}
          value={relayUrl}
          onChangeText={setRelayUrl}
          autoCapitalize="none"
        />
        <TouchableOpacity style={styles.button} onPress={() => void init()}>
          <Text style={styles.buttonText}>初始化钱包</Text>
        </TouchableOpacity>

        {address ? (
          <Text style={styles.address}>地址：{address}</Text>
        ) : null}

        <Text style={styles.label}>WalletConnect URI（扫码结果 / 粘贴 / Deep Link）</Text>
        <TextInput
          style={[styles.input, styles.uriInput]}
          value={pairUri}
          onChangeText={setPairUri}
          autoCapitalize="none"
          multiline
          editable={ready}
        />
        <TouchableOpacity style={[styles.button, !ready && styles.disabled]} onPress={() => void pair()} disabled={!ready}>
          <Text style={styles.buttonText}>配对</Text>
        </TouchableOpacity>

        <Text style={styles.label}>流程日志</Text>
        <View style={styles.logBox}>
          {logs.map((line, i) => (
            <Text key={i} style={styles.logLine}>
              {line}
            </Text>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  content: { padding: 20 },
  title: { fontSize: 20, fontWeight: '700', marginBottom: 16 },
  label: { fontSize: 13, color: '#374151', marginTop: 12, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: '#9ca3af',
    borderRadius: 8,
    padding: 10,
    backgroundColor: '#fff',
    fontSize: 13,
  },
  uriInput: { minHeight: 72 },
  button: {
    backgroundColor: '#111827',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  disabled: { opacity: 0.4 },
  buttonText: { color: '#fff', fontWeight: '600' },
  address: { marginTop: 12, fontSize: 12, color: '#1d4ed8' },
  logBox: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    padding: 10,
    marginTop: 6,
  },
  logLine: { fontSize: 12, marginBottom: 4, color: '#1f2937' },
})

export default App
