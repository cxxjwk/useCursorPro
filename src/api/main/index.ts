import { get } from '../http/axios'
import { getMockPointsListByType } from '../mock/gisPointsMock'
import type { HttpResponse } from '../types'
import type { GisPointRecord, GisPointsListParams } from './types'

const useApiMock = import.meta.env.VITE_USE_API_MOCK === 'true'

enum URL {
  getPointsListByType = '/screenApi/rjna/bigScreen/gis/getPointsListByType',
  getMonitordataByPointCode = '/screenApi/rjna/bigScreen/gis/getMonitordataByPointCode',
  initPointsAndCenter = '/screenApi/rjna/bigScreen/gis/initPointsAndCenter',
}

/** 按类型查询 GIS 监测点列表（mock 由 VITE_USE_API_MOCK 控制） */
const getPointsListByType = async (data?: GisPointsListParams) => {
  if (useApiMock) {
    return getMockPointsListByType(data)
  }
  return get<HttpResponse<GisPointRecord[]>>({ url: URL.getPointsListByType, params: data })
}

/** 按点位编码查询监测数据 */
const getMonitordataByPointCode = async (data?: Record<string, string | number>) =>
  get<HttpResponse<Record<string, unknown>>>({ url: URL.getMonitordataByPointCode, params: data })

/** 初始化点位与中心 */
const initPointsAndCenter = async (data?: Record<string, string | number>) =>
  get<HttpResponse<Record<string, unknown>>>({ url: URL.initPointsAndCenter, params: data })

export { getPointsListByType, getMonitordataByPointCode, initPointsAndCenter }
