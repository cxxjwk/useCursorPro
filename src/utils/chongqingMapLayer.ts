/**
 * 在 Cesium 上绘制重庆市行政区域：外区压暗遮罩 + 镂空 + 绿色发光边界 + 内区提亮 + 主支流河流线
 * 边界数据：阿里云 DataV（需浏览器可访问外网）
 */
const CHONGQING_GEOJSON =
  'https://geo.datav.aliyun.com/areas_v3/bound/500000_full.json'

/** 重庆市域大致范围：首帧取景与网络失败时仍能看到重庆 */
export const CHONGQING_VIEW_RECT_DEG = {
  west: 105.2,
  south: 28.05,
  east: 110.6,
  north: 32.35,
}

type CesiumMod = typeof import('cesium')
type Viewer = import('cesium').Viewer

/** 中国重庆上空俯视朝向 */
function chongqingCameraOrientation(Cesium: CesiumMod) {
  return {
    heading: Cesium.Math.toRadians(0),
    pitch: Cesium.Math.toRadians(-58),
    roll: 0,
  }
}

/**
 * 使用 camera.flyTo 飞往重庆一带（destination 为经纬度矩形）
 * @param durationSeconds 飞行时长（秒）
 */
function flyCameraToChongqingRectangle(
  Cesium: CesiumMod,
  viewer: Viewer,
  west: number,
  south: number,
  east: number,
  north: number,
  durationSeconds = 2,
) {
  viewer.camera.flyTo({
    destination: Cesium.Rectangle.fromDegrees(west, south, east, north),
    orientation: chongqingCameraOrientation(Cesium),
    duration: durationSeconds,
  })
}

/** 在边界 JSON 返回前先飞往重庆，避免首屏空白 */
export function presetChongqingViewport(Cesium: CesiumMod, viewer: Viewer) {
  const r = CHONGQING_VIEW_RECT_DEG
  flyCameraToChongqingRectangle(Cesium, viewer, r.west, r.south, r.east, r.north, 1.5)
}

type GeoPolygon = { type: 'Polygon'; coordinates: number[][][] }
type GeoMultiPolygon = { type: 'MultiPolygon'; coordinates: number[][][][] }

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

function ringToDegreesHeights(ring: number[][], height: number): number[] {
  const flat: number[] = []
  for (const pt of ring) {
    flat.push(pt[0], pt[1], height)
  }
  const a = ring[0]
  const b = ring[ring.length - 1]
  if (a[0] !== b[0] || a[1] !== b[1]) {
    flat.push(a[0], a[1], height)
  }
  return flat
}

function polygonToHierarchy(Cesium: CesiumMod, rings: number[][][]) {
  const exterior = Cesium.Cartesian3.fromDegreesArray(ringToFlat(rings[0]))
  const holes = rings
    .slice(1)
    .map(
      (lake) =>
        new Cesium.PolygonHierarchy(Cesium.Cartesian3.fromDegreesArray(ringToFlat(lake))),
    )
  return new Cesium.PolygonHierarchy(exterior, holes)
}

function collectPartHierarchies(Cesium: CesiumMod, geometry: GeoPolygon | GeoMultiPolygon) {
  if (geometry.type === 'Polygon') {
    return [polygonToHierarchy(Cesium, geometry.coordinates)]
  }
  return geometry.coordinates.map((polyRings) => polygonToHierarchy(Cesium, polyRings))
}

function collectExteriorRings(geometry: GeoPolygon | GeoMultiPolygon): number[][][] {
  if (geometry.type === 'Polygon') {
    return [geometry.coordinates[0]]
  }
  return geometry.coordinates.map((poly) => poly[0])
}

function bboxFromGeometry(geometry: GeoPolygon | GeoMultiPolygon) {
  let west = 180
  let south = 90
  let east = -180
  let north = -90
  for (const ring of collectExteriorRings(geometry)) {
    for (const [lon, lat] of ring) {
      west = Math.min(west, lon)
      east = Math.max(east, lon)
      south = Math.min(south, lat)
      north = Math.max(north, lat)
    }
  }
  return { west, south, east, north }
}

function flyCameraToChongqingBbox(
  Cesium: CesiumMod,
  viewer: Viewer,
  geometry: GeoPolygon | GeoMultiPolygon,
) {
  const { west, south, east, north } = bboxFromGeometry(geometry)
  const lonSpan = Math.max(east - west, 0.25)
  const latSpan = Math.max(north - south, 0.2)
  const padLon = Math.max(lonSpan * 0.12, 0.08)
  const padLat = Math.max(latSpan * 0.12, 0.08)

  flyCameraToChongqingRectangle(
    Cesium,
    viewer,
    west - padLon,
    south - padLat,
    east + padLon,
    north + padLat,
    2.2,
  )
}

function flyCameraFallback(Cesium: CesiumMod, viewer: Viewer) {
  const r = CHONGQING_VIEW_RECT_DEG
  flyCameraToChongqingRectangle(Cesium, viewer, r.west, r.south, r.east, r.north, 1.8)
}

