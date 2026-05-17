<template>
  <div ref="containerRef" class="map-cesium-host" role="presentation" />
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, shallowRef } from 'vue'
import type { Viewer } from 'cesium'
import { getCesium } from '../../cesium-global'
import { addChongqingRegionStyle, presetChongqingViewport } from '../../utils/chongqingMapLayer'

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

const addTiandituImagery = (viewer: Viewer, tk: string) => {
  viewer.imageryLayers.addImageryProvider(
    new Cesium.WebMapTileServiceImageryProvider({
      url:
        `https://t{s}.tianditu.gov.cn/img_w/wmts?service=wmts&request=GetTile&version=1.0.0` +
        `&LAYER=img&tileMatrixSet=w&TileMatrix={TileMatrix}&TileRow={TileRow}&TileCol={TileCol}` +
        `&style=default&format=tiles&tk=${tk}`,
      layer: 'img',
      style: 'default',
      format: 'tiles',
      tileMatrixSetID: 'w',
      subdomains: ['0', '1', '2', '3', '4', '5', '6', '7'],
      tilingScheme: new Cesium.WebMercatorTilingScheme(),
      maximumLevel: 18,
      credit: new Cesium.Credit('天地图', false),
    }),
  )
}

/** 使用入口已注入的全局 `Cesium`（仿赣州 MapContainer.initCesium） */
const initCesium = (el: HTMLElement) => {
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
    console.error('[CesiumMap] Cesium 场景错误', err)
    emit('viewerInitFailed', err)
  })

  presetChongqingViewport(Cesium, viewer)
  viewer.imageryLayers.removeAll()
  styleMinimalGlobe(viewer)

  addTiandituImagery(viewer, import.meta.env.VITE_TIANDITU_TOKEN?.trim() ?? '')

  viewer.scene.fog.enabled = true
  viewer.scene.screenSpaceCameraController.minimumZoomDistance = 2000
  viewer.scene.screenSpaceCameraController.maximumZoomDistance = 20000000
  viewerRef.value = viewer

  resizeObserver = new ResizeObserver(() => viewer.resize())
  resizeObserver.observe(el)
  emit('viewerReady', viewer, Cesium)

  addChongqingRegionStyle(Cesium, viewer)
}

onMounted(() => {
  const el = containerRef.value
  if (!el) return
  initCesium(el)
})

onBeforeUnmount(() => {
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
