import { ref } from 'vue'
import { OUTLINE_HIDDEN_CLASS, OUTLINE_HIDDEN_KEY, clampWidth, type WidthPref } from './layoutPrefs.ts'

function save(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, value)
  } catch {
    // 隐私模式等场景下 localStorage 不可用，只在本次会话生效
  }
}

/**
 * 读取实际生效的宽度（px）。实际宽度是带 min()/max() 的表达式，getComputedStyle 读到的是原始文本，
 * 所以用一个隐藏的探针元素让浏览器算出像素值。
 */
export function readActualWidth(pref: WidthPref): number {
  const probe = document.createElement('div')
  probe.style.cssText = `position:absolute;visibility:hidden;pointer-events:none;width:var(${pref.actualVar})`
  document.body.appendChild(probe)
  const width = probe.getBoundingClientRect().width
  probe.remove()
  return Math.round(width)
}

/** 应用宽度（会被限制在允许范围内），返回实际生效的值；不写入存储 */
export function applyWidth(pref: WidthPref, px: number): number {
  const value = clampWidth(pref, px)
  document.documentElement.style.setProperty(pref.cssVar, `${value}px`)
  return value
}

export function saveWidth(pref: WidthPref, px: number) {
  save(pref.key, String(px))
}

/** 恢复默认宽度：移除 <html> 上的覆盖值和存储 */
export function resetWidth(pref: WidthPref) {
  document.documentElement.style.removeProperty(pref.cssVar)
  save(pref.key, null)
}

// 模块级状态：目录里的「收起」和浮动的「目录」按钮共享同一个值
const outlineHidden = ref(false)

export function useOutlineHidden() {
  /** 组件挂载后调用：读取 head 脚本已经设置好的 class */
  function sync() {
    outlineHidden.value = document.documentElement.classList.contains(OUTLINE_HIDDEN_CLASS)
  }

  function setOutlineHidden(hidden: boolean) {
    outlineHidden.value = hidden
    document.documentElement.classList.toggle(OUTLINE_HIDDEN_CLASS, hidden)
    save(OUTLINE_HIDDEN_KEY, hidden ? '1' : null)
  }

  return { outlineHidden, sync, setOutlineHidden }
}
