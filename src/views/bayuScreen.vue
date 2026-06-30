<template>
  <div class="bayu-screen" aria-label="巴渝治水大屏">
    <header class="bayu-screen__head">
      <h1 class="bayu-screen__title">巴渝治水 · 突发事故</h1>
      <p class="bayu-screen__sub">天地图影像 + 重庆区域 + 监测点位（绿/黄呼吸/红波纹/蓝水波）</p>
    </header>
    <div class="bayu-screen__map">
      <CesiumMap @viewer-ready="onViewerReady" @region-ready="onRegionReady" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue'
import type { CustomDataSource, Entity, Viewer } from 'cesium'
import CesiumMap from '../components/common/CesiumMap.vue'
import { getPointsListByType } from '../api/main'
import type { GisPointRecord } from '../api/main/types'
import { getChongqingReliefTopHeight } from '../utils/chongqingMapLayer'

type CesiumMod = typeof import('cesium')

// ---------- 模块状态 ----------
const viewerRef = ref<Viewer | null>(null)
let cesiumMod: CesiumMod | null = null
let pointAnimFrameId = 0
/** 监测点专用图层（叠在重庆 entities 之上） */
let gisPointLayer: CustomDataSource | null = null
/** 接口返回的监测点列表 */
let gisPointList: GisPointRecord[] = []
/** 当前正在绘制的那一条监测点 */
let gisPoint: GisPointRecord | null = null

// ---------- 点位样式常量 ----------
const NORMAL_COLOR = '#22c55e'
const WARNING_COLOR = '#ffea00'
/** 预警外扩环（较深黄） */
const WARNING_RING_COLOR = '#e6b800'
/** 报警点与外扩环（不透明贴图描边，避免与地图底色 Alpha 混色发暗） */
const ALARM_COLOR = '#ff1a1a'
/** 水波纹（status 4，与提供的 demo 一致：固定透明度环 + CallbackProperty 半径） */
const WATER_WAVE_COLOR = '#3ba0ff'
const WATER_WAVE_FAST_COLOR = '#6ec8ff'
const WATER_WAVE_CENTER_COLOR = '#ffdd88'
const WATER_RING_COUNT = 8
/** demo 街道级约 220m；市域俯视须放大才能在浮雕顶面上看见 */
const WATER_MAX_RADIUS_M = 12000
const WATER_FAST_MAX_RADIUS_M = 13000
const WATER_PERIOD_MS = 2500
const WATER_FAST_PERIOD_MS = 1600
/**
 * 点位高度：须高于 chongqingMapLayer 飞地压暗层（relief.top + 500），
 * 否则会被「重庆-飞地压暗」实体盖住。
 */
const POINT_ABOVE_RELIEF_M = 3200

let alarmRippleRingImageUrl: string | undefined
let warningBreathOuterImageUrl: string | undefined
let warningBreathInnerImageUrl: string | undefined
let warningCenterDotImageUrl: string | undefined

// ---------- 1. 地图初始化（CesiumMap viewer-ready）----------
/** CesiumMap 初始化完成：保存 viewer / Cesium（时钟由 CesiumMap.initCesium 配置） */
const onViewerReady = (viewer: Viewer, cesium: CesiumMod) => {
  viewerRef.value = viewer
  cesiumMod = cesium
}

// ---------- 2. 区域就绪后：监测点图层与绘制（region-ready 后拉数）----------
/** 确保监测点 dataSource 已挂到 viewer（仅在 region-ready 后创建，add 即在 dataSources 末尾） */
const ensureGisPointLayer = () => {
  const viewer = viewerRef.value
  const Cesium = cesiumMod
  if (viewer && Cesium) {
    if (gisPointLayer == null || viewer.dataSources.contains(gisPointLayer) === false) {
      gisPointLayer = new Cesium.CustomDataSource('gis-points')
      viewer.dataSources.add(gisPointLayer)
    }
  }
}

