import type { HttpResponse } from '../types'
import type { GisPointRecord, GisPointsListParams } from '../main/types'

/**
 * 模拟点位分散在重庆市域主轮廓内（约 105.9°–109.5°E，28.2°–31.2°N）
 * 2 正常 / 2 预警 / 2 报警 / 2 水波纹（status 4，重庆域经纬度）
 */
const CHONGQING_MOCK_POINTS: GisPointRecord[] = [
  {
    longitude: '106.52',
    latitude: '29.57',
    pointCode: 'CQ-N-001',
    pointName: '渝中嘉陵江断面',
    pointSimpleName: '渝中断面',
    pointType: '2',
    siteType: 'datatype001',
    status: 4,
    value: '4',
  },
  {
    longitude: '108.38',
    latitude: '30.81',
    pointCode: 'CQ-N-002',
    pointName: '万州长江段',
    pointSimpleName: '万州',
    pointType: '2',
    siteType: 'datatype001',
    status: 1,
    value: '1',
  },
  {
    longitude: '107.39',
    latitude: '29.70',
    pointCode: 'CQ-N-003',
    pointName: '涪陵乌江段',
    pointSimpleName: '涪陵',
    pointType: '2',
    siteType: 'datatype001',
    status: 1,
    value: '1',
  },
  {
    longitude: '106.26',
    latitude: '29.29',
    pointCode: 'CQ-N-004',
    pointName: '江津长江段',
    pointSimpleName: '江津',
    pointType: '2',
    siteType: 'datatype001',
    status: 4,
    value: '4',
  },
  {
    longitude: '105.93',
    latitude: '29.35',
    pointCode: 'CQ-W-001',
    pointName: '永川临江河',
    pointSimpleName: '永川',
    pointType: '2',
    siteType: 'datatype001',
    status: 3,
    value: '3',
  },
  {
    longitude: '108.77',
    latitude: '29.53',
    pointCode: 'CQ-W-002',
    pointName: '黔江阿蓬江',
    pointSimpleName: '黔江',
    pointType: '2',
    siteType: 'datatype001',
    status: 3,
    value: '3',
  },
  {
    longitude: '109.47',
    latitude: '31.02',
    pointCode: 'CQ-A-001',
    pointName: '奉节长江段',
    pointSimpleName: '奉节',
    pointType: '2',
    siteType: 'datatype001',
    status: 2,
    value: '2',
  },
  {
    longitude: '106.65',
    latitude: '28.95',
    pointCode: 'CQ-A-002',
    pointName: '綦江綦江河',
    pointSimpleName: '綦江',
    pointType: '2',
    siteType: 'datatype001',
    status: 2,
    value: '2',
  },
]

export function getMockPointsListByType(
  params?: GisPointsListParams,
): Promise<HttpResponse<GisPointRecord[]>> {
  const type = String(params?.type ?? '2')
  const list = CHONGQING_MOCK_POINTS.map((p) => ({ ...p, pointType: type }))
  return new Promise((resolve) => {
    window.setTimeout(
      () =>
        resolve({
          code: '200',
          msg: '操作成功',
          data: list,
        }),
      320,
    )
  })
}
