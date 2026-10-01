/**
 * 入口：polyfill 必须在加载 WalletConnect SDK 之前引入
 */
import 'react-native-get-random-values'
import '@walletconnect/react-native-compat'

import { AppRegistry } from 'react-native'
import App from './App'
import { name as appName } from './app.json'

AppRegistry.registerComponent(appName, () => App)