export async function addChongqingRegionStyle(
  Cesium: CesiumMod,
  viewer: Viewer,
): Promise<void> {
  let res: Response
  try {
    res = await fetch(CHONGQING_GEOJSON)
  } catch (e) {
    console.warn('[chongqingMapLayer] 边界数据请求失败', e)
    flyCameraFallback(Cesium, viewer)
    return
  }
  if (!res.ok) {
    flyCameraFallback(Cesium, viewer)
    return
  }

  let gj: { features?: { geometry: GeoPolygon | GeoMultiPolygon }[] }
  try {
    gj = await res.json()
  } catch {
    flyCameraFallback(Cesium, viewer)
    return
  }
  const feature = gj.features?.[0]
  if (!feature?.geometry) {
    flyCameraFallback(Cesium, viewer)
    return
  }

  const geom = feature.geometry
  if (geom.type !== 'Polygon' && geom.type !== 'MultiPolygon') {
    flyCameraFallback(Cesium, viewer)
    return
  }

  const partHierarchies = collectPartHierarchies(Cesium, geom)

  viewer.entities.add({
    name: '重庆-外区压暗',
    polygon: {
      hierarchy: new Cesium.PolygonHierarchy(
        Cesium.Cartesian3.fromDegreesArray([72, 8, 138, 8, 138, 42, 72, 42, 72, 8]),
        partHierarchies,
      ),
      height: 0,
      material: Cesium.Color.fromCssColorString('#031208').withAlpha(0.68),
      outline: false,
      perPositionHeight: false,
    },
  })

  for (const h of partHierarchies) {
    viewer.entities.add({
      name: '重庆-内区提亮',
      polygon: {
        hierarchy: h,
        height: 0,
        material: Cesium.Color.fromCssColorString('#22c55e').withAlpha(0.11),
        outline: false,
        perPositionHeight: false,
      },
    })
  }

  for (const ring of collectExteriorRings(geom)) {
    const shadowRing = ring.map(([lon, lat]) => [lon + 0.018, lat - 0.018] as [number, number])
    const shadowFlat = ringToDegreesHeights(shadowRing, 350)
    const glowFlat = ringToDegreesHeights(ring, 520)

    viewer.entities.add({
      name: '重庆-边界影',
      polyline: {
        positions: Cesium.Cartesian3.fromDegreesArrayHeights(shadowFlat),
        width: 16,
        material: Cesium.Color.fromCssColorString('#001a0f').withAlpha(0.75),
        arcType: Cesium.ArcType.GEODESIC,
      },
    })

    viewer.entities.add({
      name: '重庆-边界光',
      polyline: {
        positions: Cesium.Cartesian3.fromDegreesArrayHeights(glowFlat),
        width: 5,
        material: new Cesium.PolylineGlowMaterialProperty({
          glowPower: 0.24,
          color: Cesium.Color.fromCssColorString('#4ade80').withAlpha(0.96),
        }),
        arcType: Cesium.ArcType.GEODESIC,
      },
    })

    viewer.entities.add({
      name: '重庆-边界线芯',
      polyline: {
        positions: Cesium.Cartesian3.fromDegreesArrayHeights(glowFlat),
        width: 1.6,
        material: Cesium.Color.fromCssColorString('#bbf7d0').withAlpha(0.96),
        arcType: Cesium.ArcType.GEODESIC,
      },
    })
  }

  const mainFlat = ringToDegreesHeights(
    [
      [105.95, 28.75],
      [106.55, 29.05],
      [107.05, 29.35],
      [107.55, 29.55],
      [108.15, 29.58],
      [108.75, 29.45],
    ],
    650,
  )

  viewer.entities.add({
    name: '河流-支流',
    polyline: {
      positions: Cesium.Cartesian3.fromDegreesArrayHeights(
        ringToDegreesHeights(
          [
            [105.65, 29.55],
            [106.2, 29.75],
            [106.85, 29.85],
            [107.45, 29.7],
          ],
          650,
        ),
      ),
      width: 3.5,
      material: Cesium.Color.fromCssColorString('#6ee7b7').withAlpha(0.82),
      arcType: Cesium.ArcType.GEODESIC,
    },
  })

  viewer.entities.add({
    name: '河流-干流底层',
    polyline: {
      positions: Cesium.Cartesian3.fromDegreesArrayHeights(mainFlat),
      width: 12,
      material: Cesium.Color.fromCssColorString('#064e3b').withAlpha(0.5),
      arcType: Cesium.ArcType.GEODESIC,
    },
  })

  viewer.entities.add({
    name: '河流-干流高光',
    polyline: {
      positions: Cesium.Cartesian3.fromDegreesArrayHeights(mainFlat),
      width: 7,
      material: new Cesium.PolylineGlowMaterialProperty({
        glowPower: 0.3,
        color: Cesium.Color.fromCssColorString('#4ade80').withAlpha(0.98),
      }),
      arcType: Cesium.ArcType.GEODESIC,
    },
  })

  flyCameraToChongqingBbox(Cesium, viewer, geom)
}
