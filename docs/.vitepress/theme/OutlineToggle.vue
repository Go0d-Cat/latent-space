<script setup lang="ts">
/**
 * 收起 / 展开右侧文章目录。
 * - placement="aside"：放在文章目录标题右侧的「收起」按钮
 * - placement="floating"：目录收起后固定在页面右上方的「目录」按钮
 * 窄屏（< 1024px）下文章目录在顶部的「本页目录」弹出菜单里，这两个按钮都不显示。
 */
import { computed, onMounted, ref } from 'vue'
import { useData } from 'vitepress'
import { useLayout } from 'vitepress/theme'
import { uiLang, uiText } from './i18n.ts'
import { useOutlineHidden } from './useLayoutPrefs.ts'

const props = defineProps<{ placement: 'aside' | 'floating' }>()

const { lang } = useData()
const { hasAside, hasLocalNav } = useLayout()
const { outlineHidden, sync, setOutlineHidden } = useOutlineHidden()

// 浮动按钮依赖 localStorage 里的状态，挂载后再渲染，避免和服务端渲染的 HTML 不一致
const mounted = ref(false)
onMounted(() => {
  sync()
  mounted.value = true
})

const text = computed(() => uiText[uiLang(lang.value)])
const visible = computed(() =>
  props.placement === 'aside'
    ? hasLocalNav.value
    : mounted.value && outlineHidden.value && hasAside.value && hasLocalNav.value
)
</script>

<template>
  <div v-if="visible" class="ls-outline-toggle" :class="`placement-${placement}`">
    <button
      type="button"
      class="ls-outline-toggle-button"
      :aria-expanded="placement === 'floating' ? 'false' : 'true'"
      @click="setOutlineHidden(placement === 'aside')"
    >
      {{ placement === 'aside' ? text.hideOutline : text.showOutline }}
    </button>
  </div>
</template>

<style scoped>
/* 高度为 0 的一行，按钮绝对定位到紧随其后的「本页目录」标题右侧 */
.ls-outline-toggle.placement-aside {
  position: relative;
  z-index: 2;
  height: 0;
}

.ls-outline-toggle.placement-aside .ls-outline-toggle-button {
  position: absolute;
  top: 0.25rem;
  right: 0;
}

.ls-outline-toggle.placement-floating {
  display: none;
}

/* 与 layoutPrefs.ts 中 OUTLINE.media 一致 */
@media (min-width: 1024px) {
  .ls-outline-toggle.placement-floating {
    display: block;
    position: fixed;
    top: calc(var(--vp-nav-height) + var(--vp-layout-top-height, 0px) + 3rem);
    right: max(1.5rem, calc((100vw - var(--vp-layout-max-width)) / 2 + 1.5rem));
    z-index: var(--vp-z-index-local-nav);
  }
}

.ls-outline-toggle-button {
  padding: 0 0.625rem;
  height: 1.5rem;
  border: 1px solid var(--vp-c-divider);
  border-radius: 6px;
  background-color: var(--vp-c-bg);
  color: var(--vp-c-text-2);
  font-size: 0.75rem;
  font-weight: 500;
  line-height: calc(1.5rem - 2px);
  cursor: pointer;
  transition: color 0.2s ease-out, border-color 0.2s ease-out;
}

.ls-outline-toggle-button:hover {
  border-color: var(--vp-c-brand-1);
  color: var(--vp-c-brand-1);
}

.ls-outline-toggle-button:focus-visible {
  outline: 2px solid var(--vp-c-brand-1);
  outline-offset: 2px;
}
</style>
