<template>
  <div ref="containerRef" class="map-cesium-host" role="presentation" />
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, shallowRef } from 'vue'
import type { Viewer } from 'cesium'
import { getCesium } from '../cesium-global'

/** 与赣州全局 `Cesium` 用法一致（由入口 `cesium-global` 注入后再取引用） */
const Cesium = getCesium()

type CesiumMod = typeof import('cesium')

const emit = defineEmits<{
  viewerReady: [viewer: Viewer, cesium: CesiumMod]
  /** 场景渲染错误等（见 Scene#renderError）时触发 */
  viewerInitFailed: [error: unknown]
}>()

const containerRef = ref<HTMLElement | null>(null)
const viewerRef = shallowRef<Viewer | null>(null)
let resizeObserver: ResizeObserver | null = null
let removeSceneRenderErrorListener: (() => void) | null = null

const tiandituDataServerUrl = (layer: 'img_w' | 'cia_w', tk: string) => {
  const key = encodeURIComponent(tk)
  return `https://t{s}.tianditu.gov.cn/DataServer?T=${layer}&x={x}&y={y}&l={z}&tk=${key}`
}

/** 关闭默认 UI，自管底图与地形 */
const viewerUiDisabled: Viewer.ConstructorOptions = {
  animation: false,
  timeline: false,
  homeButton: false,
  sceneModePicker: false,
  baseLayerPicker: false,
  navigationHelpButton: false,
  geocoder: false,
  fullscreenButton: false,
  vrButton: false,
  selectionIndicator: false,
  infoBox: false,
  baseLayer: false,
}

const styleMinimalGlobe = (viewer: Viewer, Cesium: CesiumMod) => {
  const blank = Cesium.Color.fromCssColorString('#030a06')
  viewer.scene.backgroundColor = blank
  viewer.scene.globe.show = true
  viewer.scene.globe.baseColor = blank
  viewer.scene.globe.showGroundAtmosphere = false
  viewer.scene.skyBox.show = false
  viewer.scene.sun.show = false
  viewer.scene.moon.show = false
  viewer.scene.skyAtmosphere.show = true
}

const tiandituSubdomains = ['0', '1', '2', '3', '4', '5', '6', '7']

const addTiandituImagery = (viewer: Viewer, Cesium: CesiumMod, tk: string) => {
  const credit = new Cesium.Credit('天地图', false)
  const tilingScheme = new Cesium.WebMercatorTilingScheme()
  const common = {
    subdomains: tiandituSubdomains,
    tilingScheme,
    maximumLevel: 18,
    credit,
  }
  const tiandituLayers: ('img_w' | 'cia_w')[] = ['img_w', 'cia_w']
  for (const layer of tiandituLayers) {
    viewer.imageryLayers.addImageryProvider(
      new Cesium.UrlTemplateImageryProvider({
        url: tiandituDataServerUrl(layer, tk),
        ...common,
      }),
    )
  }
}

/** 仿赣州 `MapContainer.initCesium`：使用入口已注入的全局 `Cesium` */
const initCesium = (el: HTMLElement) => {
  const viewer = new Cesium.Viewer(el, {
    ...viewerUiDisabled,
    showRenderLoopErrors: false,
    terrainProvider: new Cesium.EllipsoidTerrainProvider(),
    contextOptions: { webgl: { alpha: false } },
  })

  removeSceneRenderErrorListener = viewer.scene.renderError.addEventListener((_scene, err) => {
    console.error('[Map] Cesium 场景错误', err)
    emit('viewerInitFailed', err)
  })

  viewer.imageryLayers.removeAll()
  styleMinimalGlobe(viewer, Cesium)

  addTiandituImagery(viewer, Cesium, import.meta.env.VITE_TIANDITU_TOKEN?.trim() ?? '')

  viewer.scene.fog.enabled = true
  viewer.scene.screenSpaceCameraController.minimumZoomDistance = 2000
  viewer.scene.screenSpaceCameraController.maximumZoomDistance = 20000000
  viewerRef.value = viewer

  resizeObserver = new ResizeObserver(() => viewer.resize())
  resizeObserver.observe(el)
  emit('viewerReady', viewer, Cesium)
}

onMounted(() => {
  const el = containerRef.value
  if (!el) return
  initCesium(el)
})

onBeforeUnmount(() => {
  removeSceneRenderErrorListener?.()
  removeSceneRenderErrorListener = null
  resizeObserver?.disconnect()
  resizeObserver = null
  viewerRef.value?.destroy()
  viewerRef.value = null
})
</script>

<style scoped>
.map-cesium-host {
  width: 100%;
  height: 100%;
  min-height: 0;
}

.map-cesium-host :deep(.cesium-viewer-bottom) {
  display: none;
}
</style>