/** 不透明空心圆环贴图（报警外扩环） */
const createOpaqueRingImageUrl = (fillCss: string) => {
  const size = 128
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (ctx) {
    const cx = size / 2
    const cy = size / 2
    const outer = size / 2 - 1
    const inner = outer - 9
    ctx.clearRect(0, 0, size, size)
    ctx.fillStyle = fillCss
    ctx.beginPath()
    ctx.arc(cx, cy, outer, 0, Math.PI * 2)
    ctx.arc(cx, cy, inner, 0, Math.PI * 2, true)
    ctx.fill('evenodd')
    return canvas.toDataURL()
  }
  return ''
}

/** 预警内层：贴图 RGBA 淡黄柔光（billboard.color 保持不透明白，勿再叠 withAlpha） */
const createWarningInnerGlowUrl = () => {
  const size = 128
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (ctx) {
    const cx = size / 2
    const cy = size / 2
    const radius = size / 2 - 1
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius)
    grad.addColorStop(0, 'rgba(255, 245, 200, 1)')
    grad.addColorStop(0.5, 'rgba(255, 242, 195, 0.54)')
    grad.addColorStop(1, 'rgba(255, 238, 188, 0.3)')
    ctx.beginPath()
    ctx.arc(cx, cy, radius, 0, Math.PI * 2)
    ctx.closePath()
    ctx.fillStyle = grad
    ctx.fill()
    return canvas.toDataURL()
  }
  return ''
}

/** 报警外扩环贴图（懒加载缓存） */
const getAlarmRippleRingImageUrl = () => {
  if (alarmRippleRingImageUrl) return alarmRippleRingImageUrl
  alarmRippleRingImageUrl = createOpaqueRingImageUrl(ALARM_COLOR)
  return alarmRippleRingImageUrl
}

/** 预警外圈贴图（懒加载缓存） */
const getWarningBreathOuterImageUrl = () => {
  if (warningBreathOuterImageUrl) return warningBreathOuterImageUrl
  warningBreathOuterImageUrl = createOpaqueRingImageUrl(WARNING_RING_COLOR)
  return warningBreathOuterImageUrl
}

/** 预警内层柔光贴图（懒加载缓存） */
const getWarningBreathInnerImageUrl = () => {
  if (warningBreathInnerImageUrl) return warningBreathInnerImageUrl
  warningBreathInnerImageUrl = createWarningInnerGlowUrl()
  return warningBreathInnerImageUrl
}

/** 预警中心黄点贴图（懒加载缓存） */
const getWarningCenterDotImageUrl = () => {
  if (warningCenterDotImageUrl) return warningCenterDotImageUrl
  const size = 32
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (ctx) {
    ctx.clearRect(0, 0, size, size)
    ctx.fillStyle = WARNING_COLOR
    ctx.beginPath()
    ctx.arc(size / 2, size / 2, size / 2 - 2, 0, Math.PI * 2)
    ctx.fill()
    warningCenterDotImageUrl = canvas.toDataURL()
    return warningCenterDotImageUrl
  }
  return ''
}

/** 监测点笛卡尔高度（高于重庆飞地压暗层） */
const pointHeightAboveRelief = () => getChongqingReliefTopHeight() + POINT_ABOVE_RELIEF_M

/** 点位名称标签样式（读模块级 gisPoint） */
const pointLabel = (fillCss: string, pixelOffsetY: number) => {
  const rec = gisPoint
  const Cesium = cesiumMod
  if (rec && Cesium) {
    return {
      text: rec.pointSimpleName,
      font: 'bold 15px "Microsoft YaHei", "PingFang SC", sans-serif',
      fillColor: Cesium.Color.fromCssColorString(fillCss),
      outlineColor: Cesium.Color.BLACK,
      outlineWidth: 3,
      style: Cesium.LabelStyle.FILL_AND_OUTLINE,
      showBackground: true,
      backgroundColor: Cesium.Color.fromCssColorString('#0b1220').withAlpha(0.88),
      backgroundPadding: new Cesium.Cartesian2(10, 6),
      verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
      horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
      pixelOffset: new Cesium.Cartesian2(0, pixelOffsetY),
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
      scaleByDistance: new Cesium.NearFarScalar(2e5, 1.45, 2.5e6, 1.05),
    }
  }
}

