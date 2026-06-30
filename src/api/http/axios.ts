import axios from 'axios'
import type {
  AxiosError,
  AxiosInstance,
  AxiosRequestConfig,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from 'axios'
import { ElMessage } from 'element-plus'
import { showMessage } from './status'
const service: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE ?? '',
})

service.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem('token')
    if (token) {
      config.params = {
        ...(config.params || {}),
        token,
      }
    }
    return config
  },
  (error: AxiosError) => Promise.reject(error),
)

service.interceptors.response.use(
  (response: AxiosResponse) => {
    if (response.status === 200) {
      if (response.data.code == '401') {
        const text = showMessage(response.data.code)
        ElMessage({ message: response.data.msg, type: 'error' })
        return Promise.reject(new Error(text))
      }
      if (response.data.code == '200') {
        return Promise.resolve(response.data)
      }
      ElMessage({ message: response.data.msg, type: 'error' })
      return Promise.resolve(response.data)
    }
    const text = showMessage(response.status)
    return Promise.reject(new Error(text))
  },
  (error: AxiosError) => {
    let emsg = error.message || ''
    if (error.response) {
      emsg = showMessage(error.response.status)
    }
    if (emsg.includes('timeout')) {
      emsg = 'timeout'
    }
    return Promise.reject(new Error(emsg))
  },
)

/** GET 请求（走 axios 实例与拦截器） */
export function get<T = unknown>(config: AxiosRequestConfig): Promise<T> {
  return service.request({ ...config, method: 'GET' }) as Promise<T>
}

/** POST 请求（走 axios 实例与拦截器） */
export function post<T = unknown>(config: AxiosRequestConfig): Promise<T> {
  return service.request({ ...config, method: 'POST' }) as Promise<T>
}

export default service
