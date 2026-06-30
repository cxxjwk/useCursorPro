<template>
  <nav class="app-route-nav" :class="{ 'app-route-nav--on-dark': isFullscreen }" aria-label="主导航">
    <RouterLink to="/">首页</RouterLink>
    <span class="app-route-nav__sep">|</span>
    <RouterLink to="/bayu-screen">巴渝治水-突发事故</RouterLink>
  </nav>
  <RouterView />
</template>

<script setup lang="ts">
import { computed, watchEffect } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const isFullscreen = computed(() => route.meta.layout === 'fullscreen')

watchEffect(() => {
  document.getElementById('app')?.classList.toggle('dashboard-root', isFullscreen.value)
})
</script>

<style scoped lang="scss">
.app-route-nav {
  position: fixed;
  top: 10px;
  right: 14px;
  z-index: 10000;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;

  a {
    color: #5c5766;
    text-decoration: none;

    &.router-link-active {
      font-weight: 600;
      color: #08060d;
    }
  }

  &__sep {
    opacity: 0.45;
    user-select: none;
  }

  &--on-dark {
    a {
      color: #86efac;

      &.router-link-active {
        color: #ecfdf5;
        text-shadow: 0 0 8px rgba(74, 222, 128, 0.45);
      }
    }

    .app-route-nav__sep {
      color: #5d8f72;
    }
  }
}
</style>