/** 当前 gisPoint 经纬度转 Cesium 坐标（监测点实体高度） */
const positionOf = () => {
  const rec = gisPoint
  const Cesium = cesiumMod
  if (rec && Cesium) {
    return Cesium.Cartesian3.fromDegrees(
      Number(rec.longitude),
      Number(rec.latitude),
      pointHeightAboveRelief(),
    )
  }
}

/** 水波纹环锚点：重庆经纬度，高度在浮雕顶面（贴地 0 会被重庆挤出体盖住） */
const waterWaveCenterOf = () => {
  const rec = gisPoint
  const Cesium = cesiumMod
  if (rec && Cesium) {
    return Cesium.Cartesian3.fromDegrees(
      Number(rec.longitude),
      Number(rec.latitude),
      getChongqingReliefTopHeight() + 2,
    )
  }
}

/** 实心点 entity 公共样式 */
const pointCommon = () => {
  if (cesiumMod) {
    return {
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
      scaleByDistance: new cesiumMod.NearFarScalar(2e5, 1.85, 2.5e6, 1.15),
      outlineWidth: 0,
      outlineColor: cesiumMod.Color.TRANSPARENT,
    }
  }
}

/** 点位 Billboard 公共项：不透明贴图 + 不参与深度测试 */
const pointBillboardCommon = () => {
  if (cesiumMod) {
    return {
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
      scaleByDistance: new cesiumMod.NearFarScalar(2e5, 1.85, 2.5e6, 1.15),
      verticalOrigin: cesiumMod.VerticalOrigin.CENTER,
      horizontalOrigin: cesiumMod.HorizontalOrigin.CENTER,
    }
  }
}

/** 报警外扩环周期与尺寸（绘制时登记 rippleAnims，动画在段 3 更新） */
const PULSE_PERIOD = 2.8
const PULSE_RIPPLE_COUNT = 3
const RIPPLE_PX_MIN = 16
const RIPPLE_PX_MAX = 118

type RippleAnim = { entity: Entity; phase: number }
type BreathAnim = { entity: Entity; minPx: number; maxPx: number }
type WaterRingAnim = {
  entity: Entity
  startTime: number
  /** true 时半径线性增至 max（demo 快环） */
  linear?: boolean
}

/** 报警外扩圆环实体，每帧在 updatePointAnimations 中更新 */
const rippleAnims: RippleAnim[] = []
/** 预警呼吸光晕实体，每帧在 updatePointAnimations 中更新 */
const breathAnims: BreathAnim[] = []
/** 水波纹椭圆环，每帧在 updatePointAnimations 中更新（避免 CallbackProperty 拖死主线程） */
const waterRingAnims: WaterRingAnim[] = []

/** 正常及其它未知 status：绿色实心点 + 标签（status 1 等） */
const addNormalGisPoint = () => {
  const rec = gisPoint
  const Cesium = cesiumMod
  const layer = gisPointLayer
  if (rec && Cesium && layer) {
    const entities = layer.entities
    const id = `gis-point-${rec.pointCode}`
    entities.add({
      id,
      name: id,
      position: positionOf(),
      point: {
        pixelSize: 16,
        color: Cesium.Color.fromCssColorString(NORMAL_COLOR),
        ...pointCommon(),
      },
      label: pointLabel('#ecfdf5', -22),
    })
  }
}

