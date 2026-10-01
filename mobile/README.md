# 移动端钱包 App（iOS / Android）

React Native 0.84.1 钱包端。本目录只包含 JS/TS 源码，原生工程按下面步骤生成。

## 1. 创建原生工程并接入源码

```bash
# 在临时位置生成 RN 0.84 工程
npx @react-native-community/cli@latest init Eip712Demo --version 0.84.1

# 用本目录文件覆盖工程根目录（保留其 ios/ android/ 原生目录）
# 然后安装依赖
npm install
```

依赖说明：

| 依赖 | 作用 |
|---|---|
| `@walletconnect/sign-client` | WalletConnect 钱包端（responder） |
| `@walletconnect/react-native-compat` | RN 环境 polyfill 集合 |
| `react-native-get-random-values` | 安全随机数 polyfill |
| `ethers` | 纯 JS secp256k1 + EIP-712 签名 |
| `react-native-keychain` | iOS Keychain / Android Keystore 私钥存储 |

## 2. 真机调试网络配置

- 手机与电脑同一局域网，`src/config.ts` 的 `DEFAULT_RELAY_URL` 改为电脑局域网 IP，
  例如 `ws://192.168.1.100:8787`（不能写 localhost）。
- iOS 还需在 `ios/Eip712Demo/Info.plist` 允许明文 WS（仅调试）：
  ```xml
  <key>NSAppTransportSecurity</key>
  <dict><key>NSAllowsLocalNetworking</key><true/></dict>
  ```
  生产环境 Relay 必须部署 TLS（wss）。

## 3. 注册 Deep Link Scheme（同设备流程）

网页端同设备跳转格式：`eip712demo://wc?uri=<encodeURIComponent(wcUri)>`

- iOS：`Info.plist` 添加 URL Scheme `eip712demo`（CFBundleURLTypes）。
- Android：`AndroidManifest.xml` 主 Activity 添加：
  ```xml
  <intent-filter>
    <action android:name="android.intent.action.VIEW" />
    <category android:name="android.intent.category.DEFAULT" />
    <category android:name="android.intent.category.BROWSABLE" />
    <data android:scheme="eip712demo" android:host="wc" />
  </intent-filter>
  ```

## 4. 运行

```bash
npm start           # Metro
npm run ios         # 或 npm run android
```

## 5. 配对方式

- 跨设备：App 内集成扫码（生产建议接 `react-native-vision-camera`），Demo 可先把网页二维码下方的 URI 复制进 App 输入框。
- 同设备：网页通过 `eip712demo://wc?uri=...` 拉起 App，自动填入 URI。
