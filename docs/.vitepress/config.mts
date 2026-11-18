import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfigWithTheme, type DefaultTheme, type LocaleSpecificConfig } from 'vitepress'
import { themeInitScript } from './theme/themes.ts'
import { localePrefix, routeOf, type SiteThemeConfig } from './theme/i18n.ts'

const DOCS_DIR = fileURLToPath(new URL('..', import.meta.url))

/** GitHub Pages 项目站点部署在 /<仓库名>/ 下 */
const BASE = '/latent-space/'
const REPO_URL = 'https://github.com/Go0d-Cat/latent-space'

type LocaleKey = 'root' | 'en'

/**
 * 知识库分类。新增一个领域：
 * 1. 在 docs/ 和 docs/en/ 下各新建目录并放一个 index.md
 * 2. 在这里加一行
 */
const categories: { dir: string; text: Record<LocaleKey, string> }[] = [
  { dir: 'llm', text: { root: '大模型原理', en: 'LLM' } },
  { dir: 'agent', text: { root: 'Agent 应用', en: 'Agents' } },
  { dir: 'language', text: { root: '语言特性', en: 'Languages' } },
  { dir: 'architecture', text: { root: '系统架构', en: 'Architecture' } }
]

/** 优先取 frontmatter 的 title，其次取第一个 H1，最后用文件名 */
function getTitle(file: string): string {
  // 去掉 BOM（Windows 下部分编辑器会写入），否则 frontmatter 和首行标题无法匹配
  const content = fs.readFileSync(file, 'utf-8').replace(/^\uFEFF/, '')
  const fm = content.match(/^---\r?\n([\s\S]*?)\r?\n---/)
  const fmTitle = fm?.[1].match(/^title:\s*(.+)$/m)?.[1]
  if (fmTitle) return fmTitle.trim().replace(/^['"]|['"]$/g, '')
  // 去掉 frontmatter 和代码块，避免把 shell 注释 `# xxx` 误认成标题
  const body = (fm ? content.slice(fm[0].length) : content).replace(/^(```|~~~)[\s\S]*?^\1/gm, '')
  const h1 = body.match(/^#\s+(.+)$/m)?.[1]
  return h1?.trim() ?? path.basename(file, '.md')
}

/** 递归扫描目录生成侧边栏；以 . 或 _ 开头的文件/目录会被忽略 */
function buildItems(dir: string, base: string): DefaultTheme.SidebarItem[] {
  if (!fs.existsSync(dir)) return []
  const entries = fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((e) => !e.name.startsWith('.') && !e.name.startsWith('_'))
    .sort((a, b) => a.name.localeCompare(b.name, 'zh-CN', { numeric: true }))

  const items: DefaultTheme.SidebarItem[] = []
  for (const e of entries) {
    const full = path.join(dir, e.name)
    if (e.isDirectory()) {
      const index = path.join(full, 'index.md')
      const hasIndex = fs.existsSync(index)
      const children = buildItems(full, `${base}${e.name}/`)
      if (!hasIndex && children.length === 0) continue
      items.push({
        text: hasIndex ? getTitle(index) : e.name,
        link: hasIndex ? `${base}${e.name}/` : undefined,
        collapsed: true,
        items: children
      })
    } else if (e.name.endsWith('.md') && e.name !== 'index.md') {
      items.push({ text: getTitle(full), link: `${base}${e.name.slice(0, -3)}` })
    }
  }
  return items
}

/** 列出所有页面的路由，供语言切换判断目标页面是否存在 */
function listPages(dir: string, rel = ''): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    if (e.name.startsWith('.') || e.name === 'public') return []
    const childRel = rel ? `${rel}/${e.name}` : e.name
    if (e.isDirectory()) return listPages(path.join(dir, e.name), childRel)
    return e.name.endsWith('.md') ? [routeOf(childRel)] : []
  })
}

/** 两种语言的侧边栏合在一起，VitePress 按路径前缀匹配 */
const sidebar: DefaultTheme.SidebarMulti = Object.fromEntries(
  (['root', 'en'] as const).flatMap((locale) =>
    categories.map((c) => {
      const base = `/${localePrefix(locale)}${c.dir}/`
      const dir = path.join(DOCS_DIR, localePrefix(locale), c.dir)
      return [base, [{ text: c.text[locale], link: base, items: buildItems(dir, base) }]]
    })
  )
)

function nav(locale: LocaleKey, home: string): DefaultTheme.NavItem[] {
  const prefix = `/${localePrefix(locale)}`
  return [
    { text: home, link: prefix },
    ...categories.map((c) => ({
      text: c.text[locale],
      link: `${prefix}${c.dir}/`,
      activeMatch: `^${prefix}${c.dir}/`
    }))
  ]
}

const copyright = `© ${new Date().getFullYear()} Go0d-Cat`

const zh: LocaleSpecificConfig<SiteThemeConfig> = {
  lang: 'zh-CN',
  description: '个人技术知识库：大模型/Agent、编程语言特性与系统架构学习笔记',
  themeConfig: {
    nav: nav('root', '首页'),
    editLink: { pattern: `${REPO_URL}/edit/main/docs/:path`, text: '在 GitHub 上编辑此页' },
    footer: { message: '慢慢学，认真记', copyright },
    outline: { level: [2, 3], label: '本页目录' },
    docFooter: { prev: '上一篇', next: '下一篇' },
    lastUpdated: { text: '最后更新于' },
    darkModeSwitchLabel: '外观',
    lightModeSwitchTitle: '切换到浅色模式',
    darkModeSwitchTitle: '切换到深色模式',
    sidebarMenuLabel: '菜单',
    returnToTopLabel: '回到顶部',
    skipToContentLabel: '跳到正文'
  }
}

const en: LocaleSpecificConfig<SiteThemeConfig> = {
  lang: 'en-US',
  description: 'Personal knowledge base: engineering notes on AI/Agent, programming languages, and system architecture',
  themeConfig: {
    nav: nav('en', 'Home'),
    editLink: { pattern: `${REPO_URL}/edit/main/docs/:path`, text: 'Edit this page on GitHub' },
    footer: { message: 'Learn slowly, write it down', copyright },
    outline: { level: [2, 3], label: 'On this page' },
    lastUpdated: { text: 'Last updated' }
  }
}

// https://vitepress.dev/reference/site-config
export default defineConfigWithTheme<SiteThemeConfig>({
  base: BASE,
  title: 'Latent Space',
  cleanUrls: true,
  lastUpdated: true,
  // 首屏渲染前设置 data-theme，避免切换过主题的访客看到默认主题闪一下
  head: [['script', {}, themeInitScript()]],

  locales: {
    root: { label: '简体中文', ...zh },
    en: { label: 'English', link: '/en/', ...en }
  },

  themeConfig: {
    // https://vitepress.dev/reference/default-theme-config
    sidebar,
    pages: listPages(DOCS_DIR),

    search: {
      provider: 'local',
      options: {
        locales: {
          root: {
            translations: {
              button: { buttonText: '搜索', buttonAriaLabel: '搜索' },
              modal: {
                noResultsText: '没有找到相关结果',
                resetButtonTitle: '清除',
                backButtonTitle: '返回',
                footer: { selectText: '选择', navigateText: '切换', closeText: '关闭' }
              }
            }
          }
        }
      }
    }
  }
})
