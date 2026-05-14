import { createRouter, createWebHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'

declare module 'vue-router' {
  interface RouteMeta {
    /** 全宽大屏：为 #app 挂上 dashboard-root */
    layout?: 'fullscreen'
  }
}

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'index',
    component: () => import('../views/index.vue'),
  },
  {
    path: '/bayu-screen',
    name: 'bayuScreen',
    component: () => import('../views/bayuScreen.vue'),
    meta: { layout: 'fullscreen' },
  },
]

export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
})
