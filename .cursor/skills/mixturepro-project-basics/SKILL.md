---
name: mixturepro-project-basics
description: >-
  Applies mixturePro repository conventions for Vue 3, TypeScript, Vite, Element
  Plus (on-demand), icons, and Cesium global bootstrap. Use when editing this
  project, when the user mentions mixturePro、地图、Cesium、Element Plus，或需要与仓库准则对齐时。
disable-model-invocation: true
---

# mixturePro 项目基础约定

## 何时阅读本技能

用户 @ 本技能、或任务涉及本仓库前端栈 / 地图 / 构建时，先按下列要点执行；细则以仓库规则为准。

## 必读来源

- 完整准则：仓库内 [.cursor/rules/cursorrules.mdc](../../rules/cursorrules.mdc)（含**八字口诀**、**Vue 3 + TS + Vite 高频约定**、简洁写法与 Cesium；`alwaysApply` 时以规则文件为准）。
- Vue SFC 块顺序等补充：[.cursor/rules/vue-sfc-block-order.mdc](../../rules/vue-sfc-block-order.mdc)。

## 执行要点（摘要）

0. **八字口诀**：见 `cursorrules.mdc` 首节「八字口诀（总纲）」——接口查文档、执行与业务先确认、复用优先、验证与架构不轻动、不懂就问、改动克制。
1. **栈**：Vue 3 + TypeScript + Vite；改动与周边风格一致，避免无关重构。
2. **Element Plus**：按需组件与自动导入；禁止在 `main.ts` 全量注册或整包引入 `element-plus/dist/index.css`。
3. **图标**：仅在使用的组件内按需 `import` `@element-plus/icons-vue`；禁止在入口全局注册全部图标。
4. **Cesium**：`main.ts` 首行加载 `cesium-global`；组件内 `getCesium()`。细则与简洁写法见 `cursorrules.mdc`。
5. **验证**：修改构建或依赖后，应保证 `npm run build` 可通过。
6. **沟通**：默认中文；不确定或与准则冲突时先问维护者。
7. **Vue + TS + Vite 高频**：`script setup`、`import.meta.env` / `VITE_`、自动导入勿重复 import、路由懒加载、`shallowRef` 大对象、卸载时清理副作用等，见 `cursorrules.mdc`「Vue 3 + TypeScript + Vite」节。

## 可选扩展

在 `.cursor/skills/` 下新建 `另一技能名/SKILL.md`（同级目录，与 `mixturepro-project-basics` 并列），即可增加更多专项技能；每个技能目录只保留一个主文件 `SKILL.md`，可选附带 `reference.md`、`scripts/` 等。