/** 预警：外圈 → 内层柔光 → 中心点（status 3） */
const addWarningGisPoint = () => {
  const rec = gisPoint
  const Cesium = cesiumMod
  const layer = gisPointLayer
  if (rec && Cesium && layer) {
    const entities = layer.entities
    const position = positionOf()
    const id = `gis-point-${rec.pointCode}`
    const code = rec.pointCode
    const bbCommon = pointBillboardCommon()
    const addBreath = (name: string, image: string, minPx: number, maxPx: number) => {
      const entity = entities.add({
        name,
        position,
        billboard: { image, width: minPx, height: minPx, color: Cesium.Color.WHITE, ...bbCommon },
      })
      breathAnims.push({ entity, minPx, maxPx })
    }

    addBreath(`gis-point-breath-outer-${code}`, getWarningBreathOuterImageUrl(), 28, 52)
    addBreath(`gis-point-breath-inner-${code}`, getWarningBreathInnerImageUrl(), 22, 40)

    entities.add({
      id,
      name: id,
      position,
      billboard: {
        image: getWarningCenterDotImageUrl(),
        width: 15,
        height: 15,
        color: Cesium.Color.WHITE,
        ...bbCommon,
      },
      label: pointLabel(WARNING_COLOR, -34),
    })
  }
}

/** 报警：三道错峰外扩环 + 中心实心红点（status 2） */
const addAlarmGisPoint = () => {
  const rec = gisPoint
  const Cesium = cesiumMod
  const layer = gisPointLayer
  if (rec && Cesium && layer) {
    const entities = layer.entities
    const position = positionOf()
    const id = `gis-point-${rec.pointCode}`
    const bbCommon = pointBillboardCommon()
    const rippleImage = getAlarmRippleRingImageUrl()
    const phaseStep = PULSE_PERIOD / PULSE_RIPPLE_COUNT

    for (let i = 0; i < PULSE_RIPPLE_COUNT; i++) {
      const entity = entities.add({
        name: `gis-point-ripple-${rec.pointCode}-${i}`,
        position,
        billboard: {
          image: rippleImage,
          width: RIPPLE_PX_MIN,
          height: RIPPLE_PX_MIN,
          color: Cesium.Color.WHITE,
          show: false,
          ...bbCommon,
        },
      })
      rippleAnims.push({ entity, phase: i * phaseStep })
    }

    entities.add({
      id,
      name: id,
      position,
      point: {
        pixelSize: 20,
        color: Cesium.Color.fromCssColorString(ALARM_COLOR),
        ...pointCommon(),
      },
      label: pointLabel('#ff6b6b', -36),
    })
  }
}

/** 水波纹主环半径（与 demo CallbackProperty 公式一致） */
const waterMainRingRadiusM = (startTime: number) => {
  const elapsed = (performance.now() - startTime) % WATER_PERIOD_MS
  const progress = elapsed / WATER_PERIOD_MS
  const easeProgress = 1 - Math.pow(1 - progress, 1.5)
  return easeProgress * WATER_MAX_RADIUS_M
}

/** 水波纹快环半径（demo 线性扩散） */
const waterFastRingRadiusM = (startTime: number) => {
  const t = ((performance.now() - startTime) % WATER_FAST_PERIOD_MS) / WATER_FAST_PERIOD_MS
  return t * WATER_FAST_MAX_RADIUS_M
}

