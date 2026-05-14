<template>
  <div class="bayu-screen" aria-label="巴渝治水大屏">
    <header class="bayu-screen__head">
      <h1 class="bayu-screen__title">巴渝治水 · 突发事故</h1>
      <p class="bayu-screen__sub">空白球体 + 天地图影像与注记（需 VITE_TIANDITU_TOKEN）</p>
    </header>
    <div class="bayu-screen__map">
      <CesiumMap />
    </div>
  </div>
</template>

<script setup lang="ts">
import CesiumMap from '../components/common/CesiumMap.vue'
console.log(import.meta.env.VITE_TIANDITU_TOKEN, '123')
</script>

<style scoped>
.bayu-screen {
  position: relative;
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  min-height: 100svh;
  background: #030a06;
  color: #ecfdf5;
}

.bayu-screen__head {
  flex: 0 0 auto;
  padding: 12px 20px 8px;
  z-index: 2;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.65);
}

.bayu-screen__title {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  color: #ecfdf5;
}

.bayu-screen__sub {
  margin: 4px 0 0;
  font-size: 12px;
  opacity: 0.75;
  color: #86efac;
}

.bayu-screen__map {
  flex: 1;
  min-height: 0;
  position: relative;
}
</style>
