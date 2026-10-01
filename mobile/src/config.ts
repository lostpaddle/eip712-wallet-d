/**
 * 真机调试注意：手机访问电脑上的 Relay 不能用 localhost，
 * 需填电脑的局域网 IP，例如 ws://192.168.1.10:8787
 * 鸿蒙真机同理，且手机与电脑需在同一局域网。
 */
export const DEFAULT_RELAY_URL = 'ws://192.168.1.100:8787'

export const CHAIN_ID = 1
export const CHAINS = [`eip155:${CHAIN_ID}`]
export const METHODS = ['eth_signTypedData_v4', 'personal_sign']
export const EVENTS: string[] = []

export const WALLET_METHODS = {
  signTypedData: 'eth_signTypedData_v4',
}
