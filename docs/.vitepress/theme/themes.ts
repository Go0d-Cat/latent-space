/**
 * 站点主题注册表。纯数据，config.mts（Node 端）和主题组件（浏览器端）都会引用。
 * 新增主题：在这里加一项，并在 styles/ 下新建对应的 CSS（选择器以 html[data-theme='<id>'] 开头）。
 */
export const themes = [
  { id: 'macos', name: { zh: 'macOS', en: 'macOS' } },
  { id: 'retro', name: { zh: '复古电玩', en: 'Retro Arcade' } },
  { id: 'sakura', name: { zh: '樱花粉', en: 'Sakura' } }
] as const

export type ThemeId = (typeof themes)[number]['id']

export const DEFAULT_THEME: ThemeId = 'macos'

export const STORAGE_KEY = 'ls-theme'

export function isThemeId(value: unknown): value is ThemeId {
  return themes.some((t) => t.id === value)
}

/**
 * 内联到 <head> 的脚本：在首屏渲染前设置 data-theme，避免主题闪烁。
 * 只读一次 localStorage，值不合法时回退到默认主题。
 */
export function themeInitScript(): string {
  const ids = JSON.stringify(themes.map((t) => t.id))
  return `(function(){var t=${JSON.stringify(DEFAULT_THEME)};try{var s=localStorage.getItem(${JSON.stringify(STORAGE_KEY)});if(${ids}.indexOf(s)>=0)t=s}catch(_){}document.documentElement.dataset.theme=t})()`
}
