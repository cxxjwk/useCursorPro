/**
 * 重庆市域圈定（参考大屏样式）：暗色遮罩 + 镂空 + 青色浮雕 + 发光边界
 * 边界：DataV 500000（省级轮廓；勿用 500000_full，其为 38 个区县会误取 features[0]）
 *
 * 书写顺序：视口/常量 → 几何辅助 → 区域绘制 → addChongqingRegionStyle 入口
 */
const CHONGQING_GEOJSON = 'https://geo.datav.aliyun.com/areas_v3/bound/500000.json'

const CYAN_GLOW = '#22d3ee'
const CYAN_LINE = '#a5f3fc'

export const CHONGQING_VIEW_RECT_DEG = {
  west: 105.2,
  south: 28.05,
  east: 110.6,
  north: 32.35,
}

export const CHONGQING_URBAN_VIEW_DEG = {
  west: 106.36,
  south: 29.44,
  east: 106.7,
  north: 29.64,
}

/** 浮雕高度相对基准的比例（维护者要求约为原高度的 1/3） */
const RELIEF_HEIGHT_SCALE = 1 / 3

/** 最近一次绘制后的浮雕顶面高度（米），供点位层对齐 */
let reliefTopHeightM = 22000 * RELIEF_HEIGHT_SCALE

export function getChongqingReliefTopHeight(): number {
  return reliefTopHeightM
}

type ReliefProfile = {
  top: number
  shadowEnd: number
  layer1: number
  layer2: number
  layer3: number
  layer4: number
}

function reliefProfileFromBbox(
  Cesium: CesiumMod,
  west: number,
  south: number,
  east: number,
  north: number,
): ReliefProfile {
  const midLat = (south + north) * 0.5
  const cosLat = Math.cos(Cesium.Math.toRadians(midLat))
  const widthM = (east - west) * 111320 * cosLat
  const heightM = (north - south) * 110540
  const diag = Math.hypot(widthM, heightM)
  const top = Cesium.Math.clamp(
    diag * 0.058 * RELIEF_HEIGHT_SCALE,
    22000 * RELIEF_HEIGHT_SCALE,
    72000 * RELIEF_HEIGHT_SCALE,
  )
  return {
    top,
    shadowEnd: top * 0.09,
    layer1: top * 0.3,
    layer2: top * 0.52,
    layer3: top * 0.74,
    layer4: top * 0.9,
  }
}

let reliefTopGradientUrl: string | undefined

