# 鸿蒙 HarmonyOS NEXT 接入（RNOH 0.84）

基于 **RNOH（React Native for OpenHarmony）0.84.x**，与 RN 0.84.1 对齐，React 19.2.3。

## 1. 环境要求

| 工具 | 版本 |
|---|---|
| DevEco Studio | 5.0+ |
| HarmonyOS SDK | API 17+ |
| RNOH | 0.84.x（长期维护线：0.72 / 0.77 / 0.82 / 0.84） |

仓库与环境搭建：

- Gitee 主仓：https://gitee.com/openharmony-sig/ohos_react_native
- 按仓库文档「环境搭建」完成 DevEco 工程模板接入，把本 `mobile/` 的 JS 源码作为 Bundle 源。

## 2. 平台文件替换

鸿蒙构建时用 `src/wallet/keyStore.harmony.ts` 替换 `keyStore.ts`：

- 方式一（推荐）：在 RNOH 构建脚本中按平台解析 `.harmony.ts` 扩展（参考 RNOH 文档的平台扩展章节）。
- 方式二：直接用 `keyStore.harmony.ts` 内容覆盖 `keyStore.ts`，其余源码不变。

签名算法仍是 ethers 的纯 JS secp256k1；HUKS 只负责 AES 加密保管私钥。

## 3. HUKS TurboModule（ArkTS）

在 RNOH 鸿蒙工程中新建 TurboModule `HuksStore`（以 RNOH 0.84 的 TurboModule 模板为骨架）：

```ts
// HuksStore.ets
import { TurboModule } from '@rnoh/react-native-openharmony/ts'
import huks from '@ohos.security.huks'
import { preferences } from '@kit.ArkData'
import { cryptoFramework } from '@kit.CryptoArchitectureKit'
import { util } from '@kit.ArkTS'
import { common } from '@kit.AbilityKit'

const KEY_ALIAS = 'eip712_demo_aes'
const STORE = 'eip712_demo_store'
const CIPHER_FIELD = 'wallet_ciphertext'

const BASE_PROPS = [
  { tag: huks.HuksTag.HUKS_TAG_ALGORITHM, value: huks.HuksKeyAlg.HUKS_ALG_AES },
  { tag: huks.HuksTag.HUKS_TAG_KEY_SIZE, value: huks.HuksKeySize.HUKS_AES_KEY_SIZE_256 },
  { tag: huks.HuksTag.HUKS_TAG_BLOCK_MODE, value: huks.HuksCipherMode.HUKS_MODE_GCM },
  { tag: huks.HuksTag.HUKS_TAG_PADDING, value: huks.HuksKeyPadding.HUKS_PADDING_NONE },
]

export class HuksStore extends TurboModule {
  private ctx?: common.UIAbilityContext

  __onContextCreate(ctx: common.UIAbilityContext) { this.ctx = ctx }

  private async ensureKey() {
    try { await huks.deleteKeyItem(KEY_ALIAS) } catch {}
    await huks.generateKeyItem(KEY_ALIAS, {
      properties: [
        ...BASE_PROPS,
        { tag: huks.HuksTag.HUKS_TAG_PURPOSE,
          value: huks.HuksKeyPurpose.HUKS_KEY_PURPOSE_ENCRYPT | huks.HuksKeyPurpose.HUKS_KEY_PURPOSE_DECRYPT },
      ],
    })
  }

  private async storeCipher(text: string) {
    const prefs = await preferences.getPreferences(this.ctx!, STORE)
    await prefs.put(CIPHER_FIELD, text)
    await prefs.flush()
  }

  private async loadCipher(): Promise<string | null> {
    const prefs = await preferences.getPreferences(this.ctx!, STORE)
    return (await prefs.get(CIPHER_FIELD, '')) as string || null
  }

  async saveSecret(_alias: string, plaintext: string): Promise<boolean> {
    await this.ensureKey()
    const nonce = cryptoFramework.createRandom().generateRandomSync(12).data
    const inData = new util.TextEncoder().encodeInto(plaintext)

    const handle = await huks.initSession(KEY_ALIAS, {
      properties: [...BASE_PROPS, { tag: huks.HuksTag.HUKS_TAG_NONCE, value: nonce }],
      inData,
    })
    await huks.updateSession(handle, { properties: BASE_PROPS, inData })
    const finish = await huks.finishSession(handle, { properties: BASE_PROPS, inData: new Uint8Array(0) })

    const b64 = (u: Uint8Array) => util.Base64Helper.createToStringSync(u)
    await this.storeCipher(`${b64(nonce)}.${b64(finish.outData as Uint8Array)}`)
    return true
  }

  async loadSecret(_alias: string): Promise<string | null> {
    const packed = await this.loadCipher()
    if (!packed) return null
    const [nonceB64, cipherB64] = packed.split('.')
    const b64 = new util.Base64Helper()
    const nonce = b64.decodeSync(nonceB64)
    const cipher = b64.decodeSync(cipherB64)

    const handle = await huks.initSession(KEY_ALIAS, {
      properties: [...BASE_PROPS, { tag: huks.HuksTag.HUKS_TAG_NONCE, value: nonce }],
      inData: cipher,
    })
    await huks.updateSession(handle, { properties: BASE_PROPS, inData: cipher })
    const finish = await huks.finishSession(handle, { properties: BASE_PROPS, inData: new Uint8Array(0) })
    return new util.TextDecoder().decodeToString(finish.outData as Uint8Array)
  }

  async removeSecret(_alias: string): Promise<boolean> {
    const prefs = await preferences.getPreferences(this.ctx!, STORE)
    await prefs.delete(CIPHER_FIELD)
    await prefs.flush()
    return true
  }
}
```

按 RNOH TurboModule 注册流程在 `TurboModuleProvider` 中登记 `HuksStore`，
JS 侧 `NativeModules.HuksStore` 即可调用。

## 4. Deep Link（同设备）

鸿蒙在 module.json5 配置 skills（URI Scheme）：

```json
"skills": [
  {
    "actions": ["ohos.want.action.viewData"],
    "uris": [{ "scheme": "eip712demo", "host": "wc" }]
  }
]
```

在 EntryAbility 的 `onNewWant` / `onCreate` 中解析 `want.uri`，取出 `uri` 参数传给 JS 侧
（通过 RNOH 的初始参数或事件桥），App.tsx 已支持收到 URI 自动配对。

## 5. 网络

- 真机与 Relay 同一局域网，Relay URL 填电脑 IP。
- 生产环境 Relay 使用 wss，并在 module.json5 声明 `ohos.permission.INTERNET`。

## 6. 兼容性待实测项

- `@walletconnect/react-native-compat` 的 polyfill 在 RNOH Hermes 容器下的行为（大部分为纯 JS）。
- `react-native-get-random-values` 在 RNOH 下的适配（如缺失，可用 cryptoFramework 的随机数自行注入 globalThis.crypto）。