/** 水波纹：demo 样式，经纬度用 gisPoint（重庆域） */
const addWaterWaveGisPoint = () => {
  const rec = gisPoint
  const Cesium = cesiumMod
  const layer = gisPointLayer
  const centerPos = waterWaveCenterOf()
  if (rec && Cesium && layer && centerPos) {
    const entities = layer.entities
    const id = `gis-point-${rec.pointCode}`
    const code = rec.pointCode
    const lon = Number(rec.longitude)
    const lat = Number(rec.latitude)

    for (let i = 0; i < WATER_RING_COUNT; i++) {
      const phaseOffset = (i / WATER_RING_COUNT) * WATER_PERIOD_MS
      const startTime = performance.now() - phaseOffset
      let alpha = 0.6 * (1 - (i / WATER_RING_COUNT) * 0.7)
      alpha = Math.max(0.15, Math.min(0.8, alpha))
      const ringColor = Cesium.Color.fromCssColorString(WATER_WAVE_COLOR).withAlpha(alpha)
      const entity = entities.add({
        name: `gis-point-water-ring-${code}-${i}`,
        position: centerPos,
        ellipse: {
          semiMajorAxis: new Cesium.ConstantProperty(0),
          semiMinorAxis: new Cesium.ConstantProperty(0),
          material: ringColor,
          outline: false,
          height: getChongqingReliefTopHeight() + 2,
        },
      })
      waterRingAnims.push({ entity, startTime })
    }

    const fastStart = performance.now()
    const fastEntity = entities.add({
      name: `gis-point-water-fast-${code}`,
      position: centerPos,
      ellipse: {
        semiMajorAxis: new Cesium.ConstantProperty(0),
        semiMinorAxis: new Cesium.ConstantProperty(0),
        material: Cesium.Color.fromCssColorString(WATER_WAVE_FAST_COLOR).withAlpha(0.65),
        outline: false,
        height: getChongqingReliefTopHeight() + 2,
      },
    })
    waterRingAnims.push({ entity: fastEntity, startTime: fastStart, linear: true })

    const centerHeight = getChongqingReliefTopHeight() + POINT_ABOVE_RELIEF_M
    entities.add({
      id,
      name: id,
      position: Cesium.Cartesian3.fromDegrees(lon, lat, centerHeight),
      point: {
        ...pointCommon(),
        pixelSize: 18,
        color: Cesium.Color.fromCssColorString(WATER_WAVE_CENTER_COLOR),
        outlineColor: Cesium.Color.WHITE,
        outlineWidth: 2,
      },
      label: pointLabel(WATER_WAVE_COLOR, -28),
    })

    entities.add({
      name: `gis-point-water-outline-${code}`,
      position: centerPos,
      ellipse: {
        semiMajorAxis: WATER_MAX_RADIUS_M,
        semiMinorAxis: WATER_MAX_RADIUS_M,
        material: Cesium.Color.fromCssColorString('#2d7fff').withAlpha(0.1),
        outline: true,
        outlineColor: Cesium.Color.fromCssColorString('#5f9eff').withAlpha(0.5),
        outlineWidth: 1.5,
        height: getChongqingReliefTopHeight() + 2,
      },
    })
  }
}

/** 按 gisPoint.status 绘制当前点：1 正常；2 报警；3 预警；4 水波纹 */
const addGisPoint = () => {
  const rec = gisPoint
  if (rec) {
    const status = Number(rec.status)
    if (status === 2) addAlarmGisPoint()
    else if (status === 3) addWarningGisPoint()
    else if (status === 4) addWaterWaveGisPoint()
    else addNormalGisPoint()
  }
}

/** 清空动画实体引用列表（重绘点位前调用） */
const clearAnimRefs = () => {
  rippleAnims.length = 0
  breathAnims.length = 0
  waterRingAnims.length = 0
}

/** 移除图层内全部监测点并清空动画引用 */
const clearGisPoints = () => {
  clearAnimRefs()
  if (gisPointLayer) {
    gisPointLayer.entities.removeAll()
  }
}

/** 清空旧点位后，逐条按 status 渲染（读 gisPointList / gisPoint） */
const renderGisPoints = () => {
  ensureGisPointLayer()
  if (gisPointLayer) {
    clearGisPoints()
    for (const item of gisPointList) {
      gisPoint = item
      addGisPoint()
    }
  }
}

/** 请求点位列表并绘制 */
const loadAndRenderGisPoints = async () => {
  if (cesiumMod) {
    const res = await getPointsListByType({ type: '2' })
    gisPointList = Array.isArray(res.data) ? res.data : []
    renderGisPoints()
    startPointAnimLoop()
  }
}

/** 重庆区域样式加载完成（CesiumMap region-ready） */
const onRegionReady = () => {
  loadAndRenderGisPoints()
}

// ---------- 3. 点位动画（loadAndRenderGisPoints 完成后启动）----------
const WARNING_BREATH_HZ = 0.95

/** 动画时间轴（秒） */
const animSeconds = () => performance.now() * 0.001

