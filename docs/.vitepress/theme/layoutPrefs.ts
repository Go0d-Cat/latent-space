/**
 * 阅读布局偏好：左侧边栏宽度、右侧文章目录宽度、文章目录是否收起。
 * 纯数据和纯函数，config.mts（Node 端）和主题组件（浏览器端）都会引用。
 */

export interface WidthPref {
  /** localStorage key */
  key: string
  /** 用户设置的宽度变量，设置在 <html> 上 */
  cssVar: string
  /** 实际生效的宽度变量，由 styles/base.css 根据可用空间从 cssVar 算出 */
  actualVar: string
  min: number
  max: number
  /** 键盘方向键每次调整的像素 */
  step: number
  /** 可以调整宽度的视口范围，与 styles/base.css 和 VitePress 的断点一致 */
  media: string
}

/** 实际宽度是 VitePress 自带的 --vp-sidebar-width，侧边栏、导航栏和正文的位置都跟着它算；侧边栏从 960px 起固定显示 */
export const SIDEBAR: WidthPref = {
  key: 'ls-sidebar-width',
  cssVar: '--ls-sidebar-width',
  actualVar: '--vp-sidebar-width',
  min: 200,
  max: 400,
  step: 16,
  media: '(min-width: 960px)'
}

/** 默认 14rem，与 VitePress 原始宽度一致；右侧固定目录从 1024px 起显示 */
export const OUTLINE: WidthPref = {
  key: 'ls-outline-width',
  cssVar: '--ls-outline-width',
  actualVar: '--ls-outline-actual',
  min: 180,
  max: 400,
  step: 16,
  media: '(min-width: 1024px)'
}

export const OUTLINE_HIDDEN_KEY = 'ls-outline-hidden'
export const OUTLINE_HIDDEN_CLASS = 'ls-outline-hidden'

export function clampWidth(pref: WidthPref, px: number): number {
  return Math.round(Math.min(pref.max, Math.max(pref.min, px)))
}

/**
 * 内联到 <head> 的脚本：首屏渲染前恢复上次的宽度和目录收起状态，避免布局跳动。
 * 存储值不在允许范围内时忽略，使用默认值。
 */
export function layoutInitScript(): string {
  const widths = JSON.stringify([SIDEBAR, OUTLINE].map((p) => [p.key, p.cssVar, p.min, p.max]))
  return `(function(){var r=document.documentElement;try{${widths}.forEach(function(p){var n=Number(localStorage.getItem(p[0]));if(n>=p[2]&&n<=p[3])r.style.setProperty(p[1],n+'px')});if(localStorage.getItem(${JSON.stringify(OUTLINE_HIDDEN_KEY)})==='1')r.classList.add(${JSON.stringify(OUTLINE_HIDDEN_CLASS)})}catch(_){}})()`
}
