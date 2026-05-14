/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** 天地图开放平台密钥，用于影像与注记瓦片 */
  readonly VITE_TIANDITU_TOKEN?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare module 'cesium/Source/Widgets/widgets.css'
