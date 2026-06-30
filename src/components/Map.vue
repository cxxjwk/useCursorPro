<template>
  <div ref="containerRef" class="map-cesium-host" role="presentation" />
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import type { Viewer } from 'cesium'
import { getCesium } from '../cesium-global'

const Cesium = getCesium()

type CesiumMod = typeof import('cesium')

const emit = defineEmits<{
  viewerReady: [viewer: Viewer, cesium: CesiumMod]
  viewerInitFailed: [error: unknown]
}>()

// ---------- 模块状态 ----------
const containerRef = ref<HTMLElement | null>(null)
const viewerRef = ref<Viewer | null>(null)
let resizeObserver: ResizeObserver | null = null

// ---------- 1. 初始化地图（底图 → viewer-ready）----------
/** 深色极简地球样式 */
const styleMinimalGlobe = (viewer: Viewer) => {
  viewer.scene.backgroundColor = Cesium.Color.fromCssColorString('#030a06')
  viewer.scene.globe.show = true
  viewer.scene.globe.baseColor = viewer.scene.backgroundColor
  viewer.scene.globe.showGroundAtmosphere = false
  viewer.scene.skyBox.show = false
  viewer.scene.sun.show = false
  viewer.scene.moon.show = false
  viewer.scene.skyAtmosphere.show = true
}

/** 叠加天地图影像（dev 走 Vite 代理，避免 localhost CORS） */
const addTiandituImagery = (viewer: Viewer) => {
  const tk = import.meta.env.VITE_TIANDITU_TOKEN?.trim() ?? ''
  const isDev = import.meta.env.DEV
  viewer.imageryLayers.addImageryProvider(
    new Cesium.UrlTemplateImageryProvider({
      url: isDev
        ? `/tianditu-proxy/DataServer?T=img_w&x={x}&y={y}&l={z}&tk=${tk}`
        : `https://t{s}.tianditu.gov.cn/DataServer?T=img_w&x={x}&y={y}&l={z}&tk=${tk}`,
      subdomains: isDev ? undefined : ['0', '1', '2', '3', '4', '5', '6', '7'],
      tilingScheme: new Cesium.WebMercatorTilingScheme(),
      maximumLevel: 18,
      credit: new Cesium.Credit('天地图', false),
    }),
  )
}

/** 创建 Viewer 并加载天地图影像（读模块级 containerRef） */
const initCesium = () => {
  const el = containerRef.value as HTMLElement
  const viewer = new Cesium.Viewer(el, {
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
    showRenderLoopErrors: false,
    terrainProvider: new Cesium.EllipsoidTerrainProvider(),
    contextOptions: { webgl: { alpha: false } },
  })

  viewer.scene.renderError.addEventListener((_scene, err) => {
    console.error('[Map] Cesium 场景错误', err)
    emit('viewerInitFailed', err)
  })

  viewerRef.value = viewer
  viewer.imageryLayers.removeAll()
  styleMinimalGlobe(viewer)
  addTiandituImagery(viewer)

  viewer.scene.fog.enabled = true
  viewer.scene.screenSpaceCameraController.minimumZoomDistance = 2000
  viewer.scene.screenSpaceCameraController.maximumZoomDistance = 20000000

  resizeObserver = new ResizeObserver(() => viewerRef.value?.resize())
  resizeObserver.observe(el)
  emit('viewerReady', viewer, Cesium)
}

// ---------- 生命周期 ----------
onMounted(() => {
  initCesium()
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  resizeObserver = null
  viewerRef.value?.destroy()
  viewerRef.value = null
})
</script>

<style scoped lang="scss">
.map-cesium-host {
  width: 100%;
  height: 100%;
  min-height: 0;

  :deep(.cesium-viewer-bottom) {
    display: none;
  }
}
</style>
