/** GIS 点位列表项 */
export interface GisPointRecord {
  longitude: string
  latitude: string
  pointCode: string
  pointName: string
  pointSimpleName: string
  pointType: string
  siteType: number | string
  /** 0 离线 1 正常 2 报警 3 预警 4 水波纹 */
  status: number
  value: string
}

export interface GisPointsListParams {
  type?: string | number
}
