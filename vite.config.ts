import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import cesium from 'vite-plugin-cesium'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// https://vite.dev/config/
export default defineConfig({
  server: {
    open: false,
    proxy: {
      '/tianditu-proxy': {
        target: 'https://t0.tianditu.gov.cn',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/tianditu-proxy/, ''),
      },
    },
  },
  preview: {
    open: false,
  },
  resolve: {
    alias: {
      // Cesium 1.129 仍引用 zip-no-worker；@zip.js/zip.js 2.8+ 已移除该导出，预构建会失败
      '@zip.js/zip.js/lib/zip-no-worker.js': path.resolve(
        __dirname,
        'node_modules/@zip.js/zip.js/lib/zip-fs-wasm.js',
      ),
    },
  },
  plugins: [
    vue(),
    cesium(),
    AutoImport({
      resolvers: [ElementPlusResolver({ importStyle: 'css' })],
      dts: 'src/auto-imports.d.ts',
    }),
    Components({
      resolvers: [ElementPlusResolver({ importStyle: 'css' })],
      dts: 'src/components.d.ts',
    }),
  ],
})
