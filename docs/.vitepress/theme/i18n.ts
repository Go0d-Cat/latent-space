/**
 * 多语言相关的共享代码。纯数据和纯函数，config.mts（Node 端）和主题组件（浏览器端）都会引用。
 */
import type { DefaultTheme } from 'vitepress'

export interface SiteThemeConfig extends DefaultTheme.Config {
  /** 站点所有页面的路由（不含 base），语言切换时用来判断目标页面是否存在；只在根配置里设置 */
  pages?: string[]
}

/** 与 cleanUrls 一致：'index.md' -> '/'，'llm/index.md' -> '/llm/'，'llm/foo.md' -> '/llm/foo' */
export function routeOf(relativePath: string): string {
  const p = relativePath.replace(/\\/g, '/').replace(/\.md$/, '')
  if (p === 'index') return '/'
  if (p.endsWith('/index')) return `/${p.slice(0, -'index'.length)}`
  return `/${p}`
}

/** 语言 key 对应的路径前缀：root -> ''，en -> 'en/' */
export function localePrefix(key: string): string {
  return key === 'root' ? '' : `${key}/`
}

export type UiLang = 'zh' | 'en'

export function uiLang(lang: string): UiLang {
  return lang.toLowerCase().startsWith('zh') ? 'zh' : 'en'
}

/** 自定义组件里的界面文字 */
export const uiText: Record<
  UiLang,
  {
    theme: string
    language: string
    hideOutline: string
    showOutline: string
    resizeSidebar: string
    resizeOutline: string
    resizeHint: string
  }
> = {
  zh: {
    theme: '主题',
    language: '语言',
    hideOutline: '收起',
    showOutline: '目录',
    resizeSidebar: '调整侧边栏宽度',
    resizeOutline: '调整文章目录宽度',
    resizeHint: '拖动调整宽度，双击恢复默认'
  },
  en: {
    theme: 'Theme',
    language: 'Language',
    hideOutline: 'Hide',
    showOutline: 'Outline',
    resizeSidebar: 'Resize sidebar',
    resizeOutline: 'Resize outline',
    resizeHint: 'Drag to resize, double-click to reset'
  }
}
