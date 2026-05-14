/**
 * 与赣州等项目一致：启动时加载 Cesium 与 widgets 样式，并挂到 `globalThis.Cesium`。
 * 在 `.vue` 中请 `import { getCesium } from '…/cesium-global'` 后 `const Cesium = getCesium()`，写法与全局脚本一致且通过 vue-tsc。
 */
import 'cesium/Source/Widgets/widgets.css'
import * as CesiumModule from 'cesium'

const holder = globalThis as unknown as { Cesium: typeof import('cesium') }
holder.Cesium = CesiumModule

export function getCesium(): typeof import('cesium') {
  return holder.Cesium
}