function reliefTopGradientDataUrl(): string {
  if (reliefTopGradientUrl) {
    return reliefTopGradientUrl
  }
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 256
  const ctx = canvas.getContext('2d')
  if (ctx) {
    const g = ctx.createRadialGradient(128, 88, 8, 128, 128, 148)
    g.addColorStop(0, 'rgba(204, 251, 241, 0.92)')
    g.addColorStop(0.42, 'rgba(45, 212, 191, 0.72)')
    g.addColorStop(1, 'rgba(4, 47, 46, 0.45)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, 256, 256)
    reliefTopGradientUrl = canvas.toDataURL()
    return reliefTopGradientUrl
  }
  return ''
}

function enableReliefLighting(Cesium: CesiumMod, viewer: Viewer) {
  viewer.scene.globe.enableLighting = true
  viewer.scene.light = new Cesium.DirectionalLight({
    direction: new Cesium.Cartesian3(0.42, -0.58, -0.7),
    intensity: 1.55,
  })
}

type CesiumMod = typeof import('cesium')
type Viewer = import('cesium').Viewer
type GeoPolygon = { type: 'Polygon'; coordinates: number[][][] }
type GeoMultiPolygon = { type: 'MultiPolygon'; coordinates: number[][][][] }

function chongqingCameraOrientation(Cesium: CesiumMod) {
  return {
    heading: Cesium.Math.toRadians(0),
    pitch: Cesium.Math.toRadians(-58),
    roll: 0,
  }
}

// ---------- 1. 视口（初始化地图时 presetChongqingViewport）----------
export function presetChongqingViewport(Cesium: CesiumMod, viewer: Viewer) {
  const r = CHONGQING_VIEW_RECT_DEG
  const center = { lon: (r.west + r.east) / 2, lat: (r.south + r.north) / 2 }
  viewer.camera.setView({
    destination: Cesium.Cartesian3.fromDegrees(center.lon, center.lat, 720000),
    orientation: chongqingCameraOrientation(Cesium),
  })
}

// ---------- 2. 几何与 GeoJSON 辅助 ----------
function ringToFlat(ring: number[][]): number[] {
  const flat: number[] = []
  for (const [lon, lat] of ring) {
    flat.push(lon, lat)
  }
  const a = ring[0]
  const b = ring[ring.length - 1]
  if (a[0] !== b[0] || a[1] !== b[1]) {
    flat.push(a[0], a[1])
  }
  return flat
}

function openRing(ring: number[][]): number[][] {
  if (
    ring.length > 1 &&
    ring[0][0] === ring[ring.length - 1][0] &&
    ring[0][1] === ring[ring.length - 1][1]
  ) {
    return ring.slice(0, -1)
  }
  return ring
}

/** 加密边界折点为平滑曲线 */
function densifyRing(ring: number[][], maxSegmentDeg = 0.012): number[][] {
  const pts = openRing(ring)
  const result: number[][] = []
  for (let i = 0; i < pts.length; i++) {
    const [lon0, lat0] = pts[i]
    const [lon1, lat1] = pts[(i + 1) % pts.length]
    result.push([lon0, lat0])
    const steps = Math.max(1, Math.ceil(Math.hypot(lon1 - lon0, lat1 - lat0) / maxSegmentDeg))
    for (let s = 1; s < steps; s++) {
      const t = s / steps
      result.push([lon0 + (lon1 - lon0) * t, lat0 + (lat1 - lat0) * t])
    }
  }
  return result
}

function ringToEdgePositions(Cesium: CesiumMod, ring: number[][], height: number) {
  const ellipsoid = Cesium.Ellipsoid.WGS84
  const out: InstanceType<CesiumMod['Cartesian3']>[] = []
  for (const [lon, lat] of densifyRing(ring)) {
    out.push(ellipsoid.cartographicToCartesian(Cesium.Cartographic.fromDegrees(lon, lat, height)))
  }
  if (out.length > 0) {
    out.push(out[0])
  }
  return out
}

function polygonToHierarchy(Cesium: CesiumMod, rings: number[][][]) {
  const exterior = Cesium.Cartesian3.fromDegreesArray(ringToFlat(rings[0]))
  const holes = rings
    .slice(1)
    .map(
      (lake) => new Cesium.PolygonHierarchy(Cesium.Cartesian3.fromDegreesArray(ringToFlat(lake))),
    )
  return new Cesium.PolygonHierarchy(exterior, holes)
}

function ringSignedArea(ring: number[][]): number {
  let area = 0
  const n = ring.length - 1
  for (let i = 0; i < n; i++) {
    const [x0, y0] = ring[i]
    const [x1, y1] = ring[i + 1]
    area += x0 * y1 - x1 * y0
  }
  return Math.abs(area * 0.5)
}

function partKey(polyRings: number[][][]): string {
  const p = polyRings[0][0]
  return `${p[0]},${p[1]}`
}

/** 仅主轮廓（面积最大的一块） */
function pickMainPolygonGeometry(geometry: GeoPolygon | GeoMultiPolygon): GeoPolygon {
  if (geometry.type === 'Polygon') {
    return geometry
  }
  let maxArea = -1
  let mainRings = geometry.coordinates[0]
  for (const polyRings of geometry.coordinates) {
    const area = ringSignedArea(polyRings[0])
    if (area > maxArea) {
      maxArea = area
      mainRings = polyRings
    }
  }
  return { type: 'Polygon', coordinates: mainRings }
}

/** MultiPolygon 中除主轮廓外的飞地（左下常见为独立小块） */
function listExclaveParts(
  geometry: GeoPolygon | GeoMultiPolygon,
  main: GeoPolygon,
): number[][][][] {
  if (geometry.type === 'Polygon') {
    return []
  }
  const mainKey = partKey(main.coordinates)
  return geometry.coordinates.filter((poly) => partKey(poly) !== mainKey)
}

/** 只用外环：去掉湖泊内环，避免内环边在浮雕顶面形成“线圈” */
function exteriorOnly(geom: GeoPolygon): GeoPolygon {
  return { type: 'Polygon', coordinates: [geom.coordinates[0]] }
}

function bboxFromRing(ring: number[][]) {
  let west = 180
  let south = 90
  let east = -180
  let north = -90
  for (const [lon, lat] of ring) {
    west = Math.min(west, lon)
    east = Math.max(east, lon)
    south = Math.min(south, lat)
    north = Math.max(north, lat)
  }
  return { west, south, east, north }
}

function removeChongqingLayerEntities(viewer: Viewer) {
  if (viewer.isDestroyed()) return
  const toRemove = viewer.entities.values.filter((e) => {
    const name = e.name ?? ''
    return name.startsWith('重庆-')
  })
  for (const entity of toRemove) {
    viewer.entities.remove(entity)
  }
}

function flyCameraToBbox(
  Cesium: CesiumMod,
  viewer: Viewer,
  west: number,
  south: number,
  east: number,
  north: number,
) {
  if (viewer.isDestroyed()) return
  const padLon = Math.max((east - west) * 0.26, 0.22)
  const padLat = Math.max((north - south) * 0.26, 0.2)
  const rect = Cesium.Rectangle.fromDegrees(
    west - padLon,
    south - padLat,
    east + padLon,
    north + padLat,
  )

  viewer.camera.flyTo({
    destination: rect,
    duration: 2.2,
    orientation: {
      heading: 0,
      pitch: Cesium.Math.toRadians(-94),
      roll: 0,
    },
  })
}

// ---------- 3. 重庆区域实体绘制 ----------
function drawChongqingRegion(
  Cesium: CesiumMod,
  viewer: Viewer,
  geom: GeoPolygon,
  exclaves: number[][][][],
) {
  if (viewer.isDestroyed()) return
  enableReliefLighting(Cesium, viewer)

  const maskMaterial = Cesium.Color.fromCssColorString('#020808').withAlpha(0.72)
  const ring = geom.coordinates[0]
  const hierarchy = polygonToHierarchy(Cesium, geom.coordinates)
  const bbox = bboxFromRing(ring)
  const relief = reliefProfileFromBbox(Cesium, bbox.west, bbox.south, bbox.east, bbox.north)
  reliefTopHeightM = relief.top

  const topGradient = reliefTopGradientDataUrl()
  const topCapMaterial = topGradient
    ? new Cesium.ImageMaterialProperty({
        image: topGradient,
        transparent: true,
      })
    : Cesium.Color.fromCssColorString('#5eead4').withAlpha(0.82)

  viewer.entities.add({
    name: '重庆-外区压暗',
    polygon: {
      hierarchy: new Cesium.PolygonHierarchy(
        Cesium.Cartesian3.fromDegreesArray([72, 8, 138, 8, 138, 42, 72, 42, 72, 8]),
        [hierarchy],
      ),
      height: 0,
      material: maskMaterial,
      outline: false,
      perPositionHeight: false,
    },
  })

  viewer.entities.add({
    name: '重庆-投影阴影',
    polygon: {
      hierarchy,
      height: 0,
      extrudedHeight: relief.shadowEnd,
      material: Cesium.Color.BLACK.withAlpha(0.5),
      outline: false,
      perPositionHeight: false,
    },
  })

  viewer.entities.add({
    name: '重庆-浮雕底座',
    polygon: {
      hierarchy,
      height: 0,
      extrudedHeight: relief.layer1,
      material: Cesium.Color.fromCssColorString('#022c22').withAlpha(0.98),
      outline: false,
      perPositionHeight: false,
    },
  })

  viewer.entities.add({
    name: '重庆-浮雕下层',
    polygon: {
      hierarchy,
      height: relief.layer1,
      extrudedHeight: relief.layer2,
      material: Cesium.Color.fromCssColorString('#064e3b').withAlpha(0.96),
      outline: false,
      perPositionHeight: false,
    },
  })

  viewer.entities.add({
    name: '重庆-浮雕中层',
    polygon: {
      hierarchy,
      height: relief.layer2,
      extrudedHeight: relief.layer3,
      material: Cesium.Color.fromCssColorString('#0f766e').withAlpha(0.94),
      outline: false,
      perPositionHeight: false,
    },
  })

  viewer.entities.add({
    name: '重庆-浮雕上层',
    polygon: {
      hierarchy,
      height: relief.layer3,
      extrudedHeight: relief.layer4,
      material: Cesium.Color.fromCssColorString('#14b8a6').withAlpha(0.9),
      outline: false,
      perPositionHeight: false,
    },
  })

  viewer.entities.add({
    name: '重庆-浮雕顶面',
    polygon: {
      hierarchy,
      height: relief.layer4,
      extrudedHeight: relief.top,
      material: topCapMaterial,
      outline: true,
      outlineColor: Cesium.Color.fromCssColorString(CYAN_LINE).withAlpha(0.35),
      outlineWidth: 1,
      perPositionHeight: false,
    },
  })

  const edgePositions = ringToEdgePositions(Cesium, ring, relief.top)
  const bevelPositions = ringToEdgePositions(Cesium, ring, relief.layer4)

  viewer.entities.add({
    name: '重庆-浮雕棱线',
    polyline: {
      positions: bevelPositions,
      width: 2.5,
      material: Cesium.Color.fromCssColorString('#134e4a').withAlpha(0.65),
      arcType: Cesium.ArcType.NONE,
    },
  })

  viewer.entities.add({
    name: '重庆-边界光晕',
    polyline: {
      positions: edgePositions,
      width: 8,
      material: new Cesium.PolylineGlowMaterialProperty({
        glowPower: 0.32,
        color: Cesium.Color.fromCssColorString(CYAN_GLOW).withAlpha(1),
      }),
      arcType: Cesium.ArcType.NONE,
    },
  })

  viewer.entities.add({
    name: '重庆-边界线',
    polyline: {
      positions: edgePositions.slice(),
      width: 2.4,
      material: Cesium.Color.fromCssColorString(CYAN_LINE).withAlpha(1),
      arcType: Cesium.ArcType.NONE,
    },
  })

  const exclaveCover = Cesium.Color.fromCssColorString('#020808').withAlpha(1)
  for (const polyRings of exclaves) {
    viewer.entities.add({
      name: '重庆-飞地压暗',
      polygon: {
        hierarchy: polygonToHierarchy(Cesium, polyRings),
        height: relief.top + 500,
        material: exclaveCover,
        outline: false,
        perPositionHeight: false,
      },
    })
  }

  flyCameraToBbox(Cesium, viewer, bbox.west, bbox.south, bbox.east, bbox.north)
}

// ---------- 4. 区域入口（拉 GeoJSON → drawChongqingRegion，CesiumMap region-ready 前）----------
export async function addChongqingRegionStyle(Cesium: CesiumMod, viewer: Viewer): Promise<void> {
  if (viewer.isDestroyed()) return
  removeChongqingLayerEntities(viewer)

  let res: Response
  try {
    res = await fetch(CHONGQING_GEOJSON)
  } catch (e) {
    console.warn('[chongqingMapLayer] 边界数据请求失败', e)
    flyCameraToBbox(
      Cesium,
      viewer,
      CHONGQING_VIEW_RECT_DEG.west,
      CHONGQING_VIEW_RECT_DEG.south,
      CHONGQING_VIEW_RECT_DEG.east,
      CHONGQING_VIEW_RECT_DEG.north,
    )
    return
  }
  if (viewer.isDestroyed()) return
  if (!res.ok) {
    flyCameraToBbox(
      Cesium,
      viewer,
      CHONGQING_VIEW_RECT_DEG.west,
      CHONGQING_VIEW_RECT_DEG.south,
      CHONGQING_VIEW_RECT_DEG.east,
      CHONGQING_VIEW_RECT_DEG.north,
    )
    return
  }

  let gj: {
    features?: {
      geometry: GeoPolygon | GeoMultiPolygon
      properties?: { adcode?: number | string }
    }[]
  }
  try {
    gj = await res.json()
  } catch {
    flyCameraToBbox(
      Cesium,
      viewer,
      CHONGQING_VIEW_RECT_DEG.west,
      CHONGQING_VIEW_RECT_DEG.south,
      CHONGQING_VIEW_RECT_DEG.east,
      CHONGQING_VIEW_RECT_DEG.north,
    )
    return
  }
  if (viewer.isDestroyed()) return

  const feature =
    gj.features?.find((f) => {
      const code = f.properties?.adcode
      return code === 500000 || code === '500000'
    }) ?? gj.features?.[0]
  const raw = feature?.geometry
  if (!raw || (raw.type !== 'Polygon' && raw.type !== 'MultiPolygon')) {
    flyCameraToBbox(
      Cesium,
      viewer,
      CHONGQING_VIEW_RECT_DEG.west,
      CHONGQING_VIEW_RECT_DEG.south,
      CHONGQING_VIEW_RECT_DEG.east,
      CHONGQING_VIEW_RECT_DEG.north,
    )
    return
  }

  const main = pickMainPolygonGeometry(raw)
  const exclaves = listExclaveParts(raw, main)
  if (viewer.isDestroyed()) return
  drawChongqingRegion(Cesium, viewer, exteriorOnly(main), exclaves)
}
