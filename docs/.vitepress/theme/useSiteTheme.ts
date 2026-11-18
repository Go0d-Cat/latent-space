import { ref } from 'vue'
import { DEFAULT_THEME, STORAGE_KEY, isThemeId, type ThemeId } from './themes.ts'

// 模块级状态：导航栏和移动端菜单里的两个切换器共享同一个值
const current = ref<ThemeId>(DEFAULT_THEME)

export function useSiteTheme() {
  /** 组件挂载后调用：读取 head 脚本已经设置好的 data-theme */
  function sync() {
    const attr = document.documentElement.dataset.theme
    current.value = isThemeId(attr) ? attr : DEFAULT_THEME
  }

  function setTheme(id: ThemeId) {
    current.value = id
    document.documentElement.dataset.theme = id
    try {
      localStorage.setItem(STORAGE_KEY, id)
    } catch {
      // 隐私模式等场景下 localStorage 不可用，只在本次会话生效
    }
  }

  return { current, sync, setTheme }
}
