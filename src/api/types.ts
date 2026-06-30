/** 接口统一响应（与 yuanquchidu 一致，code 多为字符串 "200"） */
export interface HttpResponse<T = unknown> {
  code: string | number
  msg?: string
  message?: string
  data: T
}

export interface PageType {
  total?: number
  pageNum?: number
  pageSize?: number
  pages?: number
}

export interface ListType {
  label?: string
  value?: string | number
}
