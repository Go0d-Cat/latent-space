<script setup lang="ts">
/**
 * 拖动调整左侧边栏或右侧文章目录的宽度。
 * 支持鼠标/触控拖动、键盘方向键微调、双击恢复默认，宽度保存在 localStorage。
 * 只在桌面布局显示，视口范围见 layoutPrefs.ts 中的 media。
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useData, useRoute } from 'vitepress'
import { useLayout } from 'vitepress/theme'
import { OUTLINE, SIDEBAR } from './layoutPrefs.ts'
import { applyWidth, readActualWidth, resetWidth, saveWidth, useOutlineHidden } from './useLayoutPrefs.ts'
import { uiLang, uiText } from './i18n.ts'

const props = defineProps<{ target: 'sidebar' | 'outline' }>()

const isSidebar = props.target === 'sidebar'
const pref = isSidebar ? SIDEBAR : OUTLINE
// 侧边栏的把手往右拖变宽；文章目录在右边，把手往左拖变宽
const direction = isSidebar ? 1 : -1

const { lang } = useData()
const route = useRoute()
const { hasSidebar, hasAside, hasLocalNav } = useLayout()
const { outlineHidden } = useOutlineHidden()

const left = ref<number | null>(null)
const width = ref(0)
const dragging = ref(false)

const enabled = computed(() =>
  isSidebar ? hasSidebar.value : hasAside.value && hasLocalNav.value && !outlineHidden.value
)
const text = computed(() => uiText[uiLang(lang.value)])
const label = computed(() => (isSidebar ? text.value.resizeSidebar : text.value.resizeOutline))

/**
 * 当前实际宽度。两栏的宽度都会被 base.css 限制在可用空间内，
 * 所以以实际生效的宽度为准，避免拖动时出现「拖了但没变」的死区。
 */
function currentWidth(): number {
  return readActualWidth(pref)
}

/** 把手贴着目标的分界线：侧边栏取右边缘；文章目录取目录内容的左边缘，也就是那条竖分割线 */
function measure() {
  const el = enabled.value && matchMedia(pref.media).matches
    ? document.querySelector<HTMLElement>(isSidebar ? '.VPSidebar' : '.VPDoc .aside .aside-container')
    : null
  const rect = el?.getBoundingClientRect()
  if (!el || !rect || rect.width === 0) {
    left.value = null
    return
  }
  left.value = isSidebar ? rect.right : rect.left
  width.value = currentWidth()
}

function remeasure() {
  nextTick(() => requestAnimationFrame(measure))
}

function setWidth(px: number) {
  applyWidth(pref, px)
  requestAnimationFrame(measure)
}

/** 结束调整后，把设置值对齐到实际生效的宽度再保存，避免存下一个超出可用空间、看不出效果的值 */
function commit() {
  width.value = applyWidth(pref, currentWidth())
  saveWidth(pref, width.value)
  requestAnimationFrame(measure)
}

function onPointerDown(e: PointerEvent) {
  if (e.button !== 0) return
  e.preventDefault()
  const handle = e.currentTarget as HTMLElement
  const startX = e.clientX
  const startWidth = currentWidth()
  handle.setPointerCapture(e.pointerId)
  dragging.value = true
  document.documentElement.classList.add('ls-resizing')

  const onMove = (ev: PointerEvent) => setWidth(startWidth + direction * (ev.clientX - startX))
  const onEnd = () => {
    handle.removeEventListener('pointermove', onMove)
    handle.removeEventListener('pointerup', onEnd)
    handle.removeEventListener('pointercancel', onEnd)
    dragging.value = false
    document.documentElement.classList.remove('ls-resizing')
    commit()
  }
  handle.addEventListener('pointermove', onMove)
  handle.addEventListener('pointerup', onEnd)
  handle.addEventListener('pointercancel', onEnd)
}

/** 方向键移动把手：左移把手时侧边栏变窄、文章目录变宽 */
function onKeydown(e: KeyboardEvent) {
  const move = e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : 0
  if (!move) return
  e.preventDefault()
  applyWidth(pref, currentWidth() + direction * move * pref.step)
  commit()
}

function onReset() {
  resetWidth(pref)
  requestAnimationFrame(measure)
}

onMounted(() => {
  measure()
  window.addEventListener('resize', measure)
})
onBeforeUnmount(() => window.removeEventListener('resize', measure))
watch([() => route.path, enabled], remeasure)
</script>

<template>
  <div
    v-if="left !== null"
    class="ls-resize-handle"
    :class="{ dragging }"
    :style="{ left: `${left}px` }"
    role="separator"
    aria-orientation="vertical"
    tabindex="0"
    :aria-label="label"
    :aria-valuenow="width"
    :aria-valuemin="pref.min"
    :aria-valuemax="pref.max"
    :title="text.resizeHint"
    @pointerdown="onPointerDown"
    @keydown="onKeydown"
    @dblclick="onReset"
  />
</template>

<style scoped>
.ls-resize-handle {
  position: fixed;
  top: calc(var(--vp-nav-height) + var(--vp-layout-top-height, 0px));
  bottom: 0;
  z-index: calc(var(--vp-z-index-sidebar) + 1);
  width: 9px;
  margin-left: -4px;
  cursor: col-resize;
  touch-action: none;
}

.ls-resize-handle::after {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  left: 4px;
  width: 1px;
  background-color: transparent;
  transition: background-color 0.2s ease-out;
}

.ls-resize-handle:hover::after,
.ls-resize-handle:focus-visible::after,
.ls-resize-handle.dragging::after {
  left: 3px;
  width: 3px;
  background-color: var(--vp-c-brand-1);
}

.ls-resize-handle:focus-visible {
  outline: none;
}
</style>
