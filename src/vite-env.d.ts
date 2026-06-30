/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** 天地图开放平台密钥，用于影像与注记瓦片 */
  readonly VITE_TIANDITU_TOKEN?: string
  /** 业务 API 根地址（对应 yuanquchidu axios baseURL） */
  readonly VITE_API_BASE?: string
  /** 为 true 时 GIS 接口走本地 mock */
  readonly VITE_USE_API_MOCK?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare module 'cesium/Source/Widgets/widgets.css'