/** 预警呼吸 0~1 相位（平方缓动） */
const breathPhase = (hz: number) => {
  const wave = 0.5 + 0.5 * Math.sin(animSeconds() * Math.PI * 2 * hz)
  return wave * wave
}

/** 报警外扩环 0~1 周期相位 */
const rippleT = (phase: number) => {
  const x = ((animSeconds() + phase) % PULSE_PERIOD) + PULSE_PERIOD
  return (x % PULSE_PERIOD) / PULSE_PERIOD
}

/** 外扩环是否显示（首尾留白） */
const rippleVisible = (t: number) => t >= 0.02 && t < 0.98

/** 外扩环 billboard 像素尺寸 */
const ripplePixelSize = (t: number) => RIPPLE_PX_MIN + t * (RIPPLE_PX_MAX - RIPPLE_PX_MIN)

/** 每帧刷新预警呼吸与报警外扩环 */
const updatePointAnimations = () => {
  const Cesium = cesiumMod
  if (Cesium && gisPointLayer) {
    for (const rip of rippleAnims) {
      const bb = rip.entity.billboard
      if (bb) {
        const t = rippleT(rip.phase)
        const px = ripplePixelSize(t)
        bb.width = new Cesium.ConstantProperty(px)
        bb.height = new Cesium.ConstantProperty(px)
        bb.show = new Cesium.ConstantProperty(rippleVisible(t))
        bb.color = new Cesium.ConstantProperty(Cesium.Color.WHITE)
      }
    }

    const pulse = breathPhase(WARNING_BREATH_HZ)

    for (const layer of breathAnims) {
      const bb = layer.entity.billboard
      if (bb) {
        const px = layer.minPx + pulse * (layer.maxPx - layer.minPx)
        bb.width = new Cesium.ConstantProperty(px)
        bb.height = new Cesium.ConstantProperty(px)
        bb.color = new Cesium.ConstantProperty(Cesium.Color.WHITE)
      }
    }

    for (const ring of waterRingAnims) {
      const ell = ring.entity.ellipse
      if (ell) {
        const r = ring.linear
          ? waterFastRingRadiusM(ring.startTime)
          : waterMainRingRadiusM(ring.startTime)
        ell.semiMajorAxis = new Cesium.ConstantProperty(r)
        ell.semiMinorAxis = new Cesium.ConstantProperty(r)
      }
    }
  }
}

/** 取消点位动画帧循环 */
const stopPointAnimLoop = () => {
  if (pointAnimFrameId) {
    cancelAnimationFrame(pointAnimFrameId)
    pointAnimFrameId = 0
  }
}

/** requestAnimationFrame 驱动呼吸/外扩环 */
const startPointAnimLoop = () => {
  stopPointAnimLoop()
  const tick = () => {
    if (cesiumMod && viewerRef.value) {
      const viewer = viewerRef.value
      updatePointAnimations()
      viewer.scene.requestRender()
      pointAnimFrameId = requestAnimationFrame(tick)
    } else {
      stopPointAnimLoop()
    }
  }
  pointAnimFrameId = requestAnimationFrame(tick)
}

// ---------- 卸载 ----------
onBeforeUnmount(() => {
  stopPointAnimLoop()
  clearAnimRefs()
  // 子组件 CesiumMap 会先 destroy Viewer，此处勿再操作 dataSources
  gisPointLayer = null
  gisPointList = []
  gisPoint = null
  viewerRef.value = null
  cesiumMod = null
})
</script>

<style scoped lang="scss">
.bayu-screen {
  position: relative;
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  min-height: 100svh;
  background: #030a06;
  color: #ecfdf5;

  &__head {
    flex: 0 0 auto;
    padding: 12px 20px 8px;
    z-index: 2;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.65);
  }

  &__title {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 600;
    letter-spacing: 0.04em;
    color: #ecfdf5;
  }

  &__sub {
    margin: 4px 0 0;
    font-size: 12px;
    opacity: 0.75;
    color: #86efac;
  }

  &__map {
    flex: 1;
    min-height: 0;
    position: relative;
  }
}
</style>
