<template>
  <main class="view-index">
    <h1 class="view-index__title">mixturePro</h1>
    <p class="view-index__lead">选择要进入的页面。</p>
    <nav class="view-index__nav" aria-label="页面导航">
      <RouterLink class="view-index__link view-index__link--primary" to="/bayu-screen">
        巴渝治水 · 突发事故
      </RouterLink>
    </nav>
  </main>
</template>

<style scoped lang="scss">
.view-index {
  box-sizing: border-box;
  max-width: 640px;
  margin: 0 auto;
  padding: 48px 24px 80px;

  &__title {
    margin: 0 0 12px;
  }

  &__lead {
    margin: 0 0 28px;
    color: var(--text);
    line-height: 1.5;
  }

  &__nav {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
  }

  &__link {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 10px 18px;
    border-radius: 10px;
    font-size: 15px;
    font-weight: 500;
    text-decoration: none;
    border: 1px solid var(--border);
    color: var(--text-h);
    background: var(--bg);
    transition:
      border-color 0.15s ease,
      box-shadow 0.15s ease;

    &:hover {
      border-color: var(--accent-border);
      box-shadow: var(--shadow);
    }

    &--primary {
      border-color: var(--accent-border);
      background: var(--accent-bg);
      color: var(--text-h);
    }

    &.router-link-active {
      font-weight: 600;
    }
  }
}
</style>
