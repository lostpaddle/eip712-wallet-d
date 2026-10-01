/**
 * iOS / Android 私钥存储：react-native-keychain
 * 私钥以系统安全区（Keychain / Keystore）加密保管，App 内不留下明文文件。
 *
 * 鸿蒙平台请使用 keyStore.harmony.ts（HUKS），见 mobile/harmony/README.md。
 */
import * as Keychain from 'react-native-keychain'

const SERVICE = 'eip712-demo-wallet'

export async function savePrivateKey(privateKey: string): Promise<void> {
  await Keychain.setGenericPassword('wallet', privateKey, {
    service: SERVICE,
    accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  })
}

export async function loadPrivateKey(): Promise<string | null> {
  const credentials = await Keychain.getGenericPassword({ service: SERVICE })
  if (credentials && typeof credentials.password === 'string') {
    return credentials.password
  }
  return null
}

export async function clearPrivateKey(): Promise<void> {
  await Keychain.resetGenericPassword({ service: SERVICE })
}
