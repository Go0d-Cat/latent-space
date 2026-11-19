import { h } from 'vue'
import DefaultTheme from 'vitepress/theme'
import type { Theme } from 'vitepress'
import ThemeSwitcher from './ThemeSwitcher.vue'
import LangSwitcher from './LangSwitcher.vue'
import OutlineToggle from './OutlineToggle.vue'
import ResizeHandle from './ResizeHandle.vue'

// 像素字体只含拉丁字符，中文回退到系统字体；本地打包，不依赖外部 CDN。
// 只有复古电玩主题用到它，浏览器只在实际用到时才下载字体文件。
import '@fontsource/press-start-2p/latin.css'

// 每套主题的样式都限定在 html[data-theme='<id>'] 下，互不影响
import './styles/base.css'
import './styles/macos.css'
import './styles/retro.css'
import './styles/sakura.css'

export default {
  extends: DefaultTheme,
  Layout: () =>
    h(DefaultTheme.Layout, null, {
      'nav-bar-content-after': () => [h(LangSwitcher), h(ThemeSwitcher)],
      'nav-screen-content-after': () => [h(LangSwitcher, { screen: true }), h(ThemeSwitcher, { screen: true })],
      'aside-outline-before': () => h(OutlineToggle, { placement: 'aside' }),
      'layout-bottom': () => [
        h(ResizeHandle, { target: 'sidebar' }),
        h(ResizeHandle, { target: 'outline' }),
        h(OutlineToggle, { placement: 'floating' })
      ]
    })
} satisfies Theme
