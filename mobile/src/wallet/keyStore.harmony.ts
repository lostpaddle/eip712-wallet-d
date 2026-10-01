/**
 * 鸿蒙（HarmonyOS NEXT / RNOH）私钥存储
 *
 * 鸿蒙 HUKS 不支持 secp256k1，因此签名计算仍由 ethers（纯 JS）完成；
 * HUKS 在这里用于生成 AES 主密钥，加密保管 secp256k1 私钥 blob。
 *
 * 本文件依赖一个 RNOH TurboModule：NativeHuksStore（ArkTS 实现见
 * mobile/harmony/README.md）。iOS/Android 构建时不会引用本文件。
 */
import { NativeModules } from 'react-native'

const HuksModule: {
  saveSecret(alias: string, plaintext: string): Promise<boolean>
  loadSecret(alias: string): Promise<string | null>
  removeSecret(alias: string): Promise<boolean>
} = NativeModules.HuksStore as never

const ALIAS = 'eip712_demo_wallet_key'

export async function savePrivateKey(privateKey: string): Promise<void> {
  if (!HuksModule) throw new Error('鸿蒙 HUKS 原生模块未注册，请按 harmony/README.md 接入')
  await HuksModule.saveSecret(ALIAS, privateKey)
}

export async function loadPrivateKey(): Promise<string | null> {
  if (!HuksModule) throw new Error('鸿蒙 HUKS 原生模块未注册，请按 harmony/README.md 接入')
  return HuksModule.loadSecret(ALIAS)
}

export async function clearPrivateKey(): Promise<void> {
  if (!HuksModule) throw new Error('鸿蒙 HUKS 原生模块未注册，请按 harmony/README.md 接入')
  await HuksModule.removeSecret(ALIAS)
}
